import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase, storage } from "./storage";
import { runMigrations } from "./db";
import * as fs from "fs";
import * as path from "path";
import { isR2Configured, startCleanupScheduler } from "./r2-storage";

// ============ PRODUCTION STARTUP LOGGING ============
console.log("=".repeat(60));
console.log("[STARTUP] Server starting...");
console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
console.log(`[STARTUP] PORT: ${process.env.PORT || "5000 (default)"}`);
console.log(`[STARTUP] DATABASE_URL: ${process.env.DATABASE_URL ? "SET" : "NOT SET (CRITICAL!)"}`);
console.log(`[STARTUP] SESSION_SECRET: ${process.env.SESSION_SECRET ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] AI_INTEGRATIONS_OPENAI_API_KEY: ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] R2_ACCOUNT_ID: ${process.env.R2_ACCOUNT_ID ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] R2_ACCESS_KEY_ID: ${process.env.R2_ACCESS_KEY_ID ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] R2_SECRET_ACCESS_KEY: ${process.env.R2_SECRET_ACCESS_KEY ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] R2_BUCKET_NAME: ${process.env.R2_BUCKET_NAME || "NOT SET"}`);
console.log(`[STARTUP] R2_PUBLIC_URL: ${process.env.R2_PUBLIC_URL ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] R2_STORAGE: ${isR2Configured() ? "CONFIGURED" : "NOT CONFIGURED (using Replit Object Storage)"}`);
// SOLAPI environment variables check
console.log(`[STARTUP] SOLAPI_API_KEY_DMC: ${process.env.SOLAPI_API_KEY_DMC ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] SOLAPI_API_SECRET_DMC: ${process.env.SOLAPI_API_SECRET_DMC ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] SOLAPI_SENDER_NUMBER_DMC: ${process.env.SOLAPI_SENDER_NUMBER_DMC ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] SOLAPI_API_KEY: ${process.env.SOLAPI_API_KEY ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] SOLAPI_API_SECRET: ${process.env.SOLAPI_API_SECRET ? "SET" : "NOT SET"}`);
console.log(`[STARTUP] SOLAPI_SENDER_NUMBER_MOKDONG: ${process.env.SOLAPI_SENDER_NUMBER_MOKDONG ? "SET" : "NOT SET"}`);
console.log("=".repeat(60));

if (!process.env.DATABASE_URL) {
  console.error("[FATAL] DATABASE_URL is not set! Server cannot connect to database.");
}

const app = express();
const httpServer = createServer(app);

// Track server initialization state
let isInitialized = false;
let initializationError: string | null = null;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Health check endpoint - must be registered FIRST before any other routes
// This allows the deployment platform to verify the server is running
app.get("/health", (_req, res) => {
  if (initializationError) {
    return res.status(503).json({ 
      status: "error", 
      error: initializationError 
    });
  }
  if (!isInitialized) {
    return res.status(503).json({ 
      status: "initializing" 
    });
  }
  return res.status(200).json({ status: "ok" });
});

// Trust proxy headers (required for Railway/Replit environments)
app.set("trust proxy", true);

// Redirect non-www to www domain (primemathgroup.com -> www.primemathgroup.com)
app.use((req, res, next) => {
  const host = (req.headers.host || "").toLowerCase();
  const proto =
    (req.headers["x-forwarded-proto"] as string) || (req.secure ? "https" : "http");

  // primemathgroup.com -> www.primemathgroup.com
  if (host === "primemathgroup.com") {
    const redirectUrl = `${proto}://www.primemathgroup.com${req.originalUrl}`;
    console.log(`[REDIRECT] ${host}${req.originalUrl} -> ${redirectUrl}`);
    return res.redirect(301, redirectUrl);
  }
  next();
});

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Memory monitoring for OOM debugging
function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function logMemoryUsage() {
  const mem = process.memoryUsage();
  const usage = {
    rss: formatBytes(mem.rss),           // Total memory allocated
    heapTotal: formatBytes(mem.heapTotal), // Total heap size
    heapUsed: formatBytes(mem.heapUsed),   // Actually used heap
    external: formatBytes(mem.external),   // C++ objects bound to JS
  };
  log(`Memory: RSS=${usage.rss}, HeapTotal=${usage.heapTotal}, HeapUsed=${usage.heapUsed}, External=${usage.external}`, "memory");
}

// Log memory on startup and every 5 minutes
logMemoryUsage();
setInterval(logMemoryUsage, 5 * 60 * 1000);

// Disable caching for API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Generate unique request ID for correlation
let requestCounter = 0;

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  const reqId = ++requestCounter;
  
  // Log request ENTRY immediately (before any processing)
  if (reqPath.startsWith("/api")) {
    console.log(`[REQ-${reqId}] --> ${req.method} ${reqPath}`);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      console.log(`[REQ-${reqId}] <-- ${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  res.on("error", (err) => {
    if (reqPath.startsWith("/api")) {
      console.error(`[REQ-${reqId}] ERROR in ${req.method} ${reqPath}:`, err);
    }
  });

  next();
});

// Auto-promote student grades on January 1st
async function checkAndPromoteGrades() {
  try {
    const currentYear = new Date().getFullYear();
    const lastPromotionYear = await storage.getSystemSetting("lastPromotionYear");
    
    if (!lastPromotionYear || parseInt(lastPromotionYear) < currentYear) {
      const promotedCount = await storage.promoteAllStudentGrades();
      await storage.setSystemSetting("lastPromotionYear", currentYear.toString());
      
      if (promotedCount > 0) {
        log(`Auto grade promotion: ${promotedCount} students promoted for year ${currentYear}`);
      } else {
        log(`Auto grade promotion: No students needed promotion for year ${currentYear}`);
      }
    }
  } catch (error) {
    log(`Failed to check/promote grades: ${error}`);
  }
}

// Cleanup old temporary clinic resources (older than 14 days from upload)
async function cleanupOldClinicResources() {
  try {
    // Calculate cutoff date: 14 days ago from now
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const cutoffDate = fourteenDaysAgo.toISOString();
    
    const { count, filePaths } = await storage.deleteOldTemporaryClinicResources(cutoffDate);
    
    // Delete files from disk
    for (const filePath of filePaths) {
      try {
        // filePath is like "/uploads/clinic/filename.pdf", need to resolve to actual path
        const actualPath = path.join(process.cwd(), filePath.startsWith("/") ? filePath.slice(1) : filePath);
        if (fs.existsSync(actualPath)) {
          fs.unlinkSync(actualPath);
        }
      } catch (fileErr) {
        // Log but continue with other files
        log(`Failed to delete file ${filePath}: ${fileErr}`);
      }
    }
    
    if (count > 0) {
      log(`Cleaned up ${count} old temporary clinic resources (before ${cutoffDate})`);
    }
  } catch (error) {
    log(`Failed to cleanup old clinic resources: ${error}`);
  }
}

// Async initialization function - runs AFTER server starts
async function initializeApp() {
  try {
    console.log("[STARTUP] Running database migrations...");
    await runMigrations();
    console.log("[STARTUP] Migrations complete");
    
    console.log("[STARTUP] Seeding database...");
    await seedDatabase();
    console.log("[STARTUP] Database seeding complete");
    
    console.log("[STARTUP] Registering routes...");
    await registerRoutes(httpServer, app);
    console.log("[STARTUP] Routes registered");
    
    // Cleanup old temporary clinic resources on startup
    await cleanupOldClinicResources();
    
    // Check and promote grades on startup (runs once per year)
    await checkAndPromoteGrades();
    
    // Check daily for grade promotion (in case server runs across year boundary)
    setInterval(() => {
      checkAndPromoteGrades();
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Global error handler - catches all unhandled errors in routes
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log full error with stack trace for debugging
      console.error("=".repeat(60));
      console.error(`[GLOBAL ERROR] ${req.method} ${req.path}`);
      console.error(`[GLOBAL ERROR] Status: ${status}`);
      console.error(`[GLOBAL ERROR] Message: ${message}`);
      console.error(`[GLOBAL ERROR] Stack:`, err.stack || err);
      console.error("=".repeat(60));

      // Don't throw - just respond with error
      if (!res.headersSent) {
        res.status(status).json({ error: message });
      }
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      console.log("[STARTUP] Production mode - serving static files");
      serveStatic(app);
    } else {
      console.log("[STARTUP] Development mode - setting up Vite");
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // Mark initialization complete
    isInitialized = true;
    console.log("[STARTUP] Initialization complete - server fully ready");
    
    if (isR2Configured()) {
      startCleanupScheduler(24).catch(err => {
        console.error("[STARTUP] Failed to start R2 cleanup scheduler:", err);
      });
    }
  } catch (initError: any) {
    console.error("=".repeat(60));
    console.error("[INITIALIZATION ERROR]");
    console.error(initError.message);
    console.error(initError.stack);
    console.error("=".repeat(60));
    initializationError = initError.message;
  }
}

// Start server FIRST, then initialize app asynchronously
// This allows the deployment platform's health check to succeed quickly
const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    console.log("=".repeat(60));
    console.log(`[STARTUP] Server listening on port ${port}`);
    console.log(`[STARTUP] Health check available at /health`);
    console.log("=".repeat(60));
    logMemoryUsage();
    
    // Start async initialization after server is listening
    initializeApp().catch(err => {
      console.error("[FATAL] Initialization failed:", err);
      initializationError = err.message;
    });
  },
);

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("=".repeat(60));
  console.error("[UNHANDLED REJECTION] Unhandled Promise Rejection:");
  console.error("Reason:", reason);
  console.error("Promise:", promise);
  console.error("=".repeat(60));
});

// Catch uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("=".repeat(60));
  console.error("[UNCAUGHT EXCEPTION]");
  console.error(error.message);
  console.error(error.stack);
  console.error("=".repeat(60));
});
