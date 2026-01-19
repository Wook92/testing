import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { UserRole, type User, type AttendanceRecord, homework, centers, classes, users, enrollments, userCenters } from "@shared/schema";
import { format } from "date-fns";
import multer from "multer";
import path from "path";
import fs from "fs";
// XLSX loaded dynamically to reduce startup memory
import iconv from "iconv-lite";
import { sendAttendanceNotification, sendLateNotification, isSolapiConfigured, sendSms } from "./services/solapi";
import { encrypt, decrypt } from "./crypto";
// reportGeneration loaded dynamically to reduce startup memory (uses OpenAI)
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { db } from "./db";
import { sql, eq, inArray } from "drizzle-orm";
import { isR2Configured, getUploadUrl, deleteObject } from "./r2-storage";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(null, true);
    }
  },
});

const clinicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("PDF, 이미지 파일만 업로드 가능합니다"));
    }
  },
});

// R2 client for direct upload
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "primemath-homework";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

function getClinicR2Client(): S3Client | null {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".xlsx", ".xls", ".csv", ".tsv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("엑셀 파일(.xlsx, .xls) 또는 CSV/TSV 파일만 업로드 가능합니다"));
    }
  },
});

// Generate PIN from phone number (last 4 digits, or middle 4 if collision)
function generatePinFromPhone(phone: string, existingPins: string[]): string {
  // Remove non-digit characters
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "";
  
  // Try last 4 digits first
  const last4 = digits.slice(-4);
  if (!existingPins.includes(last4)) {
    return last4;
  }
  
  // If collision, try middle 4 digits
  const middle4 = digits.slice(3, 7);
  if (!existingPins.includes(middle4)) {
    return middle4;
  }
  
  return "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Database health check endpoint
  app.get("/api/db-health", async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
      const tables = Array.isArray(result) ? result.map((r: any) => r.table_name) : [];
      res.json({ 
        status: "connected", 
        tableCount: tables.length,
        tables: tables
      });
    } catch (error: any) {
      console.error("DB health check error:", error);
      res.status(500).json({ 
        status: "error", 
        message: error?.message || "Unknown error",
        stack: error?.stack
      });
    }
  });
  
  // Debug endpoint to test specific queries
  app.get("/api/debug-homework", async (req, res) => {
    try {
      const centerId = req.query.centerId as string || "5aa83006-0a61-4a19-a8fd-0bc6da175706";
      
      // Test 1: Check classes table columns
      const classesColumns = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'classes' 
        ORDER BY ordinal_position
      `);
      
      // Test 2: Try to get classes by center
      let centerClasses: any[] = [];
      let classError = null;
      try {
        centerClasses = await db.select().from(classes).where(eq(classes.centerId, centerId));
      } catch (e: any) {
        classError = e?.message;
      }
      
      // Test 3: Get homework if we have classes
      let homeworkResult: any[] = [];
      let homeworkError = null;
      if (centerClasses.length > 0 && !classError) {
        try {
          const classIds = centerClasses.map((c) => c.id);
          homeworkResult = await db.select().from(homework).where(inArray(homework.classId, classIds));
        } catch (e: any) {
          homeworkError = e?.message;
        }
      }
      
      // Test 4: Check centers table
      const centersResult = await db.select().from(centers).limit(5);
      
      res.json({
        status: "ok",
        centerId,
        classesColumns: Array.isArray(classesColumns) ? classesColumns : [],
        centerClasses,
        classError,
        homeworkResult,
        homeworkError,
        centersSample: centersResult
      });
    } catch (error: any) {
      console.error("Debug homework error:", error);
      res.status(500).json({
        status: "error",
        message: error?.message || "Unknown error",
        stack: error?.stack,
        code: error?.code
      });
    }
  });
  
  // Endpoint to seed missing data in production
  app.post("/api/seed-missing-data", async (req, res) => {
    try {
      
      // Check if classes exist
      const existingClasses = await db.select().from(classes);
      if (existingClasses.length > 0) {
        return res.json({ status: "skipped", message: "Classes already exist", classCount: existingClasses.length });
      }
      
      // Get existing centers
      const allCenters = await db.select().from(centers);
      if (allCenters.length === 0) {
        return res.status(400).json({ status: "error", message: "No centers found" });
      }
      
      const dmcCenter = allCenters.find(c => c.name === "DMC센터") || allCenters[0];
      const mokdongCenter = allCenters.find(c => c.name === "목동센터") || allCenters[1] || allCenters[0];
      
      // Get existing teachers
      const allUsers = await db.select().from(users);
      const teachers = allUsers.filter(u => u.role === UserRole.TEACHER);
      const students = allUsers.filter(u => u.role === UserRole.STUDENT);
      
      if (teachers.length === 0) {
        return res.status(400).json({ status: "error", message: "No teachers found" });
      }
      
      // Create classes for DMC center
      const teacher1 = teachers[0];
      const [mathClass] = await db.insert(classes).values({
        name: "수학 A반",
        subject: "수학",
        classType: "regular",
        teacherId: teacher1.id,
        centerId: dmcCenter.id,
        classroom: "A101",
        days: ["mon", "wed", "fri"],
        startTime: "14:00",
        endTime: "16:00",
        color: "#3B82F6",
      }).returning();

      const [englishClass] = await db.insert(classes).values({
        name: "영어 기초반",
        subject: "영어",
        classType: "regular",
        teacherId: teacher1.id,
        centerId: dmcCenter.id,
        classroom: "B202",
        days: ["tue", "thu"],
        startTime: "16:00",
        endTime: "18:00",
        color: "#10B981",
      }).returning();

      const [testClass] = await db.insert(classes).values({
        name: "수학 평가",
        subject: "수학",
        classType: "assessment",
        teacherId: teacher1.id,
        centerId: dmcCenter.id,
        classroom: "A101",
        days: ["sat"],
        startTime: "10:00",
        endTime: "12:00",
        color: "#EF4444",
      }).returning();

      // Create classes for Mokdong center if we have more teachers
      let mokClasses: any[] = [];
      if (teachers.length > 1 && mokdongCenter.id !== dmcCenter.id) {
        const teacher2 = teachers[1];
        const [mokMathClass] = await db.insert(classes).values({
          name: "수학 심화반",
          subject: "심화반",
          classType: "regular",
          teacherId: teacher2.id,
          centerId: mokdongCenter.id,
          classroom: "101호",
          days: ["mon", "wed"],
          startTime: "15:00",
          endTime: "17:00",
          color: "#1E3A5F",
        }).returning();
        mokClasses.push(mokMathClass);
      }

      // Enroll students
      const dmcStudents = students.slice(0, Math.min(3, students.length));
      for (const student of dmcStudents) {
        await db.insert(enrollments).values({ studentId: student.id, classId: mathClass.id }).onConflictDoNothing();
      }

      // Create homework
      await db.insert(homework).values({
        classId: mathClass.id,
        title: "교과서 32~35페이지 풀어오세요",
        dueDate: new Date().toISOString().split("T")[0],
      });

      await db.insert(homework).values({
        classId: englishClass.id,
        title: "단어 암기 Day 5 테스트 준비하세요",
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });

      res.json({ 
        status: "success", 
        message: "Missing data seeded",
        dmcCenterId: dmcCenter.id,
        mokdongCenterId: mokdongCenter.id,
        classesCreated: 3 + mokClasses.length
      });
    } catch (error: any) {
      console.error("Seed missing data error:", error);
      res.status(500).json({ status: "error", message: error?.message, stack: error?.stack });
    }
  });
  
  // Register Object Storage routes for persistent file storage
  registerObjectStorageRoutes(app);
  
  // Serve uploaded files (legacy - for backward compatibility)
  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(uploadDir, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // File upload endpoint
  app.post("/api/upload", upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (error) {
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Auth
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const centers = await storage.getUserCenters(user.id);
      res.json({ user, centers });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Users
  app.get("/api/users/:id/centers", async (req, res) => {
    try {
      const centers = await storage.getUserCenters(req.params.id);
      res.json(centers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get centers" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const rawCenterId = req.query.centerId as string | undefined;
      // Handle "undefined" and "null" strings as no filter
      const centerId = (rawCenterId && rawCenterId !== "undefined" && rawCenterId !== "null") 
        ? rawCenterId 
        : undefined;
      const users = await storage.getUsers(centerId);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { centerId, centerIds, attendancePin, ...userData } = req.body;
      
      // Normalize phone numbers (remove all non-digit characters)
      const normalizePhone = (phone: string | null | undefined) => 
        phone ? phone.replace(/\D/g, "") : null;
      
      const normalizedPhone = normalizePhone(userData.phone);
      const normalizedUsername = normalizePhone(userData.username) || userData.username;
      
      // Efficient DB query instead of loading all users into memory
      const existingUser = await storage.checkUserExists(normalizedPhone, normalizedUsername);
      
      if (existingUser) {
        return res.status(400).json({ error: "이미 등록된 전화번호입니다" });
      }
      
      // Store normalized phone numbers
      const normalizedUserData = {
        ...userData,
        phone: normalizedPhone,
        username: normalizedPhone || userData.username,
        motherPhone: normalizePhone(userData.motherPhone),
        fatherPhone: normalizePhone(userData.fatherPhone),
      };
      
      const user = await storage.createUser(normalizedUserData);
      
      // Support both single centerId and multiple centerIds
      const centersToAdd = centerIds || (centerId ? [centerId] : []);
      for (const cId of centersToAdd) {
        await storage.addUserToCenter({ userId: user.id, centerId: cId });
      }
      
      // Create attendance PIN for students
      if (userData.role === 1 && centersToAdd.length > 0) {
        const primaryCenterId = centersToAdd[0];
        const existingPins = await storage.getAttendancePins(primaryCenterId);
        const usedPins = existingPins.map((p: any) => p.pin);
        
        let pin = attendancePin;
        
        // If user provided a PIN, validate it's not already taken
        if (pin && usedPins.includes(pin)) {
          // Delete the user we just created since PIN is invalid
          await storage.deleteUser(user.id);
          return res.status(400).json({ error: "이미 사용 중인 출결번호입니다" });
        }
        
        // If no PIN provided, auto-generate from phone number
        if (!pin && userData.phone) {
          pin = generatePinFromPhone(userData.phone, usedPins);
        }
        
        if (pin) {
          await storage.createAttendancePin({ studentId: user.id, centerId: primaryCenterId, pin });
        }
      }
      
      // Create teacher check-in settings if provided (for teacher roles)
      const teacherCheckInSettings = req.body.teacherCheckInSettings;
      if (teacherCheckInSettings && Array.isArray(teacherCheckInSettings) && (userData.role === 2 || userData.role === 3)) {
        for (const setting of teacherCheckInSettings) {
          const { centerId, checkInCode, smsRecipient1, smsRecipient2 } = setting;
          if (centerId && checkInCode) {
            // Validate check-in code uniqueness (against student PINs and other teacher codes)
            const existingPins = await storage.getAttendancePins(centerId);
            if (existingPins.some((p: any) => p.pin === checkInCode)) {
              await storage.deleteUser(user.id);
              return res.status(400).json({ error: `출근코드 ${checkInCode}가 학생 출결번호와 중복됩니다` });
            }
            
            const existingTeacherSettings = await storage.getAllTeacherCheckInSettings(centerId);
            if (existingTeacherSettings.some((s: any) => s.checkInCode === checkInCode)) {
              await storage.deleteUser(user.id);
              return res.status(400).json({ error: `출근코드 ${checkInCode}가 다른 선생님과 중복됩니다` });
            }
            
            await storage.createTeacherCheckInSettings({
              teacherId: user.id,
              centerId,
              checkInCode,
              smsRecipient1: smsRecipient1 || null,
              smsRecipient2: smsRecipient2 || null,
              isActive: true,
            });
          }
        }
      }
      
      // Create teacher salary settings if provided (for regular/part-time teachers)
      const salarySettings = req.body.salarySettings;
      if (salarySettings && userData.role === 2 && centersToAdd.length > 0) {
        const primaryCenterId = centersToAdd[0];
        await storage.createTeacherSalarySettings({
          teacherId: user.id,
          centerId: primaryCenterId,
          baseSalary: salarySettings.baseSalary || 0,
          classBasePay: 0, // legacy field
          classBasePayMiddle: salarySettings.classBasePayMiddle || 0,
          classBasePayHigh: salarySettings.classBasePayHigh || 0,
          studentThreshold: 0, // legacy field
          studentThresholdMiddle: salarySettings.studentThresholdMiddle || 0,
          studentThresholdHigh: salarySettings.studentThresholdHigh || 0,
          perStudentBonus: 0, // legacy field
          perStudentBonusMiddle: salarySettings.perStudentBonusMiddle || 0,
          perStudentBonusHigh: salarySettings.perStudentBonusHigh || 0,
        });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { centerIds, attendancePin, teacherCheckInSettings: teacherCheckInSettingsData, ...userData } = req.body;
      const userId = req.params.id;
      
      // Update basic user info
      const updatedUser = await storage.updateUser(userId, userData);
      
      // Update center associations if provided
      if (centerIds && Array.isArray(centerIds)) {
        // Remove existing center associations
        const existingCenters = await storage.getUserCenters(userId);
        for (const center of existingCenters) {
          await storage.removeUserFromCenter(userId, center.id);
        }
        // Add new center associations
        for (const centerId of centerIds) {
          await storage.addUserToCenter({ userId, centerId });
        }
      }
      
      // Update attendance PIN if provided (for students)
      // Check the updated user's role, not the request body role
      if (attendancePin && updatedUser.role === 1) {
        console.log("[UPDATE-PIN] Updating attendance PIN for user:", userId, "new PIN:", attendancePin);
        const userCenters = await storage.getUserCenters(userId);
        console.log("[UPDATE-PIN] User centers:", userCenters.length);
        if (userCenters.length > 0) {
          const primaryCenterId = userCenters[0].id;
          // Check if PIN is unique
          const existingPins = await storage.getAttendancePins(primaryCenterId);
          const usedPins = existingPins.filter((p: any) => p.studentId !== userId).map((p: any) => p.pin);
          
          if (usedPins.includes(attendancePin)) {
            return res.status(400).json({ error: "이미 사용 중인 출결번호입니다" });
          }
          
          // Delete existing PIN and create new one
          const existingStudentPin = await storage.getAttendancePinByStudent(userId, primaryCenterId);
          if (existingStudentPin) {
            console.log("[UPDATE-PIN] Deleting existing PIN:", existingStudentPin.id);
            await storage.deleteAttendancePin(existingStudentPin.id);
          }
          await storage.createAttendancePin({ studentId: userId, centerId: primaryCenterId, pin: attendancePin });
          console.log("[UPDATE-PIN] New PIN created successfully");
        }
      }
      
      // Update teacher check-in settings if provided (for teachers)
      if (teacherCheckInSettingsData && Array.isArray(teacherCheckInSettingsData) && 
          (updatedUser.role === 2 || updatedUser.role === 3 || updatedUser.role === 4)) {
        console.log("[UPDATE-TEACHER-CHECKIN] Processing teacher check-in settings for user:", userId);
        for (const setting of teacherCheckInSettingsData) {
          const { centerId, checkInCode, smsRecipient1, smsRecipient2 } = setting;
          
          if (!centerId || !checkInCode) {
            continue;
          }
          
          // Validate checkInCode format
          if (!/^\d{4}$/.test(checkInCode)) {
            return res.status(400).json({ error: "출근코드는 4자리 숫자여야 합니다" });
          }
          
          // Check if code is already used by another teacher
          const existingSettings = await storage.getTeacherCheckInSettingsByCode(centerId, checkInCode);
          if (existingSettings && existingSettings.teacherId !== userId) {
            return res.status(400).json({ error: `출근코드 ${checkInCode}가 다른 선생님과 중복됩니다` });
          }
          
          // Check if this teacher already has settings for this center
          const currentSettings = await storage.getTeacherCheckInSettings(userId, centerId);
          if (currentSettings) {
            // Update existing settings
            await storage.updateTeacherCheckInSettings(currentSettings.id, {
              checkInCode,
              smsRecipient1: smsRecipient1 || null,
              smsRecipient2: smsRecipient2 || null,
            });
            console.log("[UPDATE-TEACHER-CHECKIN] Updated settings for center:", centerId);
          } else {
            // Create new settings
            await storage.createTeacherCheckInSettings({
              teacherId: userId,
              centerId,
              checkInCode,
              smsRecipient1: smsRecipient1 || null,
              smsRecipient2: smsRecipient2 || null,
              isActive: true,
            });
            console.log("[UPDATE-TEACHER-CHECKIN] Created new settings for center:", centerId);
          }
        }
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/users/change-password", async (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user || user.password !== currentPassword) {
        return res.status(400).json({ error: "Invalid current password" });
      }

      await storage.updateUserPassword(userId, newPassword);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Admin/Principal password reset - resets to "1234"
  app.post("/api/users/:id/reset-password", async (req, res) => {
    try {
      const { actorId } = req.body;
      const targetUserId = req.params.id;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      
      // Verify actor exists and has permission
      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Only admin (4) and principal (3) can reset passwords
      if (actor.role !== 3 && actor.role !== 4) {
        return res.status(403).json({ error: "관리자 또는 원장만 비밀번호를 초기화할 수 있습니다" });
      }
      
      // Check target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      // Principal can only reset users with lower role (student, parent)
      // Admin can reset anyone except themselves
      if (actor.role === 3 && targetUser.role >= 3) {
        return res.status(403).json({ error: "원장은 다른 원장이나 관리자의 비밀번호를 초기화할 수 없습니다" });
      }
      
      if (actor.id === targetUserId) {
        return res.status(400).json({ error: "본인의 비밀번호는 설정에서 변경해주세요" });
      }
      
      // Reset password to "1234"
      await storage.updateUserPassword(targetUserId, "1234");
      
      // Also fix username if it has dashes (normalize phone number format)
      if (targetUser.phone && targetUser.username.includes("-")) {
        const normalizedUsername = targetUser.phone.replace(/-/g, "");
        await storage.updateUser(targetUserId, { username: normalizedUsername });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "비밀번호 초기화에 실패했습니다" });
    }
  });

  // Assign homeroom teacher - for admin/principal
  app.patch("/api/users/:studentId/homeroom-teacher", async (req, res) => {
    try {
      const { actorId, teacherId } = req.body;
      const studentId = req.params.studentId;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      
      // Verify actor exists and is admin or principal
      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      if (actor.role !== 3 && actor.role !== 4) {
        return res.status(403).json({ error: "관리자 또는 원장만 담임 선생님을 지정할 수 있습니다" });
      }
      
      // Verify student exists and is a student
      const student = await storage.getUser(studentId);
      if (!student || student.role !== 1) {
        return res.status(400).json({ error: "학생을 찾을 수 없습니다" });
      }
      
      // If teacherId is provided, verify teacher exists and is a teacher
      if (teacherId) {
        const teacher = await storage.getUser(teacherId);
        if (!teacher || teacher.role !== 2) {
          return res.status(400).json({ error: "선생님을 찾을 수 없습니다" });
        }
      }
      
      const updatedUser = await storage.updateUser(studentId, { homeroomTeacherId: teacherId || null });
      res.json(updatedUser);
    } catch (error) {
      console.error("Assign homeroom teacher error:", error);
      res.status(500).json({ error: "담임 선생님 지정에 실패했습니다" });
    }
  });

  // Claim student as homeroom - for teachers only
  app.post("/api/homeroom/claim", async (req, res) => {
    try {
      const { teacherId, studentId } = req.body;
      
      if (!teacherId || !studentId) {
        return res.status(400).json({ error: "teacherId and studentId are required" });
      }
      
      // Verify teacher exists and is a teacher (role=2)
      const teacher = await storage.getUser(teacherId);
      if (!teacher) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      if (teacher.role !== 2) {
        return res.status(403).json({ error: "선생님만 내 학생을 지정할 수 있습니다" });
      }
      
      // Verify student exists and is a student
      const student = await storage.getUser(studentId);
      if (!student || student.role !== 1) {
        return res.status(400).json({ error: "학생을 찾을 수 없습니다" });
      }
      
      // Only allow claiming if student has no homeroom teacher
      if (student.homeroomTeacherId) {
        return res.status(400).json({ error: "이미 담임 선생님이 지정된 학생입니다" });
      }
      
      const updatedUser = await storage.updateUser(studentId, { homeroomTeacherId: teacherId });
      res.json(updatedUser);
    } catch (error) {
      console.error("Claim student error:", error);
      res.status(500).json({ error: "내 학생 지정에 실패했습니다" });
    }
  });

  // Unclaim student - for teachers to remove themselves as homeroom
  app.post("/api/homeroom/unclaim", async (req, res) => {
    try {
      const { teacherId, studentId } = req.body;
      
      if (!teacherId || !studentId) {
        return res.status(400).json({ error: "teacherId and studentId are required" });
      }
      
      // Verify teacher exists and is a teacher
      const teacher = await storage.getUser(teacherId);
      if (!teacher) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      if (teacher.role !== 2) {
        return res.status(403).json({ error: "선생님만 해제할 수 있습니다" });
      }
      
      // Verify student exists and has this teacher as homeroom
      const student = await storage.getUser(studentId);
      if (!student || student.role !== 1) {
        return res.status(400).json({ error: "학생을 찾을 수 없습니다" });
      }
      
      // Only the current homeroom teacher can unclaim
      if (student.homeroomTeacherId !== teacherId) {
        return res.status(403).json({ error: "본인이 담임인 학생만 해제할 수 있습니다" });
      }
      
      const updatedUser = await storage.updateUser(studentId, { homeroomTeacherId: null });
      res.json(updatedUser);
    } catch (error) {
      console.error("Unclaim student error:", error);
      res.status(500).json({ error: "내 학생 해제에 실패했습니다" });
    }
  });

  // Promote all students to next grade (Admin/Principal only)
  app.post("/api/users/promote-grades", async (req, res) => {
    try {
      const { actorId } = req.body;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== 4 && actor.role !== 3)) {
        return res.status(403).json({ error: "관리자 또는 원장만 학년 진급을 실행할 수 있습니다" });
      }
      
      const gradeMap: Record<string, string> = {
        "초1": "초2",
        "초2": "초3",
        "초3": "초4",
        "초4": "초5",
        "초5": "초6",
        "초6": "중1",
        "중1": "중2",
        "중2": "중3",
        "중3": "고1",
        "고1": "고2",
        "고2": "고3",
        "고3": "고3",
      };
      
      const allUsers = await storage.getUsers();
      const students = allUsers.filter(u => u.role === 1 && u.grade);
      
      let promotedCount = 0;
      for (const student of students) {
        const currentGrade = student.grade;
        const nextGrade = currentGrade ? gradeMap[currentGrade] : null;
        
        if (nextGrade && nextGrade !== currentGrade) {
          await storage.updateUser(student.id, { grade: nextGrade });
          promotedCount++;
        }
      }
      
      res.json({ success: true, promotedCount, message: `${promotedCount}명의 학생이 진급되었습니다` });
    } catch (error) {
      console.error("Promote grades error:", error);
      res.status(500).json({ error: "학년 진급에 실패했습니다" });
    }
  });

  app.post("/api/users/bulk-upload", excelUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
      }

      // Dynamic import of XLSX to reduce startup memory
      const XLSX = await import("xlsx");

      const defaultCenterIds = JSON.parse(req.body.centerIds || "[]");
      const ext = path.extname(req.file.originalname).toLowerCase();

      let workbook: any;
      
      // For CSV files, try different encodings
      if (ext === ".csv") {
        const encodings = ["utf-8", "euc-kr", "cp949"];
        let parsed = false;
        
        for (const encoding of encodings) {
          try {
            const decoded = iconv.decode(req.file.buffer, encoding);
            workbook = XLSX.read(decoded, { type: "string" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const testRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
            
            // Check if Korean columns are correctly parsed
            if (testRows.length > 0) {
              const firstRowKeys = Object.keys(testRows[0]);
              const hasKorean = firstRowKeys.some(k => /[가-힣]/.test(k));
              if (hasKorean) {
                parsed = true;
                break;
              }
            }
          } catch (e) {
            // Try next encoding
          }
        }
        
        if (!parsed) {
          // Fallback to default
          const decoded = iconv.decode(req.file.buffer, "euc-kr");
          workbook = XLSX.read(decoded, { type: "string" });
        }
      } else {
        // For Excel files, XLSX handles encoding automatically
        workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      }

      const sheetName = workbook!.SheetNames[0];
      const worksheet = workbook!.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

      if (rows.length === 0) {
        return res.status(400).json({ error: "엑셀 파일에 데이터가 없습니다" });
      }

      const allCenters = await storage.getCenters();
      const centerNameToId = new Map<string, string>();
      for (const center of allCenters) {
        centerNameToId.set(center.name, center.id);
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      const parseCell = (value: any): string | null => {
        if (value === undefined || value === null) return null;
        const str = value.toString().trim();
        if (str === "" || str === "-") return null;
        return str;
      };

      const parsePhone = (value: any): string | null => {
        const str = parseCell(value);
        if (!str) return null;
        let digits = str.replace(/[^0-9]/g, "");
        if (!digits) return null;
        // Excel often strips leading 0 from phone numbers like 01012345678 -> 1012345678
        if (digits.length >= 9 && digits.length <= 11 && !digits.startsWith("0")) {
          digits = "0" + digits;
        }
        return digits;
      };

      // Helper to get value by normalized key (trim whitespace from both key and value)
      const getRowValue = (row: Record<string, any>, ...keys: string[]): any => {
        for (const key of keys) {
          // Check exact match first
          if (row[key] !== undefined) return row[key];
          // Check trimmed keys
          for (const rowKey of Object.keys(row)) {
            if (rowKey.trim() === key) return row[rowKey];
          }
        }
        return undefined;
      };

      for (const row of rows) {
        try {
          const name = parseCell(getRowValue(row, "이름", "이름 ", " 이름", "성명", "학생명", "학생이름"));
          const school = parseCell(getRowValue(row, "학교", "학교명", "학교 ", " 학교"));
          const grade = parseCell(getRowValue(row, "학년", "학년 ", " 학년"));
          const motherPhone = parsePhone(getRowValue(row, "어머니 전화번호", "어머니전화번호", "어머니연락처", "엄마연락처", "어머니 연락처"));
          const fatherPhone = parsePhone(getRowValue(row, "아버지 전화번호", "아버지전화번호", "아버지연락처", "아빠연락처", "아버지 연락처"));
          const studentPhone = parsePhone(getRowValue(row, "학생 전화번호", "학생전화번호", "학생연락처", "전화번호", "연락처", "휴대폰"));
          const centerName = parseCell(getRowValue(row, "센터명", "센터", "지점", "지점명", "센터 "));

          if (!name) {
            // Debug: show what columns were found
            const foundColumns = Object.keys(row).map(k => `"${k}"`).join(", ");
            results.failed++;
            results.errors.push(`이름이 없는 행이 있습니다 (발견된 열: ${foundColumns})`);
            continue;
          }

          // Skip sample data row
          if (name.startsWith("(예시") || name === "홍길동") {
            continue;
          }

          if (!motherPhone && !fatherPhone) {
            results.failed++;
            results.errors.push(`${name}: 어머니 또는 아버지 전화번호가 필요합니다`);
            continue;
          }

          const username = studentPhone || motherPhone || fatherPhone;
          if (!username) {
            results.failed++;
            results.errors.push(`${name}: 전화번호가 없습니다`);
            continue;
          }

          let rowCenterIds: string[] = [];
          if (centerName) {
            const centerId = centerNameToId.get(centerName);
            if (centerId) {
              rowCenterIds = [centerId];
            } else {
              results.failed++;
              results.errors.push(`${name}: 존재하지 않는 센터입니다 (${centerName})`);
              continue;
            }
          } else {
            rowCenterIds = defaultCenterIds;
          }

          if (rowCenterIds.length === 0) {
            results.failed++;
            results.errors.push(`${name}: 센터가 지정되지 않았습니다`);
            continue;
          }

          const existingUser = await storage.getUserByUsername(username);
          if (existingUser) {
            results.failed++;
            results.errors.push(`${name}: 이미 등록된 전화번호입니다 (${username})`);
            continue;
          }

          const user = await storage.createUser({
            username,
            password: "1234",
            name,
            phone: studentPhone || username,
            motherPhone,
            fatherPhone,
            school,
            grade,
            role: UserRole.STUDENT,
          });

          for (const centerId of rowCenterIds) {
            await storage.addUserToCenter({ userId: user.id, centerId });
          }

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`처리 중 오류 발생: ${error.message}`);
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: `엑셀 파일 처리 실패: ${error.message}` });
    }
  });

  // Centers
  app.get("/api/centers", async (req, res) => {
    try {
      const centers = await storage.getCenters();
      res.json(centers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get centers" });
    }
  });

  app.get("/api/centers/stats", async (req, res) => {
    try {
      const stats = await storage.getCenterStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get center stats" });
    }
  });

  app.post("/api/centers", async (req, res) => {
    try {
      const center = await storage.createCenter(req.body);
      res.json(center);
    } catch (error) {
      res.status(500).json({ error: "Failed to create center" });
    }
  });

  app.patch("/api/centers/:id", async (req, res) => {
    try {
      const center = await storage.updateCenter(req.params.id, req.body);
      res.json(center);
    } catch (error) {
      res.status(500).json({ error: "Failed to update center" });
    }
  });

  app.delete("/api/centers/:id", async (req, res) => {
    try {
      await storage.deleteCenter(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete center" });
    }
  });

  app.get("/api/centers/:id/students", async (req, res) => {
    try {
      // Validate center exists
      const center = await storage.getCenter(req.params.id);
      if (!center) {
        return res.json([]); // Return empty array for invalid center
      }
      const students = await storage.getCenterUsers(req.params.id, UserRole.STUDENT);
      res.json(students);
    } catch (error) {
      console.error("[GET students] Error:", error);
      res.status(500).json({ error: "Failed to get students" });
    }
  });

  app.get("/api/centers/:id/teachers", async (req, res) => {
    try {
      // Validate center exists
      const center = await storage.getCenter(req.params.id);
      if (!center) {
        return res.json([]); // Return empty array for invalid center
      }
      // Include both teachers and principals as instructors
      const allUsers = await storage.getCenterUsers(req.params.id);
      const instructors = allUsers.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.PRINCIPAL);
      res.json(instructors);
    } catch (error) {
      console.error("[GET teachers] Error:", error);
      res.status(500).json({ error: "Failed to get teachers" });
    }
  });

  // SOLAPI Credentials (센터별 SMS 설정)
  app.get("/api/centers/:centerId/solapi", async (req, res) => {
    try {
      const credentials = await storage.getSolapiCredentials(req.params.centerId);
      if (!credentials) {
        return res.json({ hasCredentials: false });
      }
      // Return metadata only, not the actual secrets
      res.json({
        hasCredentials: true,
        senderNumber: credentials.senderNumber,
        updatedAt: credentials.updatedAt,
        // Mask the API key and secret
        apiKeyMasked: credentials.apiKey ? "****" + decrypt(credentials.apiKey).slice(-4) : null,
        apiSecretMasked: "********",
      });
    } catch (error) {
      console.error("Failed to get SOLAPI credentials:", error);
      res.status(500).json({ error: "Failed to get SOLAPI credentials" });
    }
  });

  app.put("/api/centers/:centerId/solapi", async (req, res) => {
    try {
      const { apiKey, apiSecret, senderNumber } = req.body;
      if (!apiKey || !apiSecret || !senderNumber) {
        return res.status(400).json({ error: "API Key, API Secret, and Sender Number are required" });
      }
      
      // Encrypt sensitive data before storing
      const encryptedApiKey = encrypt(apiKey);
      const encryptedApiSecret = encrypt(apiSecret);
      
      const credentials = await storage.upsertSolapiCredentials({
        centerId: req.params.centerId,
        apiKey: encryptedApiKey,
        apiSecret: encryptedApiSecret,
        senderNumber,
      });
      
      res.json({
        success: true,
        senderNumber: credentials.senderNumber,
        updatedAt: credentials.updatedAt,
      });
    } catch (error) {
      console.error("Failed to save SOLAPI credentials:", error);
      res.status(500).json({ error: "Failed to save SOLAPI credentials" });
    }
  });

  app.delete("/api/centers/:centerId/solapi", async (req, res) => {
    try {
      await storage.deleteSolapiCredentials(req.params.centerId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete SOLAPI credentials:", error);
      res.status(500).json({ error: "Failed to delete SOLAPI credentials" });
    }
  });

  // Classes
  app.get("/api/classes", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      // Validate center exists if centerId provided
      if (centerId) {
        const center = await storage.getCenter(centerId);
        if (!center) {
          return res.json([]); // Return empty array for invalid center
        }
      }
      const classes = await storage.getClasses(centerId);
      res.json(classes);
    } catch (error) {
      console.error("[GET classes] Error:", error);
      res.status(500).json({ error: "Failed to get classes" });
    }
  });

  app.post("/api/classes", async (req, res) => {
    try {
      const cls = await storage.createClass(req.body);
      res.json(cls);
    } catch (error) {
      res.status(500).json({ error: "Failed to create class" });
    }
  });

  app.patch("/api/classes/:id", async (req, res) => {
    try {
      const updated = await storage.updateClass(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update class" });
    }
  });

  app.delete("/api/classes/:id", async (req, res) => {
    try {
      await storage.deleteClass(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete class" });
    }
  });

  // Class Pricing (교육비) - principal+ only
  app.patch("/api/classes/:id/pricing", async (req, res) => {
    try {
      const { baseFee, additionalFee, actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      // Validate fee values
      const sanitizedBaseFee = typeof baseFee === 'number' && !isNaN(baseFee) && baseFee >= 0 
        ? Math.floor(baseFee) 
        : undefined;
      const sanitizedAdditionalFee = typeof additionalFee === 'number' && !isNaN(additionalFee) && additionalFee >= 0 
        ? Math.floor(additionalFee) 
        : undefined;

      // Verify actor has principal+ role
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 이상만 교육비를 설정할 수 있습니다" });
      }

      // Verify actor belongs to the class's center
      const cls = await storage.getClass(req.params.id);
      if (!cls) {
        return res.status(404).json({ error: "수업을 찾을 수 없습니다" });
      }

      const actorCenters = await storage.getUserCenters(actorId);
      if (!actorCenters.some(c => c.id === cls.centerId)) {
        return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
      }

      const updated = await storage.updateClass(req.params.id, {
        baseFee: sanitizedBaseFee !== undefined ? sanitizedBaseFee : cls.baseFee,
        additionalFee: sanitizedAdditionalFee !== undefined ? sanitizedAdditionalFee : cls.additionalFee,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update class pricing" });
    }
  });

  app.get("/api/classes/:id/students", async (req, res) => {
    try {
      console.log(`[GET class students] classId: ${req.params.id}`);
      const students = await storage.getClassStudents(req.params.id);
      console.log(`[GET class students] Found ${students.length} students`);
      res.json(students);
    } catch (error) {
      console.error(`[GET class students] Error:`, error);
      res.status(500).json({ error: "Failed to get students" });
    }
  });

  // Enrollments
  app.get("/api/enrollments", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "Center ID required" });
      }
      
      // Get all classes for the center
      const allClasses = await storage.getClasses();
      const centerClasses = allClasses.filter((c: any) => c.centerId === centerId);
      const classMap = new Map(centerClasses.map((c: any) => [c.id, c]));
      
      // Get all users for the center to find students
      const centerUsers = await storage.getCenterUsers(centerId);
      const students = centerUsers.filter(u => u.role === UserRole.STUDENT);
      
      // Get enrollments for each student
      const allEnrollments = [];
      for (const student of students) {
        const studentEnrollments = await storage.getStudentEnrollments(student.id);
        for (const enrollment of studentEnrollments) {
          const cls = classMap.get(enrollment.classId);
          if (cls) {
            allEnrollments.push({ ...enrollment, class: cls });
          }
        }
      }
      
      res.json(allEnrollments);
    } catch (error) {
      console.error("Failed to get enrollments:", error);
      res.status(500).json({ error: "Failed to get enrollments" });
    }
  });

  // Get enrollments for a specific class
  app.get("/api/classes/:id/enrollments", async (req, res) => {
    try {
      const classId = req.params.id;
      const enrollments = await storage.getClassEnrollments(classId);
      res.json(enrollments);
    } catch (error) {
      console.error("Failed to get class enrollments:", error);
      res.status(500).json({ error: "Failed to get class enrollments" });
    }
  });

  app.get("/api/students/:id/enrollments", async (req, res) => {
    try {
      const enrollments = await storage.getStudentEnrollments(req.params.id);
      const enrichedEnrollments = await Promise.all(
        enrollments.map(async (e) => {
          const cls = await storage.getClass(e.classId);
          if (cls) {
            const teacher = cls.teacherId ? await storage.getUser(cls.teacherId) : null;
            const center = await storage.getCenter(cls.centerId);
            return { ...e, class: cls, teacher, center };
          }
          return { ...e, class: null, teacher: null, center: null };
        })
      );
      res.json(enrichedEnrollments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get enrollments" });
    }
  });

  app.post("/api/enrollments", async (req, res) => {
    try {
      const { studentId, classId } = req.body;
      
      // Check if already enrolled
      const existing = await storage.getEnrollment(studentId, classId);
      if (existing) {
        return res.status(400).json({ error: "Already enrolled" });
      }

      // Check time conflict
      const cls = await storage.getClass(classId);
      if (!cls) {
        return res.status(404).json({ error: "Class not found" });
      }

      const hasConflict = await storage.checkTimeConflict(studentId, cls);
      if (hasConflict) {
        return res.status(400).json({ error: "이미 같은 시간대에 신청된 수업이 있습니다." });
      }

      const enrollment = await storage.createEnrollment(req.body);
      
      // Auto-register clinic student if class type is a clinic type
      if (cls.classType === "high_clinic" || cls.classType === "middle_clinic") {
        const clinicType = cls.classType === "high_clinic" ? "high" : "middle";
        
        // Check if student already exists for this center AND clinic type
        const existingClinicStudent = await storage.getClinicStudentByStudentCenterAndType(studentId, cls.centerId, clinicType);
        
        if (existingClinicStudent) {
          // Student already registered for this clinic type - just update days if needed
          const existingDays = existingClinicStudent.clinicDays || [];
          const newDays = cls.days || [];
          const mergedDays = Array.from(new Set([...existingDays, ...newDays]));
          
          await storage.updateClinicStudent(existingClinicStudent.id, {
            clinicDays: mergedDays,
            isActive: true, // Reactivate if was inactive
          });
        } else {
          // Get student info to auto-fill grade
          const studentInfo = await storage.getUser(studentId);
          
          // Create new clinic student entry with empty teacher (shows as "미지정")
          await storage.createClinicStudent({
            studentId,
            regularTeacherId: "", // Empty = shows as "미지정"
            clinicTeacherId: null,
            centerId: cls.centerId,
            clinicType: clinicType,
            grade: studentInfo?.grade || null, // Auto-fill grade from student profile
            classGroup: null, // 미등록 (unregistered)
            clinicDays: cls.days || [],
            defaultInstructions: "",
            isActive: true,
          });
        }
      }
      
      res.json(enrollment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create enrollment" });
    }
  });

  app.delete("/api/enrollments/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      // Get enrollment to check class center
      const enrollment = await storage.getEnrollmentById(req.params.id);
      if (!enrollment) {
        return res.status(404).json({ error: "등록 정보를 찾을 수 없습니다" });
      }
      
      const cls = await storage.getClass(enrollment.classId);
      if (!cls) {
        return res.status(404).json({ error: "수업을 찾을 수 없습니다" });
      }
      
      // Students can only delete their own enrollments
      if (actor.role === UserRole.STUDENT) {
        if (enrollment.studentId !== actorId) {
          return res.status(403).json({ error: "본인의 수강 신청만 삭제할 수 있습니다" });
        }
      } else if (actor.role < UserRole.TEACHER) {
        // Parents cannot delete enrollments
        return res.status(403).json({ error: "선생님 이상만 수강 삭제가 가능합니다" });
      } else {
        // Teachers/Principals can only delete within their centers
        const actorCenters = await storage.getUserCenters(actorId);
        if (!actorCenters.some(c => c.id === cls.centerId)) {
          return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
        }
      }
      
      console.log("DELETE enrollment:", req.params.id, "by actor:", actorId);
      await storage.deleteEnrollment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete enrollment:", error);
      res.status(500).json({ error: "Failed to delete enrollment" });
    }
  });

  // Student APIs
  app.get("/api/students/:id/classes", async (req, res) => {
    try {
      const enrollments = await storage.getStudentEnrollments(req.params.id);
      const classes = await Promise.all(
        enrollments.map(async (e) => {
          const cls = await storage.getClass(e.classId);
          if (!cls) return null;
          const teacher = cls.teacherId ? await storage.getUser(cls.teacherId) : null;
          const center = await storage.getCenter(cls.centerId);
          return {
            ...cls,
            enrollmentId: e.id,
            teacher: teacher ? { id: teacher.id, name: teacher.name } : null,
            center: center ? { id: center.id, name: center.name } : null,
          };
        })
      );
      res.json(classes.filter(Boolean));
    } catch (error) {
      res.status(500).json({ error: "Failed to get classes" });
    }
  });

  app.get("/api/students/:id/classes/today", async (req, res) => {
    try {
      const enrollments = await storage.getStudentEnrollments(req.params.id);
      const today = new Date();
      const dayMap: Record<number, string> = {
        0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"
      };
      const todayDay = dayMap[today.getDay()];

      const classes = await Promise.all(
        enrollments.map((e) => storage.getClass(e.classId))
      );

      const todayClasses = classes.filter((c) => c && c.days.includes(todayDay));
      res.json(todayClasses);
    } catch (error) {
      res.status(500).json({ error: "Failed to get today's classes" });
    }
  });

  app.get("/api/students/:id/homework/pending", async (req, res) => {
    try {
      const homework = await storage.getStudentHomework(req.params.id);
      const submissions = await storage.getStudentSubmissions(req.params.id);
      
      const pending = homework.filter((hw) => {
        const sub = submissions.find((s) => s.homeworkId === hw.id);
        return !sub || sub.status === "pending" || sub.status === "resubmit";
      });

      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: "Failed to get pending homework" });
    }
  });

  app.get("/api/students/:id/homework", async (req, res) => {
    try {
      const homework = await storage.getStudentHomework(req.params.id);
      res.json(homework);
    } catch (error) {
      res.status(500).json({ error: "Failed to get homework" });
    }
  });

  app.get("/api/students/:id/homework/submissions", async (req, res) => {
    try {
      const submissions = await storage.getStudentSubmissions(req.params.id);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get submissions" });
    }
  });

  app.get("/api/students/:id/assessments/recent", async (req, res) => {
    try {
      const assessments = await storage.getStudentAssessments(req.params.id);
      res.json(assessments.slice(0, 5));
    } catch (error) {
      res.status(500).json({ error: "Failed to get assessments" });
    }
  });

  app.get("/api/students/:id/assessments", async (req, res) => {
    try {
      const month = req.query.month as string | undefined;
      const assessments = await storage.getStudentAssessments(req.params.id, month);
      res.json(assessments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get assessments" });
    }
  });

  // Parent APIs - Get linked children data (disabled - PARENT role not implemented)
  app.get("/api/parents/:id/children", async (req, res) => {
    try {
      const parent = await storage.getUser(req.params.id);
      if (!parent || parent.role !== UserRole.PARENT) {
        return res.status(404).json({ error: "Parent not found" });
      }

      const linkedStudentIds = parent.linkedStudentIds || [];
      if (linkedStudentIds.length === 0) {
        return res.json([]);
      }

      const children = await Promise.all(
        linkedStudentIds.map(async (studentId) => {
          const child = await storage.getUser(studentId);
          if (!child) return null;

          const enrollments = await storage.getStudentEnrollments(studentId);
          const enrichedEnrollments = await Promise.all(
            enrollments.map(async (e) => {
              const cls = await storage.getClass(e.classId);
              if (cls) {
                const teacher = cls.teacherId ? await storage.getUser(cls.teacherId) : null;
                const center = await storage.getCenter(cls.centerId);
                return { ...e, class: cls, teacher, center };
              }
              return { ...e, class: null, teacher: null, center: null };
            })
          );

          const tuitionPassword = await storage.getTuitionAccessPassword(studentId);
          const hasPassword = !!tuitionPassword;

          return { child, enrollments: enrichedEnrollments, hasPassword };
        })
      );

      res.json(children.filter(Boolean));
    } catch (error) {
      res.status(500).json({ error: "Failed to get children data" });
    }
  });

  // Tuition Access Password APIs
  // Check if password exists for a student
  app.get("/api/students/:id/tuition-password-status", async (req, res) => {
    try {
      const password = await storage.getTuitionAccessPassword(req.params.id);
      res.json({ hasPassword: !!password });
    } catch (error) {
      res.status(500).json({ error: "Failed to check password status" });
    }
  });

  // Set/update password (parent only - must be linked to student)
  app.post("/api/students/:id/tuition-password", async (req, res) => {
    try {
      const { password, parentId } = req.body;
      if (!password || password.length < 4) {
        return res.status(400).json({ error: "비밀번호는 4자리 이상이어야 합니다" });
      }
      if (!parentId) {
        return res.status(400).json({ error: "parentId is required" });
      }

      // Verify parent is linked to this student
      const parent = await storage.getUser(parentId);
      if (!parent || parent.role !== UserRole.PARENT) {
        return res.status(403).json({ error: "학부모 계정만 비밀번호를 설정할 수 있습니다" });
      }

      const linkedStudentIds = parent.linkedStudentIds || [];
      if (!linkedStudentIds.includes(req.params.id)) {
        return res.status(403).json({ error: "연결된 자녀만 비밀번호를 설정할 수 있습니다" });
      }

      const result = await storage.setTuitionAccessPassword(req.params.id, password);
      res.json({ success: true, hasPassword: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to set password" });
    }
  });

  // Verify password (student) - returns success if password matches
  app.post("/api/students/:id/tuition-password/verify", async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "비밀번호를 입력하세요" });
      }

      const stored = await storage.getTuitionAccessPassword(req.params.id);
      if (!stored) {
        // No password set, allow access
        return res.json({ verified: true, noPasswordRequired: true });
      }

      if (stored.password === password) {
        return res.json({ verified: true });
      } else {
        return res.status(401).json({ error: "비밀번호가 일치하지 않습니다" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to verify password" });
    }
  });

  // Delete password (parent only)
  app.delete("/api/students/:id/tuition-password", async (req, res) => {
    try {
      const { parentId } = req.body;
      if (!parentId) {
        return res.status(400).json({ error: "parentId is required" });
      }

      // Verify parent is linked to this student
      const parent = await storage.getUser(parentId);
      if (!parent || parent.role !== UserRole.PARENT) {
        return res.status(403).json({ error: "학부모 계정만 비밀번호를 삭제할 수 있습니다" });
      }

      const linkedStudentIds = parent.linkedStudentIds || [];
      if (!linkedStudentIds.includes(req.params.id)) {
        return res.status(403).json({ error: "연결된 자녀만 비밀번호를 삭제할 수 있습니다" });
      }

      await storage.deleteTuitionAccessPassword(req.params.id);
      res.json({ success: true, hasPassword: false });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete password" });
    }
  });

  // Tuition Guidance APIs (교육비 안내)
  // Get guidance for a center (anyone with center access)
  app.get("/api/centers/:centerId/tuition-guidance", async (req, res) => {
    try {
      const guidance = await storage.getTuitionGuidance(req.params.centerId);
      res.json(guidance || { centerId: req.params.centerId, guidanceText: null, imageUrls: [] });
    } catch (error) {
      res.status(500).json({ error: "Failed to get tuition guidance" });
    }
  });

  // Update guidance for a center (principal/admin only)
  app.put("/api/centers/:centerId/tuition-guidance", async (req, res) => {
    try {
      const { guidanceText, imageUrls, userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 또는 관리자만 교육비 안내를 수정할 수 있습니다" });
      }

      // For principals, verify they have access to this center
      if (user.role === UserRole.PRINCIPAL) {
        const userCenters = await storage.getUserCenters(userId);
        const hasAccess = userCenters.some(c => c.id === req.params.centerId);
        if (!hasAccess) {
          return res.status(403).json({ error: "해당 센터에 대한 권한이 없습니다" });
        }
      }

      const result = await storage.upsertTuitionGuidance(req.params.centerId, {
        guidanceText,
        imageUrls,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update tuition guidance" });
    }
  });

  // Tuition Notification APIs (교육비 안내 문자)
  
  // Get notification history for a center
  app.get("/api/centers/:centerId/tuition-notifications", async (req, res) => {
    try {
      const notifications = await storage.getTuitionNotifications(req.params.centerId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tuition notifications" });
    }
  });

  // Send tuition notification SMS to parent
  app.post("/api/tuition-notifications/send", async (req, res) => {
    try {
      const { 
        studentId, 
        parentId, 
        centerId, 
        senderId,
        calculatedTotal,
        sentAmount,
        feeBreakdown,
        paymentMethod,
        messageContent,
        recipientPhone,
        recipientType
      } = req.body;

      if (!studentId || !centerId || !senderId || !recipientPhone) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }

      // Verify sender is principal or admin
      const sender = await storage.getUser(senderId);
      if (!sender || sender.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 또는 관리자만 교육비 안내 문자를 보낼 수 있습니다" });
      }

      // Get student info
      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ error: "학생을 찾을 수 없습니다" });
      }

      // Get center info
      const center = await storage.getCenter(centerId);
      if (!center) {
        return res.status(404).json({ error: "센터를 찾을 수 없습니다" });
      }

      // Use the message content provided by the client (editable by user)
      if (!messageContent) {
        return res.status(400).json({ error: "문자 내용이 누락되었습니다" });
      }

      // Send SMS via SOLAPI
      const { sendSms } = await import("./services/solapi");
      const smsResult = await sendSms({
        to: recipientPhone.replace(/-/g, ""),
        text: messageContent,
        centerName: center.name,
      });

      // Record the notification
      const notification = await storage.createTuitionNotification({
        studentId,
        parentId: parentId || null,
        centerId,
        sentById: senderId,
        calculatedTotal,
        sentAmount,
        feeBreakdown: JSON.stringify(feeBreakdown),
        paymentMethod,
        paymentDetails: "",
        messageContent,
        recipientPhone,
        recipientType: recipientType || null,
        status: smsResult.success ? "sent" : "failed",
        errorMessage: smsResult.error,
      });

      if (!smsResult.success) {
        return res.status(500).json({ 
          error: "문자 발송에 실패했습니다", 
          details: smsResult.error,
          notification 
        });
      }

      res.json({ success: true, notification });
    } catch (error: any) {
      console.error("Failed to send tuition notification:", error);
      res.status(500).json({ error: "문자 발송에 실패했습니다", details: error.message });
    }
  });

  // Notifications API
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to get notification count" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const userId = req.body.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Get homework due reminders for students
  app.get("/api/notifications/homework-reminders", async (req, res) => {
    try {
      const studentId = req.query.studentId as string;
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required" });
      }
      
      const today = new Date().toISOString().split("T")[0];
      const homeworkList = await storage.getStudentHomework(studentId);
      const submissions = await storage.getStudentSubmissions(studentId);
      
      // Filter homework due today that hasn't been submitted
      const dueToday = homeworkList.filter(hw => {
        const isToday = hw.dueDate === today;
        const submission = submissions.find(s => s.homeworkId === hw.id);
        const notSubmitted = !submission || (submission.status !== "submitted" && submission.status !== "reviewed");
        return isToday && notSubmitted;
      });
      
      res.json(dueToday);
    } catch (error) {
      res.status(500).json({ error: "Failed to get homework reminders" });
    }
  });

  // Dashboard Analytics APIs
  
  // Get monthly student trends for admin/principal dashboard
  app.get("/api/dashboard/student-trends", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const actorId = req.query.actorId as string;
      
      if (!centerId || !actorId) {
        return res.status(400).json({ error: "centerId and actorId are required" });
      }
      
      // Verify actor is admin or principal
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== 3 && actor.role !== 4)) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Optimized: only load students in this specific center
      const centerUsers = await storage.getCenterUsers(centerId, UserRole.STUDENT);
      const studentsInCenter = centerUsers;
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-indexed month
      
      // Build actual monthly counts based on createdAt timestamps
      // Count students that existed at the end of each month
      const getStudentCountAtMonth = (year: number, month: number): number => {
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);
        return studentsInCenter.filter(s => {
          const createdAt = s.createdAt ? new Date(s.createdAt) : new Date(0);
          return createdAt <= endOfMonth;
        }).length;
      };
      
      // Check if we have any students from last year
      const lastYear = currentYear - 1;
      const hasLastYearData = studentsInCenter.some(s => {
        const createdAt = s.createdAt ? new Date(s.createdAt) : new Date(0);
        return createdAt.getFullYear() <= lastYear;
      });
      
      // Generate monthly data for current year (January to current month only)
      const monthlyData = [];
      for (let month = 1; month <= currentMonth; month++) {
        const count = getStudentCountAtMonth(currentYear, month);
        const lastYearCount = hasLastYearData ? getStudentCountAtMonth(lastYear, month) : 0;
        
        monthlyData.push({
          month,
          year: currentYear,
          label: `${month}월`,
          count,
          lastYearCount: hasLastYearData ? lastYearCount : null,
          delta: hasLastYearData ? count - lastYearCount : 0,
          deltaPercent: hasLastYearData && lastYearCount > 0 
            ? Math.round((count - lastYearCount) / lastYearCount * 100) 
            : 0
        });
      }
      
      res.json({
        currentTotal: studentsInCenter.length,
        currentYear,
        lastYear,
        hasLastYearData,
        monthlyData,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Get student trends error:", error);
      res.status(500).json({ error: "Failed to get student trends" });
    }
  });

  // Teacher APIs
  
  // Get teachers (for homeroom assignment dropdown and todo assignment)
  app.get("/api/teachers", async (req, res) => {
    try {
      // Get all users with role >= TEACHER (includes teachers and principals)
      const allUsers = await storage.getUsers();
      const staff = allUsers.filter((u: any) => u.role >= UserRole.TEACHER);
      
      res.json(staff);
    } catch (error) {
      console.error("Get teachers error:", error);
      res.status(500).json({ error: "Failed to get teachers" });
    }
  });

  app.get("/api/teachers/:id/stats", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "Center ID required" });
      }

      const teacherId = req.params.id;
      const teacher = await storage.getUser(teacherId);
      const classes = await storage.getClasses(centerId);
      const teacherClasses = classes.filter((c) => c.teacherId === teacherId);
      
      const today = new Date();
      const dayMap: Record<number, string> = {
        0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"
      };
      const todayDay = dayMap[today.getDay()];
      const todayClasses = teacherClasses.filter((c) => c.days.includes(todayDay)).length;

      // Get unique students based on role
      const studentIds = new Set<string>();
      
      // Get students enrolled in teacher's classes
      for (const cls of teacherClasses) {
        const classEnrollments = await storage.getClassEnrollments(cls.id);
        classEnrollments.forEach((e) => studentIds.add(e.studentId));
      }
      const totalStudents = studentIds.size;

      // Filter submissions to only include relevant students
      const submissions = await storage.getSubmissionsByCenter(centerId);
      const pendingReviews = submissions.filter(
        (s) => s.status === "submitted" && studentIds.has(s.studentId)
      ).length;

      const assessmentClasses = teacherClasses.filter((c) => c.classType === "assessment").length;

      res.json({
        todayClasses,
        pendingReviews,
        totalStudents,
        pendingAssessments: assessmentClasses,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/teachers/:id/students", async (req, res) => {
    try {
      const teacherId = req.params.id;
      const teacher = await storage.getUser(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }

      const centers = await storage.getUserCenters(teacherId);
      const studentMap = new Map<string, any>();

      for (const center of centers) {
        const classes = await storage.getClasses(center.id);
        const teacherClasses = classes.filter((c) => c.teacherId === teacherId);

        for (const cls of teacherClasses) {
          const classEnrollments = await storage.getClassEnrollments(cls.id);
          for (const enrollment of classEnrollments) {
            if (!studentMap.has(enrollment.studentId)) {
              const student = await storage.getUser(enrollment.studentId);
              if (student) {
                studentMap.set(enrollment.studentId, student);
              }
            }
          }
        }
      }

      res.json(Array.from(studentMap.values()));
    } catch (error) {
      res.status(500).json({ error: "Failed to get teacher's students" });
    }
  });

  app.get("/api/teachers/:id/submissions/recent", async (req, res) => {
    try {
      const teacherId = req.params.id;
      const user = await storage.getUser(teacherId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const centers = await storage.getUserCenters(user.id);
      
      const teacherStudentIds = new Set<string>();
      
      // Get students from teacher's classes
      for (const center of centers) {
        const classes = await storage.getClasses(center.id);
        const teacherClasses = classes.filter((c) => c.teacherId === teacherId);
        for (const cls of teacherClasses) {
          const enrollments = await storage.getClassEnrollments(cls.id);
          enrollments.forEach((e) => teacherStudentIds.add(e.studentId));
        }
      }

      const allSubmissions: any[] = [];
      for (const center of centers) {
        const submissions = await storage.getSubmissionsByCenter(center.id);
        allSubmissions.push(...submissions);
      }

      const recent = allSubmissions
        .filter((s) => s.status === "submitted" && teacherStudentIds.has(s.studentId))
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
        .slice(0, 10);

      res.json(recent);
    } catch (error) {
      res.status(500).json({ error: "Failed to get submissions" });
    }
  });

  // Homework
  app.get("/api/homework", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      if (centerId) {
        // Validate center exists
        const center = await storage.getCenter(centerId);
        if (!center) {
          return res.json([]); // Return empty array for invalid center
        }
        const homework = await storage.getHomeworkByCenter(centerId);
        res.json(homework);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("[GET homework] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to get homework", details: error?.message });
    }
  });

  app.post("/api/homework", async (req, res) => {
    try {
      const homework = await storage.createHomework(req.body);
      res.json(homework);
    } catch (error) {
      res.status(500).json({ error: "Failed to create homework" });
    }
  });

  // Bulk homework creation for multiple students
  app.post("/api/homework/bulk", async (req, res) => {
    try {
      const { studentIds, ...homeworkData } = req.body;
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "studentIds array is required" });
      }
      
      const createdHomework = [];
      for (const studentId of studentIds) {
        const homework = await storage.createHomework({
          ...homeworkData,
          studentId,
        });
        createdHomework.push(homework);
      }
      
      res.json(createdHomework);
    } catch (error) {
      console.error("Failed to create bulk homework:", error);
      res.status(500).json({ error: "Failed to create bulk homework" });
    }
  });

  app.patch("/api/homework/:id", async (req, res) => {
    try {
      const homework = await storage.updateHomework(req.params.id, req.body);
      res.json(homework);
    } catch (error) {
      res.status(500).json({ error: "Failed to update homework" });
    }
  });

  app.delete("/api/homework/:id", async (req, res) => {
    try {
      await storage.deleteHomework(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete homework" });
    }
  });

  app.get("/api/homework/:id/unsubmitted", async (req, res) => {
    try {
      console.log(`[UNSUBMITTED] Fetching unsubmitted for homework: ${req.params.id}`);
      const homework = await storage.getHomework(req.params.id);
      if (!homework) {
        console.log("[UNSUBMITTED] Homework not found");
        return res.status(404).json({ error: "Homework not found" });
      }
      
      const classData = await storage.getClass(homework.classId);
      console.log(`[UNSUBMITTED] Class: ${classData?.name}, centerId: ${classData?.centerId}`);
      const classStudents = await storage.getClassStudents(homework.classId);
      console.log(`[UNSUBMITTED] Class students count: ${classStudents.length}`, classStudents.map(s => s.name));
      const allSubmissions = await storage.getSubmissionsByCenter(classData?.centerId || "");
      
      const homeworkSubmissions = allSubmissions.filter((s: any) => s.homeworkId === homework.id);
      console.log(`[UNSUBMITTED] Submissions for this homework: ${homeworkSubmissions.length}`);
      const submittedStudentIds = new Set(homeworkSubmissions.map((s: any) => s.studentId));
      
      const unsubmittedStudents = classStudents.filter((s: any) => !submittedStudentIds.has(s.id));
      console.log(`[UNSUBMITTED] Unsubmitted students: ${unsubmittedStudents.length}`, unsubmittedStudents.map(s => s.name));
      
      res.json(unsubmittedStudents);
    } catch (error) {
      console.error("Failed to get unsubmitted students:", error);
      res.status(500).json({ error: "Failed to get unsubmitted students" });
    }
  });

  app.get("/api/homework/submissions", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      console.log(`[GET submissions] centerId: ${centerId}`);
      if (centerId) {
        const submissions = await storage.getSubmissionsByCenter(centerId);
        console.log(`[GET submissions] Found ${submissions.length} submissions`);
        res.json(submissions);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("[GET submissions] Error:", error?.message || error, error?.stack);
      res.status(500).json({ error: "Failed to get submissions", details: error?.message });
    }
  });

  app.post("/api/homework-submissions", async (req, res) => {
    try {
      const { homeworkId, studentId, status } = req.body;
      console.log(`[POST submission] homeworkId: ${homeworkId}, studentId: ${studentId}, status: ${status}`);
      
      // Check if submission already exists for this homework and student
      const existingSubmission = await storage.getSubmissionByHomeworkAndStudent(homeworkId, studentId);
      console.log(`[POST submission] Existing submission: ${existingSubmission ? existingSubmission.id : 'none'}`);
      
      if (existingSubmission) {
        // Update existing submission instead of creating duplicate
        const updated = await storage.updateSubmission(existingSubmission.id, req.body);
        console.log(`[POST submission] Updated existing: ${updated.id}, status: ${updated.status}`);
        
        // If status changed to submitted, notify teacher/principal
        if (status === "submitted" && existingSubmission.status !== "submitted") {
          await createHomeworkSubmissionNotifications(homeworkId, studentId);
        }
        
        return res.json(updated);
      }
      
      const submission = await storage.createSubmission(req.body);
      console.log(`[POST submission] Created new: ${submission.id}, status: ${submission.status}`);
      
      // If submitted, notify teacher/principal
      if (status === "submitted") {
        await createHomeworkSubmissionNotifications(homeworkId, studentId);
      }
      
      res.json(submission);
    } catch (error) {
      console.error("Failed to create submission:", error);
      res.status(500).json({ error: "Failed to create submission" });
    }
  });

  app.patch("/api/homework-submissions/:id", async (req, res) => {
    try {
      console.log(`[PATCH submission] ID: ${req.params.id}, Body:`, JSON.stringify(req.body));
      
      // Get existing submission to check status change
      const existingSubmission = await storage.getSubmission(req.params.id);
      const submission = await storage.updateSubmission(req.params.id, req.body);
      
      // If status changed to submitted, notify teacher/principal
      if (req.body.status === "submitted" && existingSubmission?.status !== "submitted") {
        await createHomeworkSubmissionNotifications(submission.homeworkId, submission.studentId);
      }
      
      console.log(`[PATCH submission] Success:`, JSON.stringify(submission));
      res.json(submission);
    } catch (error: any) {
      console.error(`[PATCH submission] Error for ID ${req.params.id}:`, error?.message || error);
      res.status(500).json({ error: "Failed to update submission", details: error?.message });
    }
  });

  // Get photos for a specific submission (loaded separately to reduce memory usage)
  app.get("/api/homework-submissions/:id/photos", async (req, res) => {
    try {
      const photos = await storage.getSubmissionPhotos(req.params.id);
      res.json({ photos });
    } catch (error: any) {
      console.error(`[GET submission photos] Error for ID ${req.params.id}:`, error?.message || error);
      res.status(500).json({ error: "Failed to get photos", details: error?.message });
    }
  });

  // Helper function to create notifications for homework submission
  async function createHomeworkSubmissionNotifications(homeworkId: string, studentId: string) {
    try {
      const homework = await storage.getHomework(homeworkId);
      const student = await storage.getUser(studentId);
      
      if (!homework || !student) return;
      
      const classInfo = await storage.getClass(homework.classId);
      if (!classInfo) return;
      
      // Get teacher of the class
      if (classInfo.teacherId) {
        const teacher = await storage.getUser(classInfo.teacherId);
        if (teacher) {
          await storage.createNotification({
            userId: teacher.id,
            type: "homework_submitted",
            title: "숙제 제출",
            message: `${student.name} 학생이 "${homework.title}" 숙제를 제출했습니다.`,
            relatedId: homeworkId,
            relatedType: "homework",
          });
        }
      }
      
      // Also notify principals in the center
      const centerUsers = await storage.getCenterUsers(classInfo.centerId);
      const principals = centerUsers.filter(u => u.role === UserRole.PRINCIPAL);
      
      for (const principal of principals) {
        await storage.createNotification({
          userId: principal.id,
          type: "homework_submitted",
          title: "숙제 제출",
          message: `${student.name} 학생이 "${homework.title}" 숙제를 제출했습니다.`,
          relatedId: homeworkId,
          relatedType: "homework",
        });
      }
    } catch (error) {
      console.error("Failed to create homework submission notifications:", error);
    }
  }

  // Assessments
  app.get("/api/assessments", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      if (centerId) {
        const assessments = await storage.getAssessmentsByCenter(centerId);
        res.json(assessments);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to get assessments" });
    }
  });

  app.post("/api/assessments/bulk", async (req, res) => {
    try {
      const { assessments } = req.body;
      const created = await storage.createAssessments(assessments);
      res.json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to create assessments" });
    }
  });

  app.patch("/api/assessments/:id", async (req, res) => {
    try {
      const { score, maxScore, actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 평가 점수를 수정할 수 있습니다" });
      }

      const updated = await storage.updateAssessment(req.params.id, { score, maxScore });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update assessment" });
    }
  });

  app.delete("/api/assessments/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 평가 점수를 삭제할 수 있습니다" });
      }

      await storage.deleteAssessment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete assessment" });
    }
  });

  // Class Videos
  app.get("/api/class-videos", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const videos = await storage.getClassVideos(centerId);
      res.json(videos);
    } catch (error) {
      res.status(500).json({ error: "Failed to get videos" });
    }
  });

  app.post("/api/class-videos", async (req, res) => {
    try {
      const video = await storage.createClassVideo(req.body);
      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Failed to create video" });
    }
  });

  app.patch("/api/class-videos/:id", async (req, res) => {
    try {
      const video = await storage.updateClassVideo(req.params.id, req.body);
      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Failed to update video" });
    }
  });

  app.delete("/api/class-videos/:id", async (req, res) => {
    try {
      await storage.deleteClassVideo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete video" });
    }
  });

  // Textbooks
  app.get("/api/textbooks", async (req, res) => {
    try {
      const textbooks = await storage.getTextbooks();
      res.json(textbooks);
    } catch (error) {
      res.status(500).json({ error: "Failed to get textbooks" });
    }
  });

  app.post("/api/textbooks", async (req, res) => {
    try {
      const textbook = await storage.createTextbook(req.body);
      res.json(textbook);
    } catch (error) {
      res.status(500).json({ error: "Failed to create textbook" });
    }
  });

  app.patch("/api/textbooks/:id", async (req, res) => {
    try {
      const textbook = await storage.updateTextbook(req.params.id, req.body);
      res.json(textbook);
    } catch (error) {
      res.status(500).json({ error: "Failed to update textbook" });
    }
  });

  app.delete("/api/textbooks/:id", async (req, res) => {
    try {
      await storage.deleteTextbook(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete textbook" });
    }
  });

  // Textbook Videos
  app.get("/api/textbook-videos/:textbookId", async (req, res) => {
    try {
      const videos = await storage.getTextbookVideos(req.params.textbookId);
      res.json(videos);
    } catch (error) {
      res.status(500).json({ error: "Failed to get textbook videos" });
    }
  });

  app.post("/api/textbook-videos", async (req, res) => {
    try {
      const video = await storage.createTextbookVideo(req.body);
      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Failed to create textbook video" });
    }
  });

  app.patch("/api/textbook-videos/:id", async (req, res) => {
    try {
      const video = await storage.updateTextbookVideo(req.params.id, req.body);
      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Failed to update textbook video" });
    }
  });

  app.delete("/api/textbook-videos/:id", async (req, res) => {
    try {
      await storage.deleteTextbookVideo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete textbook video" });
    }
  });

  // ========== CLINIC ROUTES ==========

  // Get clinic assignments
  app.get("/api/clinic-assignments", async (req, res) => {
    try {
      const { centerId, regularTeacherId, clinicTeacherId, studentId } = req.query;
      const assignments = await storage.getClinicAssignments({
        centerId: centerId as string | undefined,
        regularTeacherId: regularTeacherId as string | undefined,
        clinicTeacherId: clinicTeacherId as string | undefined,
        studentId: studentId as string | undefined,
      });
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic assignments" });
    }
  });

  // Get single clinic assignment
  app.get("/api/clinic-assignments/:id", async (req, res) => {
    try {
      const assignment = await storage.getClinicAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic assignment" });
    }
  });

  // Create clinic assignment with steps
  app.post("/api/clinic-assignments", async (req, res) => {
    try {
      const { steps, ...assignmentData } = req.body;
      const assignment = await storage.createClinicAssignment(assignmentData);
      
      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          await storage.createClinicAssignmentStep({
            assignmentId: assignment.id,
            stepOrder: i + 1,
            instruction: steps[i].instruction,
          });
        }
      }
      
      const fullAssignment = await storage.getClinicAssignment(assignment.id);
      res.json(fullAssignment);
    } catch (error) {
      console.error("Failed to create clinic assignment:", error);
      res.status(500).json({ error: "Failed to create clinic assignment" });
    }
  });

  // Update clinic assignment
  app.patch("/api/clinic-assignments/:id", async (req, res) => {
    try {
      const assignment = await storage.updateClinicAssignment(req.params.id, req.body);
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update clinic assignment" });
    }
  });

  // Delete clinic assignment
  app.delete("/api/clinic-assignments/:id", async (req, res) => {
    try {
      await storage.deleteClinicAssignment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete clinic assignment" });
    }
  });

  // Add step to clinic assignment
  app.post("/api/clinic-assignments/:id/steps", async (req, res) => {
    try {
      const step = await storage.createClinicAssignmentStep({
        ...req.body,
        assignmentId: req.params.id,
      });
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to create step" });
    }
  });

  // Update step
  app.patch("/api/clinic-steps/:id", async (req, res) => {
    try {
      const step = await storage.updateClinicAssignmentStep(req.params.id, req.body);
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  // Delete step
  app.delete("/api/clinic-steps/:id", async (req, res) => {
    try {
      await storage.deleteClinicAssignmentStep(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete step" });
    }
  });

  // Upload file for clinic assignment
  app.post("/api/clinic-assignments/:id/files", clinicUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const ext = path.extname(req.file.originalname).toLowerCase();
      const fileType = ext === ".pdf" ? "pdf" : "image";
      
      const file = await storage.createClinicAssignmentFile({
        assignmentId: req.params.id,
        stepId: req.body.stepId || null,
        fileName: req.file.originalname,
        filePath: `/uploads/clinic/${req.file.filename}`,
        fileType,
      });
      res.json(file);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Delete file
  app.delete("/api/clinic-files/:id", async (req, res) => {
    try {
      await storage.deleteClinicAssignmentFile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Add comment to clinic assignment
  app.post("/api/clinic-assignments/:id/comments", async (req, res) => {
    try {
      const comment = await storage.createClinicComment({
        ...req.body,
        assignmentId: req.params.id,
      });
      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Delete comment
  app.delete("/api/clinic-comments/:id", async (req, res) => {
    try {
      await storage.deleteClinicComment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Get progress logs
  app.get("/api/clinic-assignments/:id/progress", async (req, res) => {
    try {
      const logs = await storage.getClinicProgressLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get progress logs" });
    }
  });

  // Add progress log
  app.post("/api/clinic-assignments/:id/progress", async (req, res) => {
    try {
      const log = await storage.createClinicProgressLog({
        ...req.body,
        assignmentId: req.params.id,
      });
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to create progress log" });
    }
  });

  // Update progress log
  app.patch("/api/clinic-progress/:id", async (req, res) => {
    try {
      const log = await storage.updateClinicProgressLog(req.params.id, req.body);
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to update progress log" });
    }
  });

  // ===== NEW CLINIC SYSTEM (Weekly Workflow) =====

  // Get clinic students by center
  app.get("/api/clinic-students", async (req, res) => {
    try {
      const { centerId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const students = await storage.getClinicStudents(centerId as string);
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic students" });
    }
  });

  // Get single clinic student
  app.get("/api/clinic-students/:id", async (req, res) => {
    try {
      const student = await storage.getClinicStudent(req.params.id);
      if (!student) {
        return res.status(404).json({ error: "Clinic student not found" });
      }
      res.json(student);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic student" });
    }
  });

  // Create clinic student
  app.post("/api/clinic-students", async (req, res) => {
    try {
      const { period1Default, period2Default, period3Default, ...studentData } = req.body;
      
      // Ensure clinicDays is always an array (never null)
      if (!studentData.clinicDays) {
        studentData.clinicDays = [];
      }
      
      const student = await storage.createClinicStudent(studentData);
      
      // Create instruction defaults for each selected day if any period defaults are provided
      // Wrapped in try-catch to handle case where period1_default column doesn't exist in production
      if ((period1Default || period2Default || period3Default) && studentData.clinicDays?.length) {
        try {
          for (const day of studentData.clinicDays) {
            await storage.upsertClinicInstructionDefault({
              clinicStudentId: student.id,
              weekday: day,
              period1Default: period1Default || null,
              period2Default: period2Default || null,
              period3Default: period3Default || null,
            });
          }
        } catch (defaultsError) {
          // Log but don't fail - instruction defaults are optional
          console.warn("Failed to create instruction defaults (column may not exist):", defaultsError);
        }
      }
      
      res.json(student);
    } catch (error) {
      console.error("Failed to create clinic student:", error);
      res.status(500).json({ error: "Failed to create clinic student" });
    }
  });

  // Sync students enrolled in clinic classes to clinic_students table
  app.post("/api/clinic-students/sync", async (req, res) => {
    try {
      const { centerId } = req.body;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      // Get all clinic-type classes in this center
      const allClasses = await storage.getClasses(centerId);
      const clinicClasses = allClasses.filter(c => c.classType === "high_clinic" || c.classType === "middle_clinic");

      let syncedCount = 0;

      for (const cls of clinicClasses) {
        // Get enrollments for this class
        const classEnrollments = await storage.getClassEnrollments(cls.id);
        const clinicType = cls.classType === "high_clinic" ? "high" : "middle";
        
        for (const enrollment of classEnrollments) {
          const existingClinicStudent = await storage.getClinicStudentByStudentCenterAndType(
            enrollment.studentId, 
            cls.centerId,
            clinicType
          );

          if (existingClinicStudent) {
            // Merge clinic days
            const existingDays = existingClinicStudent.clinicDays || [];
            const newDays = cls.days || [];
            const mergedDays = Array.from(new Set([...existingDays, ...newDays]));
            
            if (mergedDays.length > existingDays.length) {
              await storage.updateClinicStudent(existingClinicStudent.id, {
                clinicDays: mergedDays,
                isActive: true,
              });
              syncedCount++;
            }
          } else {
            // Get student info to auto-fill grade
            const studentInfo = await storage.getUser(enrollment.studentId);
            
            // Create new clinic student entry with empty teacher (shows as "미지정")
            await storage.createClinicStudent({
              studentId: enrollment.studentId,
              regularTeacherId: "", // Empty = shows as "미지정"
              clinicTeacherId: null,
              centerId: cls.centerId,
              clinicType: clinicType,
              grade: studentInfo?.grade || null, // Auto-fill grade from student profile
              classGroup: null, // 미등록 (unregistered)
              clinicDays: cls.days || [],
              defaultInstructions: "",
              isActive: true,
            });
            syncedCount++;
          }
        }
      }

      res.json({ success: true, syncedCount });
    } catch (error) {
      console.error("Failed to sync clinic students:", error);
      res.status(500).json({ error: "Failed to sync clinic students" });
    }
  });

  // Update clinic student
  app.patch("/api/clinic-students/:id", async (req, res) => {
    try {
      const student = await storage.updateClinicStudent(req.params.id, req.body);
      res.json(student);
    } catch (error) {
      res.status(500).json({ error: "Failed to update clinic student" });
    }
  });

  // Delete clinic student
  app.delete("/api/clinic-students/:id", async (req, res) => {
    try {
      await storage.deleteClinicStudent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete clinic student" });
    }
  });

  // Get weekly records for a clinic student
  app.get("/api/clinic-weekly-records", async (req, res) => {
    try {
      const { clinicStudentId, centerId, weekStartDate, year, month } = req.query;
      
      // Month-based fetching (for viewing all records in a month)
      if (centerId && year && month) {
        const records = await storage.getClinicWeeklyRecordsByMonth(
          centerId as string,
          parseInt(year as string),
          parseInt(month as string)
        );
        return res.json(records);
      }
      
      // Week-based fetching (legacy, for specific week)
      if (centerId && weekStartDate) {
        const records = await storage.getClinicWeeklyRecordsByCenter(
          centerId as string,
          weekStartDate as string
        );
        return res.json(records);
      }
      
      if (clinicStudentId) {
        const records = await storage.getClinicWeeklyRecords(
          clinicStudentId as string,
          weekStartDate as string | undefined
        );
        return res.json(records);
      }
      
      res.status(400).json({ error: "clinicStudentId or centerId is required" });
    } catch (error) {
      res.status(500).json({ error: "Failed to get weekly records" });
    }
  });

  // Get single weekly record
  app.get("/api/clinic-weekly-records/:id", async (req, res) => {
    try {
      const record = await storage.getClinicWeeklyRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Weekly record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to get weekly record" });
    }
  });

  // Create weekly record
  app.post("/api/clinic-weekly-records", async (req, res) => {
    try {
      const { clinicStudentId, centerId, weekStartDate } = req.body;
      
      // Validate that the clinic student exists and belongs to the specified center
      let clinicStudent = null;
      if (clinicStudentId) {
        clinicStudent = await storage.getClinicStudent(clinicStudentId);
        if (!clinicStudent) {
          return res.status(404).json({ error: "Clinic student not found" });
        }
        if (centerId && clinicStudent.centerId !== centerId) {
          return res.status(403).json({ error: "Clinic student does not belong to the specified center" });
        }
      }
      
      // Try to get previous week's record to carry over all instructions
      let carryOverData: any = {};
      if (clinicStudentId && weekStartDate) {
        const currentDate = new Date(weekStartDate);
        const previousWeekDate = new Date(currentDate);
        previousWeekDate.setDate(previousWeekDate.getDate() - 7);
        const previousWeekStartDate = previousWeekDate.toISOString().split('T')[0];
        
        const previousRecords = await storage.getClinicWeeklyRecords(clinicStudentId, previousWeekStartDate);
        if (previousRecords.length > 0) {
          const prev = previousRecords[0];
          carryOverData = {
            clinicTeacherNotes: prev.clinicTeacherNotes || null,
            weeklyEvaluation: prev.weeklyEvaluation || null,
            period2Instruction: prev.period2Instruction || null,
            period3Instruction: prev.period3Instruction || null,
          };
        }
      }
      
      const record = await storage.createClinicWeeklyRecord({
        ...carryOverData,
        ...req.body,
      });
      res.json(record);
    } catch (error: any) {
      console.error("Failed to create weekly record:", error);
      res.status(500).json({ error: "Failed to create weekly record", details: error?.message });
    }
  });

  // Update weekly record
  app.patch("/api/clinic-weekly-records/:id", async (req, res) => {
    try {
      const record = await storage.updateClinicWeeklyRecord(req.params.id, req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Failed to update weekly record:", error);
      res.status(500).json({ error: "Failed to update weekly record", details: error?.message });
    }
  });

  // Delete weekly record
  app.delete("/api/clinic-weekly-records/:id", async (req, res) => {
    try {
      await storage.deleteClinicWeeklyRecord(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete weekly record" });
    }
  });

  // Upload file for weekly record
  app.post("/api/clinic-weekly-records/:id/file", clinicUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Verify the record exists before updating
      const existingRecord = await storage.getClinicWeeklyRecord(req.params.id);
      if (!existingRecord) {
        return res.status(404).json({ error: "Weekly record not found" });
      }
      
      const record = await storage.updateClinicWeeklyRecord(req.params.id, {
        filePath: `/uploads/clinic/${file.filename}`,
        fileName: file.originalname,
      });
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Batch create weekly records for all clinic students (for a specific week)
  app.post("/api/clinic-weekly-records/batch", async (req, res) => {
    try {
      const { centerId, weekStartDate } = req.body;
      if (!centerId || !weekStartDate) {
        return res.status(400).json({ error: "centerId and weekStartDate are required" });
      }

      const clinicStudentsList = await storage.getClinicStudents(centerId);
      const existingRecords = await storage.getClinicWeeklyRecordsByCenter(centerId, weekStartDate);
      const existingClinicStudentIds = new Set(existingRecords.map(r => r.clinicStudentId));

      // Get previous week's records to carry over all instructions
      const currentDate = new Date(weekStartDate);
      const previousWeekDate = new Date(currentDate);
      previousWeekDate.setDate(previousWeekDate.getDate() - 7);
      const previousWeekStartDate = previousWeekDate.toISOString().split('T')[0];
      
      const previousRecords = await storage.getClinicWeeklyRecordsByCenter(centerId, previousWeekStartDate);
      const previousRecordsMap = new Map(previousRecords.map(r => [r.clinicStudentId, r]));

      const newRecords = await Promise.all(
        clinicStudentsList
          .filter(cs => cs.isActive && !existingClinicStudentIds.has(cs.id))
          .map(cs => {
            const prev = previousRecordsMap.get(cs.id);
            return storage.createClinicWeeklyRecord({
              clinicStudentId: cs.id,
              weekStartDate,
              status: "pending",
              // Carry over all instructions from previous week
              clinicTeacherNotes: prev?.clinicTeacherNotes || null,
              weeklyEvaluation: prev?.weeklyEvaluation || null,
              period2Instruction: prev?.period2Instruction || null,
              period3Instruction: prev?.period3Instruction || null,
            });
          })
      );

      // Auto-cleanup: Delete records older than 5 weeks
      const fiveWeeksAgo = new Date(currentDate);
      fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);
      const cutoffDate = fiveWeeksAgo.toISOString().split('T')[0];
      
      try {
        const deletedCount = await storage.deleteOldClinicWeeklyRecords(centerId, cutoffDate);
        if (deletedCount > 0) {
          console.log(`[CLINIC] Auto-deleted ${deletedCount} records older than ${cutoffDate} for center ${centerId}`);
        }
      } catch (cleanupError) {
        console.error("[CLINIC] Failed to cleanup old records:", cleanupError);
      }

      res.json({ created: newRecords.length, records: newRecords });
    } catch (error: any) {
      console.error("[CLINIC] Failed to batch create weekly records:", error);
      res.status(500).json({ error: "Failed to batch create weekly records", details: error?.message });
    }
  });

  // ===== Clinic Resources (자료 모음) =====
  app.get("/api/clinic-resources", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const resources = await storage.getClinicResources(centerId);
      res.json(resources);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic resources" });
    }
  });

  app.post("/api/clinic-resources", clinicUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { centerId, description, isPermanent, weekStartDate, uploadedById } = req.body;
      if (!centerId || !uploadedById) {
        return res.status(400).json({ error: "centerId and uploadedById are required" });
      }

      // Decode Korean filename - try UTF-8 first, then latin1 to UTF-8 conversion
      let fileName = file.originalname;
      try {
        // Check if the filename appears to be latin1 encoded UTF-8
        const decoded = iconv.decode(Buffer.from(fileName, 'latin1'), 'utf-8');
        if (decoded && !decoded.includes('�')) {
          fileName = decoded;
        }
      } catch (e) {
        // Keep original filename if decoding fails
      }

      // Upload to R2 - no local fallback
      const r2Client = getClinicR2Client();
      
      if (!r2Client) {
        return res.status(503).json({ error: "파일 저장소가 설정되지 않았습니다. 관리자에게 문의하세요." });
      }
      
      let filePath: string;
      try {
        const fileExt = path.extname(fileName).toLowerCase().replace('.', '');
        const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const objectKey = `clinic-resources/${centerId}/${uniqueId}.${fileExt}`;
        
        await r2Client.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        }));
        
        filePath = R2_PUBLIC_URL 
          ? `${R2_PUBLIC_URL}/${objectKey}`
          : objectKey;
      } catch (r2Error) {
        console.error("[Clinic Resources] R2 upload failed:", r2Error);
        return res.status(503).json({ error: "파일 저장소 연결에 문제가 있습니다. 잠시 후 다시 시도하세요." });
      }

      const resource = await storage.createClinicResource({
        centerId,
        fileName,
        filePath,
        description: description || null,
        isPermanent: isPermanent === "true",
        weekStartDate: weekStartDate || null,
        uploadedById,
      });
      res.json(resource);
    } catch (error) {
      console.error("Clinic resource upload error:", error);
      res.status(500).json({ error: "Failed to create clinic resource" });
    }
  });

  app.delete("/api/clinic-resources/:id", async (req, res) => {
    try {
      // Get the resource to get the file path before deleting from DB
      const resource = await storage.getClinicResource(req.params.id);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      // Delete from R2 if configured and path looks like an R2 path
      const r2Client = getClinicR2Client();
      if (r2Client && resource.filePath && !resource.filePath.startsWith('/uploads/')) {
        try {
          // Extract object key from filePath (remove public URL prefix if present)
          let objectKey = resource.filePath;
          if (R2_PUBLIC_URL && resource.filePath.startsWith(R2_PUBLIC_URL)) {
            objectKey = resource.filePath.replace(`${R2_PUBLIC_URL}/`, '');
          }
          await r2Client.send(new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: objectKey,
          }));
        } catch (r2Error) {
          console.error("[Clinic Resources] Failed to delete R2 object:", r2Error);
          // Continue with DB deletion even if R2 deletion fails
        }
      }

      await storage.deleteClinicResource(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[Clinic Resources] Delete error:", error);
      res.status(500).json({ error: "Failed to delete clinic resource" });
    }
  });

  // Cleanup old temporary resources (called periodically or manually)
  app.post("/api/clinic-resources/cleanup", async (req, res) => {
    try {
      const { beforeDate } = req.body;
      if (!beforeDate) {
        return res.status(400).json({ error: "beforeDate is required" });
      }
      const deletedCount = await storage.deleteOldTemporaryClinicResources(beforeDate);
      res.json({ deleted: deletedCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to cleanup old resources" });
    }
  });

  // ===== Clinic Daily Notes (날짜별 기록) =====

  app.get("/api/clinic-daily-notes/:clinicStudentId", async (req, res) => {
    try {
      const notes = await storage.getClinicDailyNotes(req.params.clinicStudentId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic daily notes" });
    }
  });

  app.post("/api/clinic-daily-notes", async (req, res) => {
    try {
      const note = await storage.createClinicDailyNote(req.body);
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create clinic daily note" });
    }
  });

  app.patch("/api/clinic-daily-notes/:id", async (req, res) => {
    try {
      const note = await storage.updateClinicDailyNote(req.params.id, req.body);
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to update clinic daily note" });
    }
  });

  app.delete("/api/clinic-daily-notes/:id", async (req, res) => {
    try {
      await storage.deleteClinicDailyNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete clinic daily note" });
    }
  });

  // ===== Clinic Instruction Defaults (요일별 기본 지시사항) =====

  app.get("/api/clinic-instruction-defaults/:clinicStudentId", async (req, res) => {
    try {
      const defaults = await storage.getClinicInstructionDefaults(req.params.clinicStudentId);
      res.json(defaults);
    } catch (error) {
      res.status(500).json({ error: "Failed to get instruction defaults" });
    }
  });

  app.post("/api/clinic-instruction-defaults", async (req, res) => {
    try {
      const result = await storage.upsertClinicInstructionDefault(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to save instruction default" });
    }
  });

  app.delete("/api/clinic-instruction-defaults/:id", async (req, res) => {
    try {
      await storage.deleteClinicInstructionDefault(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete instruction default" });
    }
  });

  // ===== Clinic Weekly Record Files (주간 기록 첨부파일) =====

  app.get("/api/clinic-weekly-record-files/:recordId", async (req, res) => {
    try {
      const files = await storage.getClinicWeeklyRecordFiles(req.params.recordId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to get record files" });
    }
  });

  app.post("/api/clinic-weekly-record-files", clinicUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { recordId, period } = req.body;
      if (!recordId || !period) {
        return res.status(400).json({ error: "recordId and period are required" });
      }

      // Decode Korean filename
      let fileName = file.originalname;
      try {
        const decoded = iconv.decode(Buffer.from(fileName, 'latin1'), 'utf-8');
        if (decoded && !decoded.includes('�')) {
          fileName = decoded;
        }
      } catch (e) {
        // Keep original filename if decoding fails
      }

      const fileExt = fileName.split('.').pop()?.toLowerCase() || 'unknown';
      
      // Upload to R2
      const r2Client = getClinicR2Client();
      if (!r2Client) {
        return res.status(500).json({ error: "R2 storage not configured" });
      }
      
      const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const objectKey = `clinic/${recordId}/${period}/${uniqueId}.${fileExt}`;
      
      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));
      
      const publicUrl = R2_PUBLIC_URL 
        ? `${R2_PUBLIC_URL}/${objectKey}`
        : objectKey;

      const fileRecord = await storage.createClinicWeeklyRecordFile({
        recordId,
        period,
        fileName,
        filePath: publicUrl,
        fileType: fileExt,
        fileSize: file.size,
      });

      res.json(fileRecord);
    } catch (error) {
      console.error("Failed to upload clinic record file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.delete("/api/clinic-weekly-record-files/:id", async (req, res) => {
    try {
      const fileRecord = await storage.getClinicWeeklyRecordFileById(req.params.id);
      if (!fileRecord) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Delete from R2 if it's an R2 path (starts with clinic/)
      if (fileRecord.filePath) {
        const r2Client = getClinicR2Client();
        if (r2Client) {
          let objectKey = fileRecord.filePath;
          // Strip public URL prefix if present
          if (R2_PUBLIC_URL && fileRecord.filePath.startsWith(R2_PUBLIC_URL)) {
            objectKey = fileRecord.filePath.replace(`${R2_PUBLIC_URL}/`, '');
          }
          // Only delete if it looks like an R2 object key (starts with clinic/)
          if (objectKey.startsWith('clinic/')) {
            try {
              await r2Client.send(new DeleteObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: objectKey,
              }));
            } catch (r2Error) {
              console.error("Failed to delete file from R2:", r2Error);
            }
          }
        }
      }
      
      await storage.deleteClinicWeeklyRecordFile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // ===== Clinic Shared Instruction Groups (공통 지시사항 그룹) =====

  app.get("/api/clinic-shared-instruction-groups", async (req, res) => {
    try {
      const { centerId, teacherId, weekStartDate } = req.query;
      const groups = await storage.getClinicSharedInstructionGroups(
        centerId as string,
        teacherId as string | undefined,
        weekStartDate as string | undefined
      );
      res.json(groups);
    } catch (error) {
      console.error("Failed to get shared instruction groups:", error);
      res.status(500).json({ error: "Failed to get shared instruction groups" });
    }
  });

  app.post("/api/clinic-shared-instruction-groups", async (req, res) => {
    try {
      const { centerId, teacherId, weekStartDate, period, content, useDefault, recordIds } = req.body;
      
      const group = await storage.createClinicSharedInstructionGroup({
        centerId,
        teacherId,
        weekStartDate,
        period,
        content,
        useDefault: useDefault || false,
      });
      
      if (recordIds && recordIds.length > 0) {
        for (const recordId of recordIds) {
          await storage.addClinicSharedInstructionMember({
            sharedGroupId: group.id,
            recordId,
          });
        }
      }
      
      const groupWithMembers = await storage.getClinicSharedInstructionGroupWithMembers(group.id);
      res.json(groupWithMembers);
    } catch (error) {
      console.error("Failed to create shared instruction group:", error);
      res.status(500).json({ error: "Failed to create shared instruction group" });
    }
  });

  app.patch("/api/clinic-shared-instruction-groups/:id", async (req, res) => {
    try {
      const { content, useDefault, recordIds } = req.body;
      
      await storage.updateClinicSharedInstructionGroup(req.params.id, {
        content,
        useDefault,
      });
      
      if (recordIds !== undefined) {
        await storage.clearClinicSharedInstructionMembers(req.params.id);
        for (const recordId of recordIds) {
          await storage.addClinicSharedInstructionMember({
            sharedGroupId: req.params.id,
            recordId,
          });
        }
      }
      
      const groupWithMembers = await storage.getClinicSharedInstructionGroupWithMembers(req.params.id);
      res.json(groupWithMembers);
    } catch (error) {
      console.error("Failed to update shared instruction group:", error);
      res.status(500).json({ error: "Failed to update shared instruction group" });
    }
  });

  app.delete("/api/clinic-shared-instruction-groups/:id", async (req, res) => {
    try {
      await storage.deleteClinicSharedInstructionGroup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete shared instruction group:", error);
      res.status(500).json({ error: "Failed to delete shared instruction group" });
    }
  });

  app.get("/api/clinic-shared-instruction-members/:recordId", async (req, res) => {
    try {
      const members = await storage.getClinicSharedInstructionMembersByRecord(req.params.recordId);
      res.json(members);
    } catch (error) {
      console.error("Failed to get shared instruction members:", error);
      res.status(500).json({ error: "Failed to get shared instruction members" });
    }
  });

  // ===== Attendance System (출결 시스템) =====

  // Check SOLAPI configuration status
  app.get("/api/attendance/solapi-status", async (_req, res) => {
    const configured = await isSolapiConfigured();
    res.json({ configured });
  });

  // Auto-generate attendance PINs for all students in center
  app.post("/api/attendance-pins/auto-generate", async (req, res) => {
    try {
      const { centerId } = req.body;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      // Get all students in this center
      const centerUsers = await storage.getUsers(centerId);
      const students = centerUsers.filter((u: User) => u.role === UserRole.STUDENT);

      // Get existing PINs for this center
      const existingPins = await storage.getAttendancePins(centerId);
      const usedPins = existingPins.map((p) => p.pin);
      const studentsWithPins = new Set(existingPins.map((p) => p.studentId));

      const created: { studentId: string; pin: string }[] = [];
      const skipped: { studentId: string; reason: string }[] = [];

      for (const student of students) {
        // Skip if already has PIN
        if (studentsWithPins.has(student.id)) {
          skipped.push({ studentId: student.id, reason: "이미 출결번호 있음" });
          continue;
        }

        // Skip if no phone number
        if (!student.phone) {
          skipped.push({ studentId: student.id, reason: "전화번호 없음" });
          continue;
        }

        const pin = generatePinFromPhone(student.phone, usedPins);
        if (!pin) {
          skipped.push({ studentId: student.id, reason: "PIN 중복 (수동 등록 필요)" });
          continue;
        }

        await storage.createAttendancePin({ studentId: student.id, centerId, pin });
        usedPins.push(pin);
        created.push({ studentId: student.id, pin });
      }

      res.json({ created: created.length, skipped: skipped.length, details: { created, skipped } });
    } catch (error) {
      console.error("Auto-generate PINs error:", error);
      res.status(500).json({ error: "Failed to auto-generate PINs" });
    }
  });

  // Manual attendance check-in by teacher
  app.post("/api/attendance/manual-checkin", async (req, res) => {
    try {
      const { studentId, centerId, classId, isLate } = req.body;
      if (!studentId || !centerId) {
        return res.status(400).json({ error: "studentId and centerId are required" });
      }

      const today = new Date().toISOString().split("T")[0];

      // Check if already checked in today for this specific class
      let existingRecord;
      if (classId) {
        existingRecord = await storage.getAttendanceRecordByStudentDateAndClass(studentId, today, classId);
      } else {
        existingRecord = await storage.getAttendanceRecordByStudentAndDate(studentId, today);
      }
      
      let record;
      let isUpdate = false;
      
      if (existingRecord) {
        // Update existing record (e.g., change from late to on-time or vice versa)
        record = await storage.updateAttendanceRecord(existingRecord.id, {
          wasLate: isLate || false,
        });
        isUpdate = true;
      } else {
        // Create new attendance record with classId
        record = await storage.createAttendanceRecord({
          studentId,
          centerId,
          classId: classId || undefined,
          checkInDate: today,
          wasLate: isLate || false,
        });
      }

      // Get student info for notification
      const student = await storage.getUser(studentId);
      const center = await storage.getCenter(centerId);
      
      console.log("[Attendance] Manual check-in:", { studentId, centerId, isLate, centerName: center?.name });
      console.log("[Attendance] Student info:", { name: student?.name, motherPhone: student?.motherPhone, fatherPhone: student?.fatherPhone });
      const solapiConfigured = await isSolapiConfigured(center?.name);
      console.log("[Attendance] SOLAPI configured:", solapiConfigured);
      
      // Send notification if configured
      if (solapiConfigured && student) {
        const parentPhone = student.motherPhone || student.fatherPhone;
        if (parentPhone) {
          // Get custom message templates
          const templates = await storage.getMessageTemplates(centerId);
          const checkInTemplate = templates.find((t) => t.type === "check_in");
          const lateTemplate = templates.find((t) => t.type === "late");

          const logNotification = async (result: { success: boolean; error?: string }) => {
            await storage.createNotificationLog({
              attendanceRecordId: record.id,
              recipientPhone: parentPhone,
              recipientType: student.motherPhone ? "mother" : "father",
              messageType: isLate ? "late" : "attendance_checkin",
              channel: "sms",
              status: result.success ? "sent" : "failed",
              errorMessage: result.error || null,
            });
          };

          if (isLate) {
            const timeStr = record.checkInAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
            sendLateNotification(student.name, timeStr, parentPhone, center?.name, lateTemplate?.body)
              .then(logNotification)
              .catch(err => console.error("Notification error:", err));
          } else {
            sendAttendanceNotification(student.name, record.checkInAt, parentPhone, center?.name, checkInTemplate?.body)
              .then(logNotification)
              .catch(err => console.error("Notification error:", err));
          }
        }
      }

      res.json({ success: true, record });
    } catch (error) {
      console.error("Manual check-in error:", error);
      res.status(500).json({ error: "Failed to create attendance record" });
    }
  });

  // Update attendance status only (without sending SMS)
  app.patch("/api/attendance/update-status", async (req, res) => {
    try {
      const { studentId, centerId, classId, status } = req.body;
      if (!studentId || !centerId || !status) {
        return res.status(400).json({ error: "studentId, centerId, and status are required" });
      }

      const validStatuses = ["pending", "present", "late", "absent"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be: pending, present, late, or absent" });
      }

      const today = new Date().toISOString().split("T")[0];

      // Check if already has record for today
      let existingRecord;
      if (classId) {
        existingRecord = await storage.getAttendanceRecordByStudentDateAndClass(studentId, today, classId);
      } else {
        existingRecord = await storage.getAttendanceRecordByStudentAndDate(studentId, today);
      }

      let record;
      if (existingRecord) {
        // Update existing record
        record = await storage.updateAttendanceRecord(existingRecord.id, {
          attendanceStatus: status,
          wasLate: status === "late",
        });
      } else {
        // Create new attendance record with status (no SMS)
        record = await storage.createAttendanceRecord({
          studentId,
          centerId,
          classId: classId || undefined,
          checkInDate: today,
          wasLate: status === "late",
          attendanceStatus: status,
        });
      }

      res.json({ success: true, record });
    } catch (error) {
      console.error("Update attendance status error:", error);
      res.status(500).json({ error: "Failed to update attendance status" });
    }
  });

  // Send SMS notification for attendance (separate from status update)
  app.post("/api/attendance/send-sms", async (req, res) => {
    try {
      const { studentId, centerId, classId, type } = req.body;
      if (!studentId || !centerId || !type) {
        return res.status(400).json({ error: "studentId, centerId, and type are required" });
      }

      if (!["check_in", "late"].includes(type)) {
        return res.status(400).json({ error: "Invalid type. Must be: check_in or late" });
      }

      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const center = await storage.getCenter(centerId);
      const parentPhone = student.motherPhone || student.fatherPhone;
      if (!parentPhone) {
        return res.status(400).json({ error: "학부모 연락처가 없습니다" });
      }

      const solapiIsConfigured = await isSolapiConfigured(center?.name);
      if (!solapiIsConfigured) {
        return res.status(400).json({ error: "알림 서비스가 설정되지 않았습니다" });
      }

      // Get today's attendance record for logging
      const today = new Date().toISOString().split("T")[0];
      let attendanceRecord;
      if (classId) {
        attendanceRecord = await storage.getAttendanceRecordByStudentDateAndClass(studentId, today, classId);
      } else {
        attendanceRecord = await storage.getAttendanceRecordByStudentAndDate(studentId, today);
      }

      // Get custom message templates
      const templates = await storage.getMessageTemplates(centerId);
      const checkInTemplate = templates.find((t) => t.type === "check_in");
      const lateTemplate = templates.find((t) => t.type === "late");

      const now = new Date();
      let result: { success: boolean; error?: string };

      if (type === "late") {
        const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
        result = await sendLateNotification(student.name, timeStr, parentPhone, center?.name, lateTemplate?.body);
      } else {
        result = await sendAttendanceNotification(student.name, now, parentPhone, center?.name, checkInTemplate?.body);
      }

      // Log the notification
      if (attendanceRecord) {
        await storage.createNotificationLog({
          attendanceRecordId: attendanceRecord.id,
          recipientPhone: parentPhone,
          recipientType: student.motherPhone ? "mother" : "father",
          messageType: type === "late" ? "late" : "attendance_checkin",
          channel: "sms",
          status: result.success ? "sent" : "failed",
          errorMessage: result.error || null,
        });
      }

      if (!result.success) {
        return res.status(500).json({ error: result.error || "알림 발송에 실패했습니다" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Send attendance SMS error:", error);
      res.status(500).json({ error: "Failed to send attendance SMS" });
    }
  });

  // Get attendance history for a student (date range)
  app.get("/api/attendance/history/:studentId", async (req, res) => {
    try {
      const { studentId } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const records = await storage.getAttendanceRecordsForStudent(
        studentId,
        startDate as string,
        endDate as string
      );

      res.json(records);
    } catch (error) {
      console.error("Get attendance history error:", error);
      res.status(500).json({ error: "Failed to get attendance history" });
    }
  });

  // Resend attendance notification
  app.post("/api/attendance/resend-notification", async (req, res) => {
    try {
      const { studentId, isLate } = req.body;
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required" });
      }

      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const parentPhone = student.motherPhone || student.fatherPhone;
      if (!parentPhone) {
        return res.status(400).json({ error: "학부모 연락처가 없습니다" });
      }

      const solapiIsConfigured = await isSolapiConfigured();
      if (!solapiIsConfigured) {
        return res.status(400).json({ error: "알림 서비스가 설정되지 않았습니다" });
      }

      // Get today's attendance record for logging
      const today = new Date().toISOString().split("T")[0];
      const attendanceRecord = await storage.getAttendanceRecordByStudentAndDate(studentId, today);

      const now = new Date();
      let result: { success: boolean; error?: string };
      
      // Get center name from student's attendance record
      let centerName: string | undefined;
      if (attendanceRecord) {
        const center = await storage.getCenter(attendanceRecord.centerId);
        centerName = center?.name;
      }
      
      if (isLate) {
        const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
        result = await sendLateNotification(student.name, timeStr, parentPhone, centerName);
      } else {
        result = await sendAttendanceNotification(student.name, now, parentPhone, centerName);
      }

      // Log the notification
      if (attendanceRecord) {
        await storage.createNotificationLog({
          attendanceRecordId: attendanceRecord.id,
          recipientPhone: parentPhone,
          recipientType: student.motherPhone ? "mother" : "father",
          messageType: isLate ? "late" : "attendance_checkin",
          channel: "sms",
          status: result.success ? "sent" : "failed",
          errorMessage: result.error || null,
        });
      }

      if (!result.success) {
        return res.status(500).json({ error: result.error || "알림 발송에 실패했습니다" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Resend notification error:", error);
      res.status(500).json({ error: "Failed to resend notification" });
    }
  });

  // Get classes for teacher (for attendance management)
  app.get("/api/teachers/:id/classes", async (req, res) => {
    try {
      const teacherId = req.params.id;
      const centerId = req.query.centerId as string;
      
      let allClasses = await storage.getClasses(centerId);
      const teacherClasses = allClasses.filter((c) => c.teacherId === teacherId && !c.isArchived);
      
      res.json(teacherClasses);
    } catch (error) {
      res.status(500).json({ error: "Failed to get teacher classes" });
    }
  });

  // Get students with attendance status for a class on a specific date
  app.get("/api/classes/:id/attendance", async (req, res) => {
    try {
      const classId = req.params.id;
      const date = req.query.date as string || new Date().toISOString().split("T")[0];
      
      // Get students enrolled in this class
      const students = await storage.getClassStudents(classId);
      
      // Get attendance records for these students on this date FOR THIS SPECIFIC CLASS ONLY
      // Do NOT use center-level fallback - each class must have its own attendance records
      const studentIds = students.map((s) => s.id);
      const records: AttendanceRecord[] = [];
      for (const studentId of studentIds) {
        // Only get records that belong to this specific class
        const record = await storage.getAttendanceRecordByStudentDateAndClass(studentId, date, classId);
        if (record) records.push(record);
      }
      const recordMap = new Map(records.map((r: AttendanceRecord) => [r.studentId, r]));
      
      // Get notification logs for each record
      const notificationLogsMap = new Map<string, { sentAt: Date; status: string }[]>();
      for (const record of records) {
        const logs = await storage.getNotificationLogsByAttendanceRecord(record.id);
        notificationLogsMap.set(record.id, logs
          .filter(l => l.sentAt !== null)
          .map(l => ({ sentAt: l.sentAt as Date, status: l.status })));
      }
      
      // Combine student info with attendance status and notification logs
      const result = students.map((student) => {
        const attendanceRecord = recordMap.get(student.id) || null;
        return {
          ...student,
          attendanceRecord,
          notificationLogs: attendanceRecord ? notificationLogsMap.get(attendanceRecord.id) || [] : [],
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error("Get class attendance error:", error);
      res.status(500).json({ error: "Failed to get class attendance" });
    }
  });

  // Attendance PINs - 출결번호 관리
  app.get("/api/attendance-pins", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const pins = await storage.getAttendancePins(centerId);
      res.json(pins);
    } catch (error) {
      res.status(500).json({ error: "Failed to get attendance pins" });
    }
  });

  app.get("/api/students/:studentId/attendance-pin/:centerId", async (req, res) => {
    try {
      const { studentId, centerId } = req.params;
      const pin = await storage.getAttendancePinByStudent(studentId, centerId);
      res.json(pin || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get attendance pin" });
    }
  });

  app.post("/api/attendance-pins", async (req, res) => {
    try {
      const { studentId, centerId, pin } = req.body;
      if (!studentId || !centerId || !pin) {
        return res.status(400).json({ error: "studentId, centerId, and pin are required" });
      }
      // Check if PIN already exists for this center
      const existing = await storage.getAttendancePinByPin(centerId, pin);
      if (existing) {
        return res.status(400).json({ error: "이 출결번호는 이미 사용 중입니다" });
      }
      // Check if student already has a PIN for this center
      const existingForStudent = await storage.getAttendancePinByStudent(studentId, centerId);
      if (existingForStudent) {
        return res.status(400).json({ error: "이 학생은 이미 출결번호가 있습니다" });
      }
      const result = await storage.createAttendancePin({ studentId, centerId, pin });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to create attendance pin" });
    }
  });

  app.patch("/api/attendance-pins/:id", async (req, res) => {
    try {
      const { pin, isActive } = req.body;
      const result = await storage.updateAttendancePin(req.params.id, { pin, isActive });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update attendance pin" });
    }
  });

  app.delete("/api/attendance-pins/:id", async (req, res) => {
    try {
      await storage.deleteAttendancePin(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete attendance pin" });
    }
  });

  // Teacher Check-in Settings (선생님 출근 설정)
  app.get("/api/teacher-check-in-settings", async (req, res) => {
    try {
      const { teacherId, centerId } = req.query;
      if (!teacherId || !centerId) {
        return res.status(400).json({ error: "teacherId and centerId are required" });
      }
      const settings = await storage.getTeacherCheckInSettings(teacherId as string, centerId as string);
      res.json(settings || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get teacher check-in settings" });
    }
  });

  // Get all teacher check-in settings for a center (with teacher info)
  app.get("/api/teacher-check-in-settings/all", async (req, res) => {
    try {
      const { centerId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const allSettings = await storage.getAllTeacherCheckInSettings(centerId as string);
      // Attach teacher info to each setting
      const settingsWithTeachers = await Promise.all(
        allSettings.map(async (setting) => {
          const teacher = await storage.getUser(setting.teacherId);
          return { ...setting, teacher };
        })
      );
      res.json(settingsWithTeachers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get all teacher check-in settings" });
    }
  });

  app.post("/api/teacher-check-in-settings", async (req, res) => {
    try {
      const { teacherId, centerId, checkInCode, smsRecipient1, smsRecipient2, messageTemplate, isActive } = req.body;
      
      if (!teacherId || !centerId || !checkInCode) {
        return res.status(400).json({ error: "teacherId, centerId, and checkInCode are required" });
      }

      // Validate checkInCode is exactly 4 digits
      if (!/^\d{4}$/.test(checkInCode)) {
        return res.status(400).json({ error: "출근코드는 4자리 숫자여야 합니다" });
      }

      // Check if code conflicts with existing student PINs
      const existingPin = await storage.getAttendancePinByPin(centerId, checkInCode);
      if (existingPin) {
        return res.status(400).json({ error: "이 코드는 학생 출결번호와 중복됩니다. 다른 코드를 사용해 주세요." });
      }

      // Check if code conflicts with other teachers' codes
      const existingSettings = await storage.getTeacherCheckInSettingsByCode(centerId, checkInCode);
      if (existingSettings && existingSettings.teacherId !== teacherId) {
        return res.status(400).json({ error: "이 코드는 다른 선생님이 사용 중입니다. 다른 코드를 사용해 주세요." });
      }

      // Check if settings already exist for this teacher at this center
      const currentSettings = await storage.getTeacherCheckInSettings(teacherId, centerId);
      if (currentSettings) {
        // Update existing settings
        const updated = await storage.updateTeacherCheckInSettings(currentSettings.id, {
          checkInCode,
          smsRecipient1: smsRecipient1 || null,
          smsRecipient2: smsRecipient2 || null,
          messageTemplate: messageTemplate || null,
          isActive: isActive !== false,
        });
        return res.json(updated);
      }

      // Create new settings
      const result = await storage.createTeacherCheckInSettings({
        teacherId,
        centerId,
        checkInCode,
        smsRecipient1: smsRecipient1 || null,
        smsRecipient2: smsRecipient2 || null,
        messageTemplate: messageTemplate || null,
        isActive: isActive !== false,
      });
      res.json(result);
    } catch (error) {
      console.error("Failed to create/update teacher check-in settings:", error);
      res.status(500).json({ error: "Failed to save teacher check-in settings" });
    }
  });

  app.patch("/api/teacher-check-in-settings/:id", async (req, res) => {
    try {
      const { checkInCode, smsRecipient1, smsRecipient2, messageTemplate, isActive, centerId, teacherId } = req.body;

      // Validate checkInCode if provided
      if (checkInCode) {
        if (!/^\d{4}$/.test(checkInCode)) {
          return res.status(400).json({ error: "출근코드는 4자리 숫자여야 합니다" });
        }

        if (centerId) {
          // Check if code conflicts with existing student PINs
          const existingPin = await storage.getAttendancePinByPin(centerId, checkInCode);
          if (existingPin) {
            return res.status(400).json({ error: "이 코드는 학생 출결번호와 중복됩니다. 다른 코드를 사용해 주세요." });
          }

          // Check if code conflicts with other teachers' codes
          const existingSettings = await storage.getTeacherCheckInSettingsByCode(centerId, checkInCode);
          if (existingSettings && existingSettings.id !== req.params.id) {
            return res.status(400).json({ error: "이 코드는 다른 선생님이 사용 중입니다. 다른 코드를 사용해 주세요." });
          }
        }
      }

      // Only include fields that were explicitly provided in the request
      const updateData: Record<string, any> = {};
      if (checkInCode !== undefined) updateData.checkInCode = checkInCode;
      if (smsRecipient1 !== undefined) updateData.smsRecipient1 = smsRecipient1;
      if (smsRecipient2 !== undefined) updateData.smsRecipient2 = smsRecipient2;
      if (messageTemplate !== undefined) updateData.messageTemplate = messageTemplate;
      if (isActive !== undefined) updateData.isActive = isActive;

      const result = await storage.updateTeacherCheckInSettings(req.params.id, updateData);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update teacher check-in settings" });
    }
  });

  app.delete("/api/teacher-check-in-settings/:id", async (req, res) => {
    try {
      await storage.deleteTeacherCheckInSettings(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete teacher check-in settings" });
    }
  });

  // Validate PIN and get enrolled classes for the student
  app.post("/api/attendance/validate-pin", async (req, res) => {
    try {
      const { centerId, pin } = req.body;
      console.log("[VALIDATE-PIN] Request:", { centerId, pin });
      
      if (!centerId || !pin) {
        return res.status(400).json({ error: "centerId and pin are required" });
      }
      
      // Validate PIN is exactly 4 digits
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "출결번호는 4자리 숫자여야 합니다" });
      }

      // STEP 1: Check student PIN first (students take priority to avoid collisions)
      // Find student by PIN
      const pinRecord = await storage.getAttendancePinByPin(centerId, pin);
      console.log("[VALIDATE-PIN] PIN record found:", pinRecord ? { studentId: pinRecord.studentId, studentName: pinRecord.student?.name } : "null");
      
      if (!pinRecord) {
        // STEP 2: No student found, check if this matches a teacher's custom check-in code
        const checkInSettings = await storage.getTeacherCheckInSettingsByCode(centerId, pin);
        
        if (checkInSettings && checkInSettings.teacher && checkInSettings.isActive) {
          const matchedTeacher = checkInSettings.teacher;
          console.log("[VALIDATE-PIN] Teacher matched via custom code:", matchedTeacher.name);
          const now = new Date();
          const hours = now.getHours().toString().padStart(2, "0");
          const minutes = now.getMinutes().toString().padStart(2, "0");
          const checkInTime = `${hours}:${minutes}`;
          const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일`;

          // Send response immediately
          res.json({
            success: true,
            type: "teacher",
            teacher: { 
              id: matchedTeacher.id, 
              name: matchedTeacher.name,
              role: matchedTeacher.role
            },
            checkInTime: now,
            message: `${matchedTeacher.name} 선생님 출근!`
          });

          // Send SMS notification to configured recipients (async, don't wait)
          const center = await storage.getCenter(centerId);
          console.log("[TEACHER-CHECKIN] Teacher check-in via custom code:", { 
            teacherName: matchedTeacher.name, 
            centerId, 
            centerName: center?.name,
            time: checkInTime
          });
          
          const solapiReady = await isSolapiConfigured(center?.name);
          
          if (solapiReady) {
            const formattedTime = `${hours}시 ${minutes}분`;
            
            // Build message from template or use default
            let message = checkInSettings.messageTemplate 
              ? checkInSettings.messageTemplate
                  .replace(/{name}/g, matchedTeacher.name)
                  .replace(/{선생님명}/g, matchedTeacher.name)
                  .replace(/{time}/g, formattedTime)
                  .replace(/{시간}/g, formattedTime)
                  .replace(/{date}/g, dateStr)
                  .replace(/{날짜}/g, dateStr)
                  .replace(/{센터명}/g, center?.name || "프라임수학")
                  .replace(/{center}/g, center?.name || "프라임수학")
              : `[${center?.name || "프라임수학"}] ${matchedTeacher.name} 선생님 출근 확인 (${formattedTime})`;
            
            // Send to configured recipients
            const recipients = [checkInSettings.smsRecipient1, checkInSettings.smsRecipient2]
              .filter((r): r is string => !!r);
            
            for (const recipient of recipients) {
              sendSms({
                to: recipient.replace(/\D/g, ""),
                text: message,
                centerName: center?.name,
              })
                .then(result => {
                  if (result.success) {
                    console.log(`[TEACHER-CHECKIN] SMS sent to ${recipient}`);
                  } else {
                    console.error(`[TEACHER-CHECKIN] SMS failed to ${recipient}: ${result.error}`);
                  }
                })
                .catch((err: Error) => console.error("[TEACHER-CHECKIN] SMS error:", err));
            }
          }
          return;
        }

        // STEP 3: No custom code found, check if this matches a teacher's phone number (legacy fallback)
        const centerUsers = await storage.getCenterUsers(centerId);
        const teachers = centerUsers.filter(u => 
          u.role === UserRole.TEACHER || 
          u.role === UserRole.PRINCIPAL
        );

        // Match by last 4 digits or middle 4 digits of phone number
        const matchedTeacher = teachers.find(t => {
          if (!t.phone) return false;
          const phone = t.phone.replace(/\D/g, ""); // Remove non-digits
          if (phone.length < 4) return false;
          
          // Check last 4 digits
          const last4 = phone.slice(-4);
          if (last4 === pin) return true;
          
          // Check middle 4 digits (for 010-XXXX-YYYY format, middle is positions 3-6)
          if (phone.length >= 7) {
            const middle4 = phone.slice(3, 7);
            if (middle4 === pin) return true;
          }
          
          return false;
        });

        if (matchedTeacher) {
          console.log("[VALIDATE-PIN] Teacher matched via phone:", matchedTeacher.name);
          const now = new Date();
          const hours = now.getHours().toString().padStart(2, "0");
          const minutes = now.getMinutes().toString().padStart(2, "0");
          const checkInTime = `${hours}:${minutes}`;

          // Send response immediately
          res.json({
            success: true,
            type: "teacher",
            teacher: { 
              id: matchedTeacher.id, 
              name: matchedTeacher.name,
              role: matchedTeacher.role
            },
            checkInTime: now,
            message: `${matchedTeacher.name} 선생님 출근!`
          });

          // Send SMS notification to teacher (async, don't wait) - legacy behavior
          const center = await storage.getCenter(centerId);
          console.log("[TEACHER-CHECKIN] Teacher check-in (legacy phone match):", { 
            teacherName: matchedTeacher.name, 
            centerId, 
            centerName: center?.name,
            time: checkInTime
          });
          
          const solapiReady = await isSolapiConfigured(center?.name);
          
          if (solapiReady && matchedTeacher.phone) {
            const formattedTime = `${hours}시 ${minutes}분`;
            const message = `[${center?.name || "프라임수학"}] ${matchedTeacher.name} 선생님 출근 확인 (${formattedTime})`;
            
            sendSms({
              to: matchedTeacher.phone.replace(/\D/g, ""),
              text: message,
              centerName: center?.name,
            })
              .then(result => {
                if (result.success) {
                  console.log(`[TEACHER-CHECKIN] SMS sent to ${matchedTeacher.phone}`);
                } else {
                  console.error(`[TEACHER-CHECKIN] SMS failed: ${result.error}`);
                }
              })
              .catch((err: Error) => console.error("[TEACHER-CHECKIN] SMS error:", err));
          }
          return;
        }

        // Neither student nor teacher found
        return res.status(404).json({ error: "등록되지 않은 출결번호입니다" });
      }

      // Student found - proceed with student flow
      // Get student's enrolled classes in this center
      console.log("[VALIDATE-PIN] Fetching classes for studentId:", pinRecord.studentId, "centerId:", centerId);
      const enrolledClasses = await storage.getStudentEnrolledClasses(pinRecord.studentId, centerId);
      console.log("[VALIDATE-PIN] Enrolled classes (before filter):", enrolledClasses.length, enrolledClasses.map(c => ({ id: c.id, name: c.name, centerId: c.centerId, isArchived: c.isArchived })));
      
      // Filter to only active (non-archived) classes
      const activeClasses = enrolledClasses.filter(c => !c.isArchived);
      console.log("[VALIDATE-PIN] Active classes (after filter):", activeClasses.length, activeClasses.map(c => ({ id: c.id, name: c.name })));

      console.log("[VALIDATE-PIN] Response:", { 
        studentName: pinRecord.student?.name, 
        activeClassCount: activeClasses.length,
        activeClassNames: activeClasses.map(c => c.name)
      });

      res.json({
        success: true,
        type: "student",
        student: pinRecord.student,
        classes: activeClasses,
      });
    } catch (error) {
      console.error("PIN validation error:", error);
      res.status(500).json({ error: "출결번호 확인에 실패했습니다" });
    }
  });

  // Attendance Check-in - 출결 체크인 (출결 패드에서 호출)
  app.post("/api/attendance/check-in", async (req, res) => {
    try {
      const { centerId, pin, classId } = req.body;
      if (!centerId || !pin) {
        return res.status(400).json({ error: "centerId and pin are required" });
      }
      
      // Validate PIN is exactly 4 digits
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "출결번호는 4자리 숫자여야 합니다" });
      }

      // Find student by PIN
      const pinRecord = await storage.getAttendancePinByPin(centerId, pin);
      if (!pinRecord) {
        return res.status(404).json({ error: "등록되지 않은 출결번호입니다" });
      }

      const today = new Date().toISOString().split("T")[0];

      // Check if already checked in today for this specific class (or center-level if no classId)
      let existingRecord;
      if (classId) {
        existingRecord = await storage.getAttendanceRecordByStudentDateAndClass(pinRecord.studentId, today, classId);
      } else {
        // For students without class enrollment, check for any center-level check-in today
        existingRecord = await storage.getAttendanceRecordByStudentAndDate(pinRecord.studentId, today);
      }
      if (existingRecord) {
        return res.status(400).json({ 
          error: "이미 출석 체크가 완료되었습니다",
          student: pinRecord.student,
          checkInTime: existingRecord.checkInAt
        });
      }

      // Create attendance record
      const record = await storage.createAttendanceRecord({
        studentId: pinRecord.studentId,
        centerId,
        classId: classId || undefined,
        checkInDate: today,
      });

      // Get class name for the message if classId provided
      let className = "";
      if (classId) {
        const classInfo = await storage.getClass(classId);
        if (classInfo) {
          className = classInfo.classroom 
            ? `${classInfo.name} (${classInfo.classroom})`
            : classInfo.name;
        }
      }

      res.json({
        success: true,
        student: pinRecord.student,
        checkInTime: record.checkInAt,
        className,
        message: `${pinRecord.student?.name} 출결 완료!`
      });

      // Send notification to parent/student via SOLAPI (async, don't wait)
      const center = await storage.getCenter(centerId);
      console.log("[ATTENDANCE-PAD] Check-in for:", { 
        studentName: pinRecord.student?.name, 
        centerId, 
        centerName: center?.name 
      });
      
      const solapiReady = await isSolapiConfigured(center?.name);
      console.log("[ATTENDANCE-PAD] SOLAPI configured:", solapiReady);
      
      if (solapiReady && pinRecord.student) {
        const student = pinRecord.student;
        const parentPhone = student.motherPhone || student.fatherPhone;
        console.log("[ATTENDANCE-PAD] Student contact info:", { 
          name: student.name, 
          motherPhone: student.motherPhone, 
          fatherPhone: student.fatherPhone,
          selectedPhone: parentPhone
        });
        
        if (parentPhone) {
          const checkInTime = new Date(record.checkInAt);
          
          // Get custom message templates (like manual check-in does)
          const templates = await storage.getMessageTemplates(centerId);
          const checkInTemplate = templates.find((t) => t.type === "check_in");
          console.log("[ATTENDANCE-PAD] Using template:", checkInTemplate ? "custom" : "default");
          
          sendAttendanceNotification(student.name, checkInTime, parentPhone, center?.name, checkInTemplate?.body)
            .then(async (result) => {
              if (result.success) {
                console.log(`[ATTENDANCE-PAD] Notification sent to ${parentPhone} for ${student.name}`);
              } else {
                console.error(`[ATTENDANCE-PAD] Failed to send notification: ${result.error}`);
              }
              // Log notification result
              await storage.createNotificationLog({
                attendanceRecordId: record.id,
                recipientPhone: parentPhone,
                recipientType: student.motherPhone ? "mother" : "father",
                messageType: "attendance_checkin",
                channel: "sms",
                status: result.success ? "sent" : "failed",
                errorMessage: result.error || null,
              });
            })
            .catch(err => console.error("[ATTENDANCE-PAD] Notification error:", err));
        } else {
          console.log("[ATTENDANCE-PAD] No parent phone number registered");
        }
      } else {
        console.log("[ATTENDANCE-PAD] SMS not sent - SOLAPI not configured or no student");
      }
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ error: "출석 체크에 실패했습니다" });
    }
  });

  // Attendance Check-out - 하원 체크아웃 (출결 패드에서 호출)
  app.post("/api/attendance/check-out", async (req, res) => {
    try {
      const { centerId, pin } = req.body;
      if (!centerId || !pin) {
        return res.status(400).json({ error: "centerId and pin are required" });
      }
      
      // Validate PIN is exactly 4 digits
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "출결번호는 4자리 숫자여야 합니다" });
      }

      // Find student by PIN
      const pinRecord = await storage.getAttendancePinByPin(centerId, pin);
      if (!pinRecord) {
        return res.status(404).json({ error: "등록되지 않은 출결번호입니다" });
      }

      const today = new Date().toISOString().split("T")[0];

      // Find today's check-in record (most recent one without check-out)
      const existingRecord = await storage.getAttendanceRecordByStudentAndDate(pinRecord.studentId, today);
      
      const checkOutTime = new Date();
      let recordId: string;
      
      if (!existingRecord) {
        // No check-in record exists - create a new record with only check-out time
        const newRecord = await storage.createAttendanceRecordCheckOutOnly({
          studentId: pinRecord.studentId,
          centerId,
          checkInDate: today,
          checkOutAt: checkOutTime,
        });
        recordId = newRecord.id;
      } else {
        if (existingRecord.checkOutAt) {
          return res.status(400).json({ 
            error: "이미 하원 체크가 완료되었습니다",
            student: pinRecord.student,
            checkOutTime: existingRecord.checkOutAt
          });
        }
        // Update existing attendance record with check-out time
        await storage.updateAttendanceRecordCheckOut(existingRecord.id, checkOutTime);
        recordId = existingRecord.id;
      }

      res.json({
        success: true,
        student: pinRecord.student,
        checkOutTime,
        message: `${pinRecord.student?.name} 하원 완료!`
      });

      // Send notification to parent/student via SOLAPI (async, don't wait)
      const center = await storage.getCenter(centerId);
      console.log("[ATTENDANCE-PAD] Check-out for:", { 
        studentName: pinRecord.student?.name, 
        centerId, 
        centerName: center?.name 
      });
      
      const solapiReady = await isSolapiConfigured(center?.name);
      console.log("[ATTENDANCE-PAD] SOLAPI configured:", solapiReady);
      
      if (solapiReady && pinRecord.student) {
        const student = pinRecord.student;
        const parentPhone = student.motherPhone || student.fatherPhone;
        
        if (parentPhone) {
          // Get custom check-out message templates
          const templates = await storage.getMessageTemplates(centerId);
          const checkOutTemplate = templates.find((t) => t.type === "check_out");
          console.log("[ATTENDANCE-PAD] Using check-out template:", checkOutTemplate ? "custom" : "default");
          
          // Format check-out message
          let messageBody = checkOutTemplate?.body || "[프라임수학] {{studentName}}(이)가 {{time}}에 하원하였습니다.";
          messageBody = messageBody
            .replace(/\{\{studentName\}\}/g, student.name)
            .replace(/\{\{time\}\}/g, checkOutTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }))
            .replace(/\{\{date\}\}/g, checkOutTime.toLocaleDateString("ko-KR"));
          
          sendSms({
            to: parentPhone.replace(/\D/g, ""),
            text: messageBody,
            centerName: center?.name,
          })
            .then(async (result: { success: boolean; error?: string }) => {
              if (result.success) {
                console.log(`[ATTENDANCE-PAD] Check-out notification sent to ${parentPhone} for ${student.name}`);
                // Mark as sent
                await storage.updateAttendanceRecordCheckOutNotificationSent(recordId);
              } else {
                console.error(`[ATTENDANCE-PAD] Failed to send check-out notification: ${result.error}`);
              }
              // Log notification result
              await storage.createNotificationLog({
                attendanceRecordId: recordId,
                recipientPhone: parentPhone,
                recipientType: student.motherPhone ? "mother" : "father",
                messageType: "check_out",
                channel: "sms",
                status: result.success ? "sent" : "failed",
                errorMessage: result.error || null,
              });
            })
            .catch((err: Error) => console.error("[ATTENDANCE-PAD] Check-out notification error:", err));
        } else {
          console.log("[ATTENDANCE-PAD] No parent phone number registered");
        }
      }
    } catch (error) {
      console.error("Check-out error:", error);
      res.status(500).json({ error: "하원 체크에 실패했습니다" });
    }
  });

  // Teacher Check-in - 선생님 출근 체크 (출결 패드에서 호출) - Legacy endpoint
  app.post("/api/attendance/teacher-check-in", async (req, res) => {
    try {
      const { centerId, phoneDigits } = req.body;
      if (!centerId || !phoneDigits) {
        return res.status(400).json({ error: "centerId and phoneDigits are required" });
      }
      
      // Validate phoneDigits is exactly 4 digits
      if (!/^\d{4}$/.test(phoneDigits)) {
        return res.status(400).json({ error: "전화번호 4자리를 입력해주세요" });
      }

      // Find teacher by phone number (last 4 or middle 4 digits)
      const centerUsers = await storage.getCenterUsers(centerId);
      const teachers = centerUsers.filter(u => 
        u.role === UserRole.TEACHER || 
        u.role === UserRole.PRINCIPAL
      );

      // Match by last 4 digits or middle 4 digits of phone number
      const matchedTeacher = teachers.find(t => {
        if (!t.phone) return false;
        const phone = t.phone.replace(/\D/g, ""); // Remove non-digits
        if (phone.length < 4) return false;
        
        // Check last 4 digits
        const last4 = phone.slice(-4);
        if (last4 === phoneDigits) return true;
        
        // Check middle 4 digits (for 010-XXXX-YYYY format, middle is positions 3-6)
        if (phone.length >= 7) {
          const middle4 = phone.slice(3, 7);
          if (middle4 === phoneDigits) return true;
        }
        
        return false;
      });

      if (!matchedTeacher) {
        return res.status(404).json({ error: "등록된 선생님을 찾을 수 없습니다" });
      }

      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const checkInTime = `${hours}:${minutes}`;

      res.json({
        success: true,
        teacher: { 
          id: matchedTeacher.id, 
          name: matchedTeacher.name,
          role: matchedTeacher.role
        },
        checkInTime: now,
        message: `${matchedTeacher.name} 선생님 출근!`
      });

      // Send SMS notification to admin/principal (async, don't wait)
      const center = await storage.getCenter(centerId);
      console.log("[TEACHER-CHECKIN] Teacher check-in:", { 
        teacherName: matchedTeacher.name, 
        centerId, 
        centerName: center?.name,
        time: checkInTime
      });
      
      const solapiReady = await isSolapiConfigured(center?.name);
      
      if (solapiReady) {
        // Send notification to teacher's own phone
        if (matchedTeacher.phone) {
          const formattedTime = `${hours}시 ${minutes}분`;
          const message = `[${center?.name || "프라임수학"}] ${matchedTeacher.name} 선생님 출근 확인 (${formattedTime})`;
          
          sendSms({
            to: matchedTeacher.phone.replace(/\D/g, ""),
            text: message,
            centerName: center?.name,
          })
            .then(result => {
              if (result.success) {
                console.log(`[TEACHER-CHECKIN] SMS sent to ${matchedTeacher.phone}`);
              } else {
                console.error(`[TEACHER-CHECKIN] SMS failed: ${result.error}`);
              }
            })
            .catch(err => console.error("[TEACHER-CHECKIN] SMS error:", err));
        }
      }
    } catch (error) {
      console.error("Teacher check-in error:", error);
      res.status(500).json({ error: "출근 체크에 실패했습니다" });
    }
  });

  // Teacher Work Record - 선생님 출퇴근 기록 (출근/퇴근 버튼)
  app.post("/api/teacher-work/punch", async (req, res) => {
    try {
      const { teacherId, centerId, type } = req.body; // type: 'check_in' | 'check_out'
      if (!teacherId || !centerId || !type) {
        return res.status(400).json({ error: "teacherId, centerId, and type are required" });
      }

      const now = new Date();
      const today = format(now, "yyyy-MM-dd");
      
      // Check if there's an existing record for today
      let record = await storage.getTeacherWorkRecordByDate(teacherId, centerId, today);
      
      if (!record) {
        // First punch of the day - always treat as check-in regardless of button pressed
        record = await storage.createTeacherWorkRecord({
          teacherId,
          centerId,
          workDate: today,
          checkInAt: now,
        });
        
        const teacher = await storage.getUser(teacherId);
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        
        res.json({
          success: true,
          actionType: "check_in",
          message: `${teacher?.name || "선생님"} 출근 완료! (${hours}:${minutes})`,
          checkInAt: now,
        });
      } else {
        // Already has a record - update check-out time (last punch is always check-out)
        const workMinutes = record.checkInAt ? 
          Math.floor((now.getTime() - new Date(record.checkInAt).getTime()) / 60000) : 0;
        
        await storage.updateTeacherWorkRecord(record.id, {
          checkOutAt: now,
          workMinutes,
          noCheckOut: false,
        });
        
        const teacher = await storage.getUser(teacherId);
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        const workHours = Math.floor(workMinutes / 60);
        const workMins = workMinutes % 60;
        
        res.json({
          success: true,
          actionType: "check_out",
          message: `${teacher?.name || "선생님"} 퇴근 완료! (${hours}:${minutes}) - 근무시간: ${workHours}시간 ${workMins}분`,
          checkOutAt: now,
          workMinutes,
        });
      }
    } catch (error) {
      console.error("Teacher work punch error:", error);
      res.status(500).json({ error: "출퇴근 기록에 실패했습니다" });
    }
  });

  // Get teacher work records for management tab
  app.get("/api/teacher-work-records", async (req, res) => {
    try {
      const { centerId, startDate, endDate } = req.query;
      if (!centerId || !startDate || !endDate) {
        return res.status(400).json({ error: "centerId, startDate, and endDate are required" });
      }
      
      const records = await storage.getTeacherWorkRecords(
        centerId as string, 
        startDate as string, 
        endDate as string
      );
      
      // Enrich with teacher names
      const enrichedRecords = await Promise.all(records.map(async (record) => {
        const teacher = await storage.getUser(record.teacherId);
        return {
          ...record,
          teacherName: teacher?.name || "Unknown",
        };
      }));
      
      res.json(enrichedRecords);
    } catch (error) {
      console.error("Failed to get teacher work records:", error);
      res.status(500).json({ error: "Failed to get teacher work records" });
    }
  });

  // Get teacher work days count for a specific month (for hourly salary calculation)
  app.get("/api/teacher-work-days", async (req, res) => {
    try {
      const { centerId, yearMonth } = req.query;
      if (!centerId || !yearMonth) {
        return res.status(400).json({ error: "centerId and yearMonth are required" });
      }
      
      // Parse yearMonth to get date range (e.g., "2025-01" -> "2025-01-01" to "2025-01-31")
      const [year, month] = (yearMonth as string).split("-").map(Number);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate(); // Last day of the month
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      
      const records = await storage.getTeacherWorkRecords(
        centerId as string, 
        startDate, 
        endDate
      );
      
      // Count work days per teacher
      const workDaysMap: Record<string, number> = {};
      for (const record of records) {
        if (!workDaysMap[record.teacherId]) {
          workDaysMap[record.teacherId] = 0;
        }
        workDaysMap[record.teacherId]++;
      }
      
      res.json(workDaysMap);
    } catch (error) {
      console.error("Failed to get teacher work days:", error);
      res.status(500).json({ error: "Failed to get teacher work days" });
    }
  });

  // Attendance Records - 출결 기록 조회
  app.get("/api/attendance-records", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const date = req.query.date as string;
      if (!centerId || !date) {
        return res.status(400).json({ error: "centerId and date are required" });
      }
      const records = await storage.getAttendanceRecords(centerId, date);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to get attendance records" });
    }
  });

  // Send late notification - 지각 알림 발송
  app.post("/api/attendance-records/:id/late-notify", async (req, res) => {
    try {
      const recordId = req.params.id;
      const { studentId, expectedTime } = req.body;
      
      console.log("[LATE-NOTIFY] Request received:", { recordId, studentId, expectedTime });
      
      // Get student info for notification
      let student = null;
      if (studentId) {
        student = await storage.getUser(studentId);
        console.log("[LATE-NOTIFY] Student found:", student ? { name: student.name, motherPhone: student.motherPhone, fatherPhone: student.fatherPhone } : "null");
      } else {
        console.log("[LATE-NOTIFY] No studentId provided");
      }

      // Update record to mark late notification sent
      const record = await storage.updateAttendanceRecord(recordId, {
        lateNotificationSent: true,
        lateNotificationSentAt: new Date(),
      });
      console.log("[LATE-NOTIFY] Record updated:", record?.id);

      // Send late notification via SOLAPI
      // Get center name from attendance record
      let centerName: string | undefined;
      if (record?.centerId) {
        const center = await storage.getCenter(record.centerId);
        centerName = center?.name;
        console.log("[LATE-NOTIFY] Center:", centerName);
      } else {
        console.log("[LATE-NOTIFY] No centerId in record");
      }
      
      const solapiAvailable = await isSolapiConfigured(centerName);
      console.log("[LATE-NOTIFY] SOLAPI configured:", solapiAvailable, "for center:", centerName);
      
      if (solapiAvailable && student) {
        const parentPhone = student.motherPhone || student.fatherPhone;
        console.log("[LATE-NOTIFY] Parent phone:", parentPhone || "없음");
        
        if (parentPhone) {
          console.log("[LATE-NOTIFY] Sending late notification to", parentPhone);
          sendLateNotification(student.name, expectedTime || "예정 시간", parentPhone, centerName)
            .then(result => {
              if (result.success) {
                console.log(`[LATE-NOTIFY] SUCCESS: Sent to ${parentPhone} for ${student.name}`);
              } else {
                console.error(`[LATE-NOTIFY] FAILED: ${result.error}`);
              }
            })
            .catch(err => console.error("[LATE-NOTIFY] Exception:", err));
        } else {
          console.log("[LATE-NOTIFY] No parent phone number available");
        }
      } else {
        console.log("[LATE-NOTIFY] Skipped:", { solapiAvailable, hasStudent: !!student });
      }

      res.json({ success: true, record });
    } catch (error) {
      console.error("[LATE-NOTIFY] Error:", error);
      res.status(500).json({ error: "Failed to send late notification" });
    }
  });

  // Message Templates - 알림 메시지 템플릿
  app.get("/api/message-templates", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const templates = await storage.getMessageTemplates(centerId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to get message templates" });
    }
  });

  app.post("/api/message-templates", async (req, res) => {
    try {
      const { centerId, type, title, body } = req.body;
      if (!centerId || !type || !title || !body) {
        return res.status(400).json({ error: "centerId, type, title, and body are required" });
      }
      const template = await storage.createMessageTemplate({ centerId, type, title, body });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create message template" });
    }
  });

  app.patch("/api/message-templates/:id", async (req, res) => {
    try {
      const { title, body, isActive } = req.body;
      const template = await storage.updateMessageTemplate(req.params.id, { title, body, isActive });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update message template" });
    }
  });

  app.delete("/api/message-templates/:id", async (req, res) => {
    try {
      await storage.deleteMessageTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete message template" });
    }
  });

  // Class Notes (수업 공통 기록)
  app.get("/api/class-notes", async (req, res) => {
    try {
      const classId = req.query.classId as string;
      const noteDate = req.query.noteDate as string;
      if (!classId || !noteDate) {
        return res.status(400).json({ error: "classId and noteDate are required" });
      }
      const notes = await storage.getClassNotes(classId, noteDate);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get class notes" });
    }
  });

  app.post("/api/class-notes", async (req, res) => {
    try {
      const { classId, teacherId, noteDate, content } = req.body;
      if (!classId || !teacherId || !noteDate || !content) {
        return res.status(400).json({ error: "classId, teacherId, noteDate, and content are required" });
      }
      const note = await storage.createClassNote({ classId, teacherId, noteDate, content });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create class note" });
    }
  });

  app.patch("/api/class-notes/:id", async (req, res) => {
    try {
      const { content } = req.body;
      const note = await storage.updateClassNote(req.params.id, { content });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to update class note" });
    }
  });

  app.delete("/api/class-notes/:id", async (req, res) => {
    try {
      await storage.deleteClassNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete class note" });
    }
  });

  // Student Class Notes (학생별 수업 기록)
  app.get("/api/student-class-notes", async (req, res) => {
    try {
      const classId = req.query.classId as string;
      const noteDate = req.query.noteDate as string;
      if (!classId || !noteDate) {
        return res.status(400).json({ error: "classId and noteDate are required" });
      }
      const notes = await storage.getStudentClassNotes(classId, noteDate);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get student class notes" });
    }
  });

  app.post("/api/student-class-notes", async (req, res) => {
    try {
      const { classId, studentId, teacherId, noteDate, content } = req.body;
      if (!classId || !studentId || !teacherId || !noteDate || !content) {
        return res.status(400).json({ error: "classId, studentId, teacherId, noteDate, and content are required" });
      }
      const note = await storage.createStudentClassNote({ classId, studentId, teacherId, noteDate, content });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create student class note" });
    }
  });

  app.patch("/api/student-class-notes/:id", async (req, res) => {
    try {
      const { content } = req.body;
      const note = await storage.updateStudentClassNote(req.params.id, { content });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to update student class note" });
    }
  });

  app.delete("/api/student-class-notes/:id", async (req, res) => {
    try {
      await storage.deleteStudentClassNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete student class note" });
    }
  });

  // Study Cafe (스터디카페)
  // Get study cafe settings for a center
  app.get("/api/study-cafe/settings/:centerId", async (req, res) => {
    try {
      const settings = await storage.getStudyCafeSettings(req.params.centerId);
      res.json(settings || { centerId: req.params.centerId, isEnabled: false, notice: null });
    } catch (error) {
      res.status(500).json({ error: "Failed to get study cafe settings" });
    }
  });

  // Update study cafe settings (admin/principal only, must belong to center unless admin)
  app.post("/api/study-cafe/settings", async (req, res) => {
    try {
      const { centerId, isEnabled, notice, entryPassword, actorId } = req.body;
      if (!centerId || !actorId) {
        return res.status(400).json({ error: "centerId and actorId are required" });
      }
      
      // Verify actor has principal role
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Principals must belong to the center
      const actorCenters = await storage.getUserCenters(actorId);
      if (!actorCenters.some(c => c.id === centerId)) {
        return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
      }
      
      const settings = await storage.upsertStudyCafeSettings({ centerId, isEnabled, notice, entryPassword });
      
      // Initialize seats if enabling for the first time
      if (isEnabled) {
        await storage.initializeStudyCafeSeats(centerId);
      }
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update study cafe settings" });
    }
  });

  // Get all centers with study cafe enabled
  app.get("/api/study-cafe/enabled-centers", async (req, res) => {
    try {
      const enabledSettings = await storage.getStudyCafeEnabledCenters();
      const centerIds = enabledSettings.map(s => s.centerId);
      const allCenters = await storage.getCenters();
      const enabledCenters = allCenters.filter(c => centerIds.includes(c.id));
      res.json(enabledCenters);
    } catch (error) {
      res.status(500).json({ error: "Failed to get enabled centers" });
    }
  });

  // Get seats with status for a center
  app.get("/api/study-cafe/seats/:centerId", async (req, res) => {
    try {
      const settings = await storage.getStudyCafeSettings(req.params.centerId);
      if (!settings?.isEnabled) {
        return res.status(400).json({ error: "스터디카페가 이 센터에서 활성화되지 않았습니다" });
      }
      
      const seats = await storage.getStudyCafeSeatsWithStatus(req.params.centerId);
      res.json(seats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get study cafe seats" });
    }
  });

  // Reserve a seat (student only - must reserve for themselves)
  app.post("/api/study-cafe/reserve", async (req, res) => {
    try {
      const { seatId, studentId, centerId, actorId } = req.body;
      if (!seatId || !studentId || !centerId || !actorId) {
        return res.status(400).json({ error: "seatId, studentId, centerId, and actorId are required" });
      }

      // Students can only reserve for themselves
      if (studentId !== actorId) {
        return res.status(403).json({ error: "다른 학생을 대신하여 예약할 수 없습니다" });
      }

      // Verify the actor is a student
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.STUDENT) {
        return res.status(403).json({ error: "학생만 좌석을 예약할 수 있습니다" });
      }

      // Check if study cafe is enabled
      const settings = await storage.getStudyCafeSettings(centerId);
      if (!settings?.isEnabled) {
        return res.status(400).json({ error: "스터디카페가 이 센터에서 활성화되지 않았습니다" });
      }

      // Check if student already has an active reservation
      const existingReservation = await storage.getStudentActiveReservation(studentId, centerId);
      if (existingReservation) {
        return res.status(400).json({ error: "이미 예약 중인 좌석이 있습니다. 먼저 반납해주세요." });
      }

      // Check if seat is available
      const activeReservation = await storage.getActiveReservation(seatId);
      const activeFixedSeat = await storage.getActiveFixedSeat(seatId);
      if (activeReservation || activeFixedSeat) {
        return res.status(400).json({ error: "이미 사용 중인 좌석입니다" });
      }

      // Create 2-hour reservation
      const now = new Date();
      const endAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const reservation = await storage.createStudyCafeReservation({
        seatId,
        studentId,
        centerId,
        startAt: now,
        endAt,
        status: "active",
      });

      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to reserve seat" });
    }
  });

  // Release a seat (student - must be their own, or staff can release any student's reservation)
  // Note: Center membership check is skipped for students releasing their own reservation
  // to handle edge case where student is removed from center but still has active reservation
  app.post("/api/study-cafe/release", async (req, res) => {
    try {
      const { reservationId, actorId } = req.body;
      if (!reservationId || !actorId) {
        return res.status(400).json({ error: "reservationId and actorId are required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(404).json({ error: "User not found" });
      }

      const existingReservation = await storage.getStudyCafeReservation(reservationId);
      if (!existingReservation) {
        return res.status(404).json({ error: "예약을 찾을 수 없습니다" });
      }

      // Staff (Teacher+) can release any student's reservation
      // Students can only release their own reservations
      const isStaff = actor.role >= UserRole.TEACHER;
      const isOwnReservation = existingReservation.studentId === actorId;

      if (!isStaff && !isOwnReservation) {
        return res.status(403).json({ error: "본인의 예약만 반납할 수 있습니다" });
      }

      // Only allow releasing active reservations
      if (existingReservation.status !== "active") {
        return res.status(400).json({ error: "활성 예약만 반납할 수 있습니다" });
      }

      // Student can always release their own reservation even if removed from center

      const reservation = await storage.updateStudyCafeReservation(reservationId, { status: "released" });
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to release seat" });
    }
  });

  // Extend reservation (student - must be their own active reservation) - adds another 2 hours
  // Requires center membership for extensions (unlike release)
  app.post("/api/study-cafe/extend", async (req, res) => {
    try {
      const { reservationId, actorId } = req.body;
      if (!reservationId || !actorId) {
        return res.status(400).json({ error: "reservationId and actorId are required" });
      }

      // Verify the actor owns this reservation
      const existingReservation = await storage.getStudyCafeReservation(reservationId);
      if (!existingReservation || existingReservation.studentId !== actorId) {
        return res.status(403).json({ error: "본인의 예약만 연장할 수 있습니다" });
      }

      // Only allow extending active reservations
      if (existingReservation.status !== "active") {
        return res.status(400).json({ error: "활성 예약만 연장할 수 있습니다" });
      }

      // Verify actor still belongs to the reservation's center for extensions
      const actorCenters = await storage.getUserCenters(actorId);
      if (!actorCenters.some(c => c.id === existingReservation.centerId)) {
        return res.status(403).json({ error: "센터 멤버십이 없어 연장할 수 없습니다" });
      }

      // Get current reservation and extend by 2 hours from now
      const now = new Date();
      const newEndAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const reservation = await storage.updateStudyCafeReservation(reservationId, { 
        endAt: newEndAt,
        startAt: now,
      });
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to extend reservation" });
    }
  });

  // Get student's current reservation
  app.get("/api/study-cafe/my-reservation/:studentId/:centerId", async (req, res) => {
    try {
      const reservation = await storage.getStudentActiveReservation(req.params.studentId, req.params.centerId);
      res.json(reservation || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reservation" });
    }
  });

  // Fixed Seats (고정석) - admin/principal/teacher
  app.get("/api/study-cafe/fixed-seats/:centerId", async (req, res) => {
    try {
      const fixedSeats = await storage.getFixedSeats(req.params.centerId);
      res.json(fixedSeats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get fixed seats" });
    }
  });

  app.post("/api/study-cafe/fixed-seats", async (req, res) => {
    try {
      const { seatId, studentId, centerId, startDate, endDate, actorId } = req.body;
      if (!seatId || !studentId || !centerId || !startDate || !endDate || !actorId) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Verify actor has teacher+ role
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 고정석을 지정할 수 있습니다" });
      }

      // Verify actor belongs to the target center
      const actorCenters = await storage.getUserCenters(actorId);
      if (!actorCenters.some(c => c.id === centerId)) {
        return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
      }

      // Check if seat already has an active fixed seat assignment
      const existingFixedSeat = await storage.getActiveFixedSeat(seatId);
      if (existingFixedSeat) {
        return res.status(400).json({ error: "이 좌석은 이미 고정석으로 지정되어 있습니다" });
      }

      // Check if student already has a fixed seat
      const studentFixedSeat = await storage.getStudentActiveFixedSeat(studentId, centerId);
      if (studentFixedSeat) {
        return res.status(400).json({ error: "이 학생은 이미 고정석이 있습니다" });
      }

      // Always set assignedById to the verified actor's ID server-side
      const fixedSeat = await storage.createStudyCafeFixedSeat({
        seatId,
        studentId,
        centerId,
        startDate,
        endDate,
        assignedById: actorId,
      });

      res.json(fixedSeat);
    } catch (error) {
      res.status(500).json({ error: "Failed to create fixed seat" });
    }
  });

  app.patch("/api/study-cafe/fixed-seats/:id", async (req, res) => {
    try {
      const { startDate, endDate, actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      // Verify actor has teacher+ role
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 고정석을 수정할 수 있습니다" });
      }

      // Get existing fixed seat to check center
      const existingFixedSeat = await storage.getStudyCafeFixedSeatById(req.params.id);
      if (!existingFixedSeat) {
        return res.status(404).json({ error: "고정석을 찾을 수 없습니다" });
      }

      // Verify actor belongs to the center
      const actorCenters = await storage.getUserCenters(actorId);
      if (!actorCenters.some(c => c.id === existingFixedSeat.centerId)) {
        return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
      }

      const fixedSeat = await storage.updateStudyCafeFixedSeat(req.params.id, { startDate, endDate });
      res.json(fixedSeat);
    } catch (error) {
      res.status(500).json({ error: "Failed to update fixed seat" });
    }
  });

  app.delete("/api/study-cafe/fixed-seats/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      // Verify actor has teacher+ role
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 고정석을 삭제할 수 있습니다" });
      }

      // Get existing fixed seat to check center
      const existingFixedSeat = await storage.getStudyCafeFixedSeatById(req.params.id);
      if (!existingFixedSeat) {
        return res.status(404).json({ error: "고정석을 찾을 수 없습니다" });
      }

      // Verify actor belongs to the center
      const actorCenters = await storage.getUserCenters(actorId as string);
      if (!actorCenters.some(c => c.id === existingFixedSeat.centerId)) {
        return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
      }

      await storage.deleteStudyCafeFixedSeat(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete fixed seat" });
    }
  });

  // Student Monthly Reports (학생 월간 보고서)
  app.get("/api/student-reports", async (req, res) => {
    try {
      const { centerId, year, month } = req.query;
      if (!centerId || !year || !month) {
        return res.status(400).json({ error: "centerId, year, month are required" });
      }
      const reports = await storage.getStudentMonthlyReports(
        centerId as string,
        parseInt(year as string),
        parseInt(month as string)
      );
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.get("/api/student-reports/:id", async (req, res) => {
    try {
      const report = await storage.getStudentMonthlyReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  app.post("/api/student-reports", async (req, res) => {
    try {
      const { studentId, centerId, year, month, createdById, reportContent } = req.body;
      if (!studentId || !centerId || !year || !month || !createdById || !reportContent) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const actor = await storage.getUser(createdById);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 보고서를 생성할 수 있습니다" });
      }

      const existingReport = await storage.getStudentMonthlyReportByMonth(studentId, year, month);
      if (existingReport) {
        return res.status(400).json({ error: "이미 해당 월에 보고서가 존재합니다" });
      }

      const report = await storage.createStudentMonthlyReport({
        studentId,
        centerId,
        createdById,
        year,
        month,
        reportContent: reportContent.slice(0, 2000),
        customInstructions: null,
        assessmentSummary: null,
        attendanceSummary: null,
        homeworkSummary: null,
        clinicSummary: null,
        videoViewingSummary: null,
        studyCafeSummary: null,
      });

      res.json(report);
    } catch (error) {
      console.error("Error creating report:", error);
      res.status(500).json({ error: "Failed to create report" });
    }
  });

  app.patch("/api/student-reports/:id", async (req, res) => {
    try {
      const { reportContent, actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 보고서를 수정할 수 있습니다" });
      }

      const report = await storage.updateStudentMonthlyReport(req.params.id, { reportContent });
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to update report" });
    }
  });

  app.post("/api/student-reports/:id/refine", async (req, res) => {
    try {
      const { actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 보고서를 다듬을 수 있습니다" });
      }

      const report = await storage.getStudentMonthlyReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      // Dynamic import to reduce startup memory
      const { refineReportWithAI } = await import("./services/reportGeneration");
      const refinedContent = await refineReportWithAI(report.reportContent);
      const updatedReport = await storage.updateStudentMonthlyReport(req.params.id, { 
        reportContent: refinedContent 
      });
      res.json(updatedReport);
    } catch (error) {
      console.error("Error refining report:", error);
      res.status(500).json({ error: "Failed to refine report" });
    }
  });

  app.post("/api/student-reports/:id/send-sms", async (req, res) => {
    try {
      const { actorId, recipients } = req.body;
      if (!actorId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "actorId and recipients are required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 문자를 보낼 수 있습니다" });
      }

      const report = await storage.getStudentMonthlyReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      const student = await storage.getUser(report.studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      // Build comprehensive SMS content with metrics
      let smsContent = `[프라임수학] ${report.year}년 ${report.month}월 ${student.name} 학생 보고서\n\n`;
      
      // Add attendance metrics
      if (report.attendanceSummary) {
        try {
          const attendance = JSON.parse(report.attendanceSummary);
          smsContent += `📊 출석률: ${attendance.attendanceRate ?? 0}%\n`;
        } catch {}
      }
      
      // Add homework metrics
      if (report.homeworkSummary) {
        try {
          const homework = JSON.parse(report.homeworkSummary);
          smsContent += `📝 숙제 완료율: ${homework.completionRate ?? 0}%\n`;
        } catch {}
      }
      
      // Add assessment metrics
      if (report.assessmentSummary) {
        try {
          const assessments = JSON.parse(report.assessmentSummary);
          if (Array.isArray(assessments) && assessments.length > 0) {
            const avgScore = Math.round(assessments.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / assessments.length);
            smsContent += `📈 평가 평균: ${avgScore}점\n`;
          }
        } catch {}
      }
      
      smsContent += `\n${report.reportContent}`;

      const results: { phone: string; type: string; success: boolean; error?: string }[] = [];
      
      // Get center name for SMS sending
      const center = report.centerId ? await storage.getCenter(report.centerId) : null;
      
      for (const recipient of recipients) {
        const { phone, type } = recipient as { phone: string; type: string };
        try {
          const smsResult = await sendSms({
            to: phone.replace(/\D/g, ""),
            text: smsContent,
            centerName: center?.name,
          });
          results.push({ phone, type, success: smsResult.success, error: smsResult.error });
        } catch (error) {
          results.push({ 
            phone, 
            type, 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const smsStatus = successCount === results.length ? "sent" : 
                        successCount === 0 ? "failed" : "partial";

      await storage.updateStudentMonthlyReport(req.params.id, {
        smsSentAt: new Date(),
        smsRecipients: JSON.stringify(results),
        smsStatus,
      });

      res.json({ results, status: smsStatus });
    } catch (error) {
      console.error("Error sending SMS:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  app.delete("/api/student-reports/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 보고서를 삭제할 수 있습니다" });
      }

      await storage.deleteStudentMonthlyReport(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  // Announcement APIs (공지사항)
  
  app.get("/api/announcements", async (req, res) => {
    try {
      const list = await storage.getAnnouncements();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to get announcements" });
    }
  });

  app.get("/api/announcements/:id", async (req, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      res.json(announcement);
    } catch (error) {
      res.status(500).json({ error: "Failed to get announcement" });
    }
  });

  app.post("/api/announcements", async (req, res) => {
    try {
      const { createdById, title, content, targetType, targetIds } = req.body;
      
      if (!createdById || !title || !content || !targetType || !targetIds) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const creator = await storage.getUser(createdById);
      if (!creator || creator.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 공지사항을 생성할 수 있습니다" });
      }

      const announcement = await storage.createAnnouncement({
        createdById,
        title,
        content,
        targetType,
        targetIds,
      });
      res.json(announcement);
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  app.patch("/api/announcements/:id", async (req, res) => {
    try {
      const { actorId, ...data } = req.body;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 공지사항을 수정할 수 있습니다" });
      }

      const announcement = await storage.updateAnnouncement(req.params.id, data);
      res.json(announcement);
    } catch (error) {
      res.status(500).json({ error: "Failed to update announcement" });
    }
  });

  app.delete("/api/announcements/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 공지사항을 삭제할 수 있습니다" });
      }

      await storage.deleteAnnouncement(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  // Send SMS for announcement
  app.post("/api/announcements/:id/send-sms", async (req, res) => {
    try {
      const { actorId } = req.body;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 SMS를 발송할 수 있습니다" });
      }

      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }

      // Check if SOLAPI is configured system-wide
      const configured = await isSolapiConfigured();
      if (!configured) {
        return res.status(400).json({ error: "SMS 설정이 되어있지 않습니다" });
      }

      // Get target students based on targetType
      let students: User[] = [];
      
      if (announcement.targetType === "class") {
        // Get students from specified classes
        for (const classId of announcement.targetIds) {
          const classStudents = await storage.getClassStudents(classId);
          students.push(...classStudents);
        }
      } else if (announcement.targetType === "grade") {
        // Get students by grade - fetch all students system-wide
        const allUsers = await storage.getUsers();
        students = allUsers.filter(u => 
          u.role === UserRole.STUDENT && 
          announcement.targetIds.includes(u.grade || "")
        );
      } else if (announcement.targetType === "students") {
        // Get specific students
        for (const studentId of announcement.targetIds) {
          const student = await storage.getUser(studentId);
          if (student && student.role === UserRole.STUDENT) {
            students.push(student);
          }
        }
      }

      // Deduplicate students
      const uniqueStudents = Array.from(new Map(students.map(s => [s.id, s])).values());

      // Build SMS message
      const message = `[학원] 공지사항이 등록되었습니다.\n\n제목: ${announcement.title}\n\n학원 앱에서 확인해주세요.`;

      const results: { phone: string; studentName: string; success: boolean; error?: string }[] = [];

      for (const student of uniqueStudents) {
        const phones = [student.motherPhone, student.fatherPhone].filter(Boolean) as string[];
        
        for (const phone of phones) {
          try {
            const smsResult = await sendSms({
              to: phone,
              text: message,
            });
            results.push({ 
              phone, 
              studentName: student.name, 
              success: smsResult.success,
              error: smsResult.error 
            });
          } catch (error) {
            results.push({ 
              phone, 
              studentName: student.name, 
              success: false, 
              error: error instanceof Error ? error.message : "Unknown error" 
            });
          }
        }
      }

      const successCount = results.filter(r => r.success).length;
      const smsStatus = successCount === results.length ? "sent" : 
                        successCount === 0 ? "failed" : "partial";

      await storage.updateAnnouncement(req.params.id, {
        smsSentAt: new Date(),
        smsRecipients: JSON.stringify(results),
        smsStatus,
      });

      res.json({ results, status: smsStatus });
    } catch (error) {
      console.error("Error sending announcement SMS:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  // Get students for announcement targeting (system-wide)
  app.get("/api/announcements/targets/students", async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const students = allUsers.filter(u => u.role === UserRole.STUDENT);
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to get students" });
    }
  });

  // Get grades for announcement targeting (system-wide)
  app.get("/api/announcements/targets/grades", async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const students = allUsers.filter(u => u.role === UserRole.STUDENT);
      const grades = Array.from(new Set(students.map(s => s.grade).filter(Boolean))).sort();
      res.json(grades);
    } catch (error) {
      res.status(500).json({ error: "Failed to get grades" });
    }
  });

  // Get announcements for a specific student (filtered by targeting)
  app.get("/api/students/:studentId/announcements", async (req, res) => {
    try {
      const { studentId } = req.params;
      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const allAnnouncements = await storage.getAnnouncements();
      
      // Filter announcements that target this student
      const studentAnnouncements = allAnnouncements.filter((announcement: any) => {
        const targetType = announcement.targetType;
        const targetIds = announcement.targetIds || [];
        
        // Check if student is directly targeted
        if (targetType === "students") {
          return targetIds.includes(studentId);
        }
        
        // Check if student's grade is targeted
        if (targetType === "grade") {
          return student.grade && targetIds.includes(student.grade);
        }
        
        // Check if student's class is targeted
        if (targetType === "class") {
          // We need to check if student is enrolled in any of the target classes
          // For now, we'll need to check enrollments
          return false; // Will be handled below with enrollments
        }
        
        return false;
      });

      // For class-based targeting, we need to check enrollments
      const studentEnrollments = await storage.getStudentEnrollments(studentId);
      const studentClassIds = studentEnrollments.map((e: any) => e.classId);

      const classTargetedAnnouncements = allAnnouncements.filter((announcement: any) => {
        if (announcement.targetType === "class") {
          const targetIds = announcement.targetIds || [];
          return targetIds.some((classId: string) => studentClassIds.includes(classId));
        }
        return false;
      });

      // Combine and deduplicate
      const combinedAnnouncements = [...studentAnnouncements, ...classTargetedAnnouncements];
      const uniqueAnnouncements = Array.from(
        new Map(combinedAnnouncements.map(a => [a.id, a])).values()
      );

      // Sort by createdAt descending
      uniqueAnnouncements.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json(uniqueAnnouncements);
    } catch (error) {
      console.error("Error getting student announcements:", error);
      res.status(500).json({ error: "Failed to get announcements" });
    }
  });

  // Calendar Events (학원 캘린더)
  
  // Get all calendar events
  app.get("/api/calendar-events", async (req, res) => {
    try {
      const events = await storage.getCalendarEvents();
      res.json(events);
    } catch (error) {
      console.error("Get calendar events error:", error);
      res.status(500).json({ error: "Failed to get calendar events" });
    }
  });

  // Get a single calendar event
  app.get("/api/calendar-events/:id", async (req, res) => {
    try {
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to get calendar event" });
    }
  });

  // Create a calendar event (teachers and above only)
  app.post("/api/calendar-events", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(400).json({ error: "Actor ID required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 일정을 추가할 수 있습니다" });
      }

      const { title, description, eventType, schoolName, startDate, endDate, color } = req.body;

      if (!title || !eventType || !startDate) {
        return res.status(400).json({ error: "Title, event type, and start date are required" });
      }

      const event = await storage.createCalendarEvent({
        title,
        description,
        eventType,
        schoolName,
        startDate,
        endDate,
        color,
        createdById: actorId,
      });

      res.status(201).json(event);
    } catch (error) {
      console.error("Create calendar event error:", error);
      res.status(500).json({ error: "Failed to create calendar event" });
    }
  });

  // Update a calendar event
  app.patch("/api/calendar-events/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(400).json({ error: "Actor ID required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 일정을 수정할 수 있습니다" });
      }

      const { title, description, eventType, schoolName, startDate, endDate, color } = req.body;

      const event = await storage.updateCalendarEvent(req.params.id, {
        title,
        description,
        eventType,
        schoolName,
        startDate,
        endDate,
        color,
      });

      res.json(event);
    } catch (error) {
      console.error("Update calendar event error:", error);
      res.status(500).json({ error: "Failed to update calendar event" });
    }
  });

  // Delete a calendar event
  app.delete("/api/calendar-events/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(400).json({ error: "Actor ID required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 일정을 삭제할 수 있습니다" });
      }

      await storage.deleteCalendarEvent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete calendar event error:", error);
      res.status(500).json({ error: "Failed to delete calendar event" });
    }
  });

  // Todo APIs (투두리스트)
  
  // Get all todos for a center (with optional assignee filter)
  app.get("/api/todos", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const assigneeId = req.query.assigneeId as string | undefined;
      const date = req.query.date as string | undefined;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      let todos;
      if (date) {
        todos = await storage.getTodosByDate(centerId, date, assigneeId);
      } else {
        todos = await storage.getTodos(centerId, assigneeId);
      }

      res.json(todos);
    } catch (error) {
      console.error("Get todos error:", error);
      res.status(500).json({ error: "Failed to get todos" });
    }
  });

  // Get a single todo
  app.get("/api/todos/:id", async (req, res) => {
    try {
      const todo = await storage.getTodo(req.params.id);
      if (!todo) {
        return res.status(404).json({ error: "Todo not found" });
      }
      res.json(todo);
    } catch (error) {
      res.status(500).json({ error: "Failed to get todo" });
    }
  });

  // Create a new todo
  app.post("/api/todos", async (req, res) => {
    try {
      const { creatorId, centerId, title, description, startDate, dueDate, priority, recurrence, assigneeIds } = req.body;
      
      if (!creatorId || !centerId || !title || !dueDate) {
        return res.status(400).json({ error: "creatorId, centerId, title, and dueDate are required" });
      }

      const creator = await storage.getUser(creatorId);
      if (!creator || creator.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 투두를 생성할 수 있습니다" });
      }

      // Validate assignees based on role
      const finalAssigneeIds = assigneeIds && assigneeIds.length > 0 ? assigneeIds : [creatorId];
      
      // Teachers can only assign to themselves
      if (creator.role === UserRole.TEACHER) {
        if (finalAssigneeIds.length > 1 || (finalAssigneeIds[0] !== creatorId)) {
          return res.status(403).json({ error: "선생님은 본인에게만 투두를 지정할 수 있습니다" });
        }
      }

      const todo = await storage.createTodo({
        centerId,
        creatorId,
        title,
        description: description || null,
        startDate: startDate || null,
        dueDate,
        priority: priority || "medium",
        recurrence: recurrence || "none",
      }, finalAssigneeIds);

      res.json(todo);
    } catch (error) {
      console.error("Create todo error:", error);
      res.status(500).json({ error: "Failed to create todo" });
    }
  });

  // Update a todo
  app.patch("/api/todos/:id", async (req, res) => {
    try {
      const { actorId, assigneeIds, ...data } = req.body;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      const todo = await storage.getTodo(req.params.id);
      
      if (!actor || !todo) {
        return res.status(404).json({ error: "Actor or Todo not found" });
      }

      // Only creator, admin, or principal can update
      if (todo.creatorId !== actorId && actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "수정 권한이 없습니다" });
      }

      const updated = await storage.updateTodo(req.params.id, data, assigneeIds);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update todo" });
    }
  });

  // Delete a todo
  app.delete("/api/todos/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId as string);
      const todo = await storage.getTodo(req.params.id);
      
      if (!actor || !todo) {
        return res.status(404).json({ error: "Actor or Todo not found" });
      }

      // Only creator, admin, or principal can delete
      if (todo.creatorId !== actorId && actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "삭제 권한이 없습니다" });
      }

      await storage.deleteTodo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete todo" });
    }
  });

  // Toggle todo completion for a specific date
  app.post("/api/todos/:id/toggle-complete", async (req, res) => {
    try {
      const { assigneeId, date } = req.body;
      
      if (!assigneeId || !date) {
        return res.status(400).json({ error: "assigneeId and date are required" });
      }

      const todo = await storage.getTodo(req.params.id);
      if (!todo) {
        return res.status(404).json({ error: "Todo not found" });
      }

      // Verify the assignee is actually assigned to this todo
      const assignees = todo.assignees || [];
      const isAssigned = assignees.some(a => a.assigneeId === assigneeId);
      if (!isAssigned) {
        return res.status(403).json({ error: "이 투두에 지정되지 않았습니다" });
      }

      const result = await storage.toggleTodoComplete(req.params.id, assigneeId, date);
      res.json(result);
    } catch (error) {
      console.error("Toggle todo complete error:", error);
      res.status(500).json({ error: "Failed to toggle todo completion" });
    }
  });

  // Check if todo is completed for a specific date
  app.get("/api/todos/:id/is-completed", async (req, res) => {
    try {
      const { assigneeId, date } = req.query;
      
      if (!assigneeId || !date) {
        return res.status(400).json({ error: "assigneeId and date are required" });
      }

      const isCompleted = await storage.isTodoCompletedForDate(
        req.params.id, 
        assigneeId as string, 
        date as string
      );
      res.json({ isCompleted });
    } catch (error) {
      res.status(500).json({ error: "Failed to check completion status" });
    }
  });

  // One-time cleanup: Remove base64 photos from homework submissions (causes memory issues)
  app.post("/api/admin/cleanup-base64-photos", async (req, res) => {
    try {
      // Find submissions with base64 photos
      const result = await db.execute(sql`
        UPDATE homework_submissions 
        SET photos = NULL 
        WHERE photos IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM unnest(photos) AS p WHERE p LIKE 'data:%'
        )
        RETURNING id
      `);
      
      const cleanedCount = Array.isArray(result) ? result.length : 0;
      console.log(`[Cleanup] Removed base64 photos from ${cleanedCount} submissions`);
      res.json({ success: true, cleanedSubmissions: cleanedCount });
    } catch (error: any) {
      console.error("[Cleanup] Error:", error);
      res.status(500).json({ error: "Cleanup failed", details: error?.message });
    }
  });

  // ============ Management Dashboard APIs (경영 대시보드) ============
  
  // Create student exit record when deleting a student
  app.post("/api/students/:id/exit-record", async (req, res) => {
    try {
      const studentId = req.params.id;
      const { reasons, notes, recordedBy, centerId } = req.body;
      
      if (!reasons || !Array.isArray(reasons) || reasons.length === 0) {
        return res.status(400).json({ error: "At least one exit reason is required" });
      }
      
      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      
      const now = new Date();
      const exitMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const record = await storage.createStudentExitRecord({
        studentId,
        studentName: student.name,
        centerId,
        exitMonth,
        reasons,
        notes: notes || null,
        recordedBy,
      });
      
      // Update monthly student count for the current month
      await storage.updateMonthlyStudentCount(centerId, exitMonth);
      
      res.json(record);
    } catch (error: any) {
      console.error("Failed to create exit record:", error);
      res.status(500).json({ error: "Failed to create exit record", details: error?.message });
    }
  });
  
  // Get management dashboard metrics
  app.get("/api/management/metrics", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const months = parseInt(req.query.months as string) || 12;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      // Get exit summary
      const exitSummary = await storage.getMonthlyExitSummary(centerId, months);
      
      // Get or create monthly snapshots
      const now = new Date();
      const snapshots: any[] = [];
      
      for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const snapshot = await storage.getOrCreateMonthlySnapshot(centerId, monthKey);
        snapshots.push(snapshot);
      }
      
      // Combine data - iterate over snapshots to ensure all months are included
      const monthlyData = snapshots.map(snapshot => {
        const exit = exitSummary.find(e => e.month === snapshot.month);
        const studentCount = snapshot.studentCount || 0;
        const exitCount = exit?.exitCount || 0;
        const exitRatio = studentCount > 0 ? (exitCount / studentCount) * 100 : 0;
        
        return {
          month: snapshot.month,
          studentCount,
          exitCount,
          exitRatio: Math.round(exitRatio * 10) / 10,
          reasons: exit?.reasons || {},
        };
      });
      
      res.json({ monthlyData });
    } catch (error: any) {
      console.error("Failed to get management metrics:", error);
      res.status(500).json({ error: "Failed to get management metrics", details: error?.message });
    }
  });
  
  // Update current month's student count (for initialization/refresh)
  app.post("/api/management/update-student-count", async (req, res) => {
    try {
      const { centerId } = req.body;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const snapshot = await storage.updateMonthlyStudentCount(centerId, month);
      res.json(snapshot);
    } catch (error: any) {
      console.error("Failed to update student count:", error);
      res.status(500).json({ error: "Failed to update student count", details: error?.message });
    }
  });
  
  // Get all exit records for a center
  app.get("/api/management/exit-records", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const records = await storage.getStudentExitRecords(centerId);
      res.json(records);
    } catch (error: any) {
      console.error("Failed to get exit records:", error);
      res.status(500).json({ error: "Failed to get exit records", details: error?.message });
    }
  });

  // ========================================
  // Marketing Campaigns
  // ========================================
  
  // Get marketing campaigns for a center
  app.get("/api/marketing-campaigns", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const campaigns = await storage.getMarketingCampaigns(centerId, year);
      res.json(campaigns);
    } catch (error: any) {
      console.error("Failed to get marketing campaigns:", error);
      res.status(500).json({ error: "Failed to get marketing campaigns", details: error?.message });
    }
  });
  
  // Get a single marketing campaign
  app.get("/api/marketing-campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getMarketingCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error: any) {
      console.error("Failed to get marketing campaign:", error);
      res.status(500).json({ error: "Failed to get marketing campaign", details: error?.message });
    }
  });
  
  // Helper function to sync marketing campaigns to financial records
  const syncMarketingToFinance = async (centerId: string, yearMonth: string) => {
    try {
      // Get all campaigns for this center and year
      const year = parseInt(yearMonth.split("-")[0]);
      const month = parseInt(yearMonth.split("-")[1]);
      const campaigns = await storage.getMarketingCampaigns(centerId, year);
      
      // Calculate total budget for this month from campaigns
      let totalBudget = 0;
      const details: { name: string; amount: number }[] = [];
      
      for (const campaign of campaigns) {
        const startDate = new Date(campaign.startDate);
        const endDate = new Date(campaign.endDate);
        const startMonth = startDate.getMonth() + 1;
        const startYear = startDate.getFullYear();
        const endMonth = endDate.getMonth() + 1;
        const endYear = endDate.getFullYear();
        
        // Check if campaign overlaps with this month
        const targetDate = new Date(year, month - 1, 1);
        const campaignStart = new Date(startYear, startMonth - 1, 1);
        const campaignEnd = new Date(endYear, endMonth - 1, 1);
        
        if (targetDate >= campaignStart && targetDate <= campaignEnd) {
          // Calculate daily budget and days in this month
          const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const dailyBudget = campaign.budget / durationDays;
          
          // Count days in this specific month
          let daysInMonth = 0;
          let current = new Date(startDate);
          while (current <= endDate) {
            if (current.getFullYear() === year && current.getMonth() + 1 === month) {
              daysInMonth++;
            }
            current.setDate(current.getDate() + 1);
          }
          
          const monthBudget = Math.round(dailyBudget * daysInMonth);
          if (monthBudget > 0) {
            totalBudget += monthBudget;
            details.push({
              name: `${campaign.name} (${campaign.channel})`,
              amount: monthBudget,
            });
          }
        }
      }
      
      // Update or create financial record
      const existingRecord = await storage.getMonthlyFinancialRecord(centerId, yearMonth);
      
      if (existingRecord) {
        await storage.updateMonthlyFinancialRecord(existingRecord.id, {
          expenseAdvertising: totalBudget,
          expenseAdvertisingDetails: JSON.stringify(details),
        });
      } else if (totalBudget > 0) {
        await storage.createMonthlyFinancialRecord({
          centerId,
          yearMonth,
          createdBy: "system",
          revenueTuition: 0,
          expenseAdvertising: totalBudget,
          expenseAdvertisingDetails: JSON.stringify(details),
        });
      }
    } catch (error) {
      console.error("Failed to sync marketing to finance:", error);
    }
  };

  // Create a marketing campaign
  app.post("/api/marketing-campaigns", async (req, res) => {
    try {
      const { centerId, name, channel, startDate, endDate, budget, notes, createdBy } = req.body;
      
      if (!centerId || !name || !channel || !startDate || !endDate || budget === undefined || !createdBy) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      if (budget <= 0) {
        return res.status(400).json({ error: "Budget must be greater than 0" });
      }
      
      if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ error: "End date must be after start date" });
      }
      
      const campaign = await storage.createMarketingCampaign({
        centerId,
        name,
        channel,
        startDate,
        endDate,
        budget,
        notes: notes || null,
        createdBy,
      });
      
      // Sync marketing to finance for all affected months
      const start = new Date(startDate);
      const end = new Date(endDate);
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      while (current <= end) {
        const yearMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
        await syncMarketingToFinance(centerId, yearMonth);
        current.setMonth(current.getMonth() + 1);
      }
      
      res.json(campaign);
    } catch (error: any) {
      console.error("Failed to create marketing campaign:", error);
      res.status(500).json({ error: "Failed to create marketing campaign", details: error?.message });
    }
  });
  
  // Update a marketing campaign
  app.patch("/api/marketing-campaigns/:id", async (req, res) => {
    try {
      const { name, channel, startDate, endDate, budget, notes } = req.body;
      
      if (budget !== undefined && budget <= 0) {
        return res.status(400).json({ error: "Budget must be greater than 0" });
      }
      
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ error: "End date must be after start date" });
      }
      
      // Get old campaign to know affected months before update
      const oldCampaign = await storage.getMarketingCampaign(req.params.id);
      
      const campaign = await storage.updateMarketingCampaign(req.params.id, {
        name,
        channel,
        startDate,
        endDate,
        budget,
        notes,
      });
      
      // Sync marketing to finance for all affected months (old and new ranges)
      if (campaign && campaign.centerId) {
        const affectedMonths = new Set<string>();
        
        // Add old campaign months
        if (oldCampaign) {
          const oldStart = new Date(oldCampaign.startDate);
          const oldEnd = new Date(oldCampaign.endDate);
          let current = new Date(oldStart.getFullYear(), oldStart.getMonth(), 1);
          while (current <= oldEnd) {
            affectedMonths.add(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`);
            current.setMonth(current.getMonth() + 1);
          }
        }
        
        // Add new campaign months
        const newStart = new Date(campaign.startDate);
        const newEnd = new Date(campaign.endDate);
        let current = new Date(newStart.getFullYear(), newStart.getMonth(), 1);
        while (current <= newEnd) {
          affectedMonths.add(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`);
          current.setMonth(current.getMonth() + 1);
        }
        
        for (const yearMonth of Array.from(affectedMonths)) {
          await syncMarketingToFinance(campaign.centerId, yearMonth);
        }
      }
      
      res.json(campaign);
    } catch (error: any) {
      console.error("Failed to update marketing campaign:", error);
      res.status(500).json({ error: "Failed to update marketing campaign", details: error?.message });
    }
  });
  
  // Delete a marketing campaign
  app.delete("/api/marketing-campaigns/:id", async (req, res) => {
    try {
      // Get campaign before deletion to know affected months
      const campaign = await storage.getMarketingCampaign(req.params.id);
      
      await storage.deleteMarketingCampaign(req.params.id);
      
      // Sync marketing to finance for all affected months
      if (campaign && campaign.centerId) {
        const start = new Date(campaign.startDate);
        const end = new Date(campaign.endDate);
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= end) {
          const yearMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
          await syncMarketingToFinance(campaign.centerId, yearMonth);
          current.setMonth(current.getMonth() + 1);
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete marketing campaign:", error);
      res.status(500).json({ error: "Failed to delete marketing campaign", details: error?.message });
    }
  });
  
  // Get marketing comparison data (current year vs last year)
  app.get("/api/marketing-campaigns/comparison/:centerId", async (req, res) => {
    try {
      const centerId = req.params.centerId;
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      const currentYearCampaigns = await storage.getMarketingCampaigns(centerId, currentYear);
      const lastYearCampaigns = await storage.getMarketingCampaigns(centerId, lastYear);
      
      // Calculate monthly totals
      const calculateMonthlyTotals = (campaigns: any[]) => {
        const totals: Record<number, number> = {};
        for (let m = 1; m <= 12; m++) totals[m] = 0;
        
        for (const campaign of campaigns) {
          const startDate = new Date(campaign.startDate);
          const endDate = new Date(campaign.endDate);
          const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const dailyBudget = campaign.budget / durationDays;
          
          let current = new Date(startDate);
          while (current <= endDate) {
            const month = current.getMonth() + 1;
            totals[month] += dailyBudget;
            current.setDate(current.getDate() + 1);
          }
        }
        
        return Object.entries(totals).map(([month, total]) => ({
          month: parseInt(month),
          total: Math.round(total),
        }));
      };
      
      const currentYearTotals = calculateMonthlyTotals(currentYearCampaigns);
      const lastYearTotals = calculateMonthlyTotals(lastYearCampaigns);
      
      const currentYearTotal = currentYearCampaigns.reduce((sum, c) => sum + c.budget, 0);
      const lastYearTotal = lastYearCampaigns.reduce((sum, c) => sum + c.budget, 0);
      
      res.json({
        currentYear,
        lastYear,
        currentYearTotal,
        lastYearTotal,
        currentYearMonthly: currentYearTotals,
        lastYearMonthly: lastYearTotals,
        currentYearCampaigns,
        lastYearCampaigns,
      });
    } catch (error: any) {
      console.error("Failed to get marketing comparison:", error);
      res.status(500).json({ error: "Failed to get marketing comparison", details: error?.message });
    }
  });

  // ========================================
  // Monthly Financial Records (월별 재무 기록)
  // ========================================
  app.get("/api/monthly-financials", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const records = await storage.getMonthlyFinancialRecords(centerId, year);
      res.json(records);
    } catch (error: any) {
      console.error("Failed to get monthly financials:", error);
      res.status(500).json({ error: "Failed to get monthly financials" });
    }
  });

  app.get("/api/monthly-financials/:centerId/:yearMonth", async (req, res) => {
    try {
      const { centerId, yearMonth } = req.params;
      const record = await storage.getMonthlyFinancialRecord(centerId, yearMonth);
      res.json(record || null);
    } catch (error: any) {
      console.error("Failed to get monthly financial record:", error);
      res.status(500).json({ error: "Failed to get monthly financial record" });
    }
  });

  app.post("/api/monthly-financials", async (req, res) => {
    try {
      const { centerId, yearMonth, createdBy, ...data } = req.body;
      
      if (!centerId || !yearMonth || !createdBy) {
        return res.status(400).json({ error: "centerId, yearMonth, and createdBy are required" });
      }
      
      // Check if record already exists for this month
      const existing = await storage.getMonthlyFinancialRecord(centerId, yearMonth);
      if (existing) {
        return res.status(400).json({ error: "이미 해당 월의 재무 기록이 있습니다" });
      }
      
      const record = await storage.createMonthlyFinancialRecord({
        centerId,
        yearMonth,
        createdBy,
        ...data,
      });
      res.json(record);
    } catch (error: any) {
      console.error("Failed to create monthly financial record:", error);
      res.status(500).json({ error: "Failed to create monthly financial record" });
    }
  });

  app.patch("/api/monthly-financials/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      const record = await storage.updateMonthlyFinancialRecord(id, data);
      res.json(record);
    } catch (error: any) {
      console.error("Failed to update monthly financial record:", error);
      res.status(500).json({ error: "Failed to update monthly financial record" });
    }
  });

  app.delete("/api/monthly-financials/:id", async (req, res) => {
    try {
      await storage.deleteMonthlyFinancialRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete monthly financial record:", error);
      res.status(500).json({ error: "Failed to delete monthly financial record" });
    }
  });

  // Get student tuition revenue for a center (학생 교육비 매출 조회)
  app.get("/api/student-tuition-revenue/:centerId", async (req, res) => {
    try {
      const { centerId } = req.params;
      
      // Get all students in this center
      const allUsers = await storage.getUsers();
      const students = allUsers.filter(u => u.role === UserRole.STUDENT);
      
      // Get all classes in this center
      const allClasses = await storage.getClasses(centerId, false);
      
      // Calculate tuition for each student based on their enrollments
      const studentTuitionData = [];
      
      for (const student of students) {
        const studentEnrollments = await storage.getStudentEnrollments(student.id);
        const enrolledClasses = studentEnrollments
          .map(e => allClasses.find(c => c.id === e.classId))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);
        
        if (enrolledClasses.length === 0) continue;
        
        // Calculate total tuition: baseFee for first class + additionalFee for remaining
        let totalTuition = 0;
        enrolledClasses.forEach((cls, index) => {
          if (index === 0) {
            totalTuition += cls.baseFee || 0;
          } else {
            totalTuition += cls.additionalFee || 0;
          }
        });
        
        if (totalTuition > 0) {
          studentTuitionData.push({
            studentId: student.id,
            studentName: student.name,
            school: student.school || "",
            grade: student.grade || "",
            totalTuition,
            classes: enrolledClasses.map(c => ({
              id: c.id,
              name: c.name,
              subject: c.subject,
              baseFee: c.baseFee,
              additionalFee: c.additionalFee,
            })),
          });
        }
      }
      
      res.json(studentTuitionData);
    } catch (error: any) {
      console.error("Failed to get student tuition revenue:", error);
      res.status(500).json({ error: "Failed to get student tuition revenue", details: error?.message });
    }
  });

  // Sync student tuition to financial records (학생 교육비를 재무 기록에 동기화)
  app.post("/api/sync-student-tuition/:centerId/:yearMonth", async (req, res) => {
    try {
      const { centerId, yearMonth } = req.params;
      const { actorId } = req.body;
      
      // Verify actor permission
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 교육비를 동기화할 수 있습니다" });
      }
      
      // Get all students
      const allUsers = await storage.getUsers();
      const students = allUsers.filter(u => u.role === UserRole.STUDENT);
      
      // Get all classes in this center
      const allClasses = await storage.getClasses(centerId, false);
      
      // Calculate tuition for each student
      const revenueDetails: { name: string; amount: number; studentId: string; school: string; grade: string; classes: any[] }[] = [];
      let totalRevenue = 0;
      
      for (const student of students) {
        const studentEnrollments = await storage.getStudentEnrollments(student.id);
        const enrolledClasses = studentEnrollments
          .map(e => allClasses.find(c => c.id === e.classId))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);
        
        if (enrolledClasses.length === 0) continue;
        
        let studentTuition = 0;
        enrolledClasses.forEach((cls, index) => {
          if (index === 0) {
            studentTuition += cls.baseFee || 0;
          } else {
            studentTuition += cls.additionalFee || 0;
          }
        });
        
        if (studentTuition > 0) {
          totalRevenue += studentTuition;
          revenueDetails.push({
            name: student.name,
            amount: studentTuition,
            studentId: student.id,
            school: student.school || "",
            grade: student.grade || "",
            classes: enrolledClasses.map(c => ({
              id: c.id,
              name: c.name,
              subject: c.subject,
            })),
          });
        }
      }
      
      // Update or create financial record
      const existingRecord = await storage.getMonthlyFinancialRecord(centerId, yearMonth);
      
      if (existingRecord) {
        await storage.updateMonthlyFinancialRecord(existingRecord.id, {
          revenueTuition: totalRevenue,
          revenueTuitionDetails: JSON.stringify(revenueDetails),
        });
      } else {
        await storage.createMonthlyFinancialRecord({
          centerId,
          yearMonth,
          createdBy: actorId,
          revenueTuition: totalRevenue,
          revenueTuitionDetails: JSON.stringify(revenueDetails),
        });
      }
      
      res.json({ 
        success: true, 
        totalRevenue, 
        studentCount: revenueDetails.length 
      });
    } catch (error: any) {
      console.error("Failed to sync student tuition:", error);
      res.status(500).json({ error: "Failed to sync student tuition", details: error?.message });
    }
  });

  // ========================================
  // Teacher Salary Settings (선생님 급여 설정)
  // ========================================
  
  // Get salary settings for a teacher
  app.get("/api/teacher-salary-settings/:teacherId", async (req, res) => {
    try {
      const { teacherId } = req.params;
      const { centerId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const settings = await storage.getTeacherSalarySettings(teacherId, centerId as string);
      res.json(settings || null);
    } catch (error) {
      console.error("Failed to get teacher salary settings:", error);
      res.status(500).json({ error: "Failed to get teacher salary settings" });
    }
  });

  // Get all salary settings for a center
  app.get("/api/teacher-salary-settings", async (req, res) => {
    try {
      const { centerId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const settings = await storage.getTeacherSalarySettingsByCenter(centerId as string);
      res.json(settings);
    } catch (error) {
      console.error("Failed to get teacher salary settings:", error);
      res.status(500).json({ error: "Failed to get teacher salary settings" });
    }
  });

  // Create or update salary settings (Admin/Principal only)
  app.post("/api/teacher-salary-settings", async (req, res) => {
    try {
      const { teacherId, centerId, baseSalary, classBasePay, classBasePayMiddle, classBasePayHigh, studentThreshold, studentThresholdMiddle, studentThresholdHigh, perStudentBonus, perStudentBonusMiddle, perStudentBonusHigh, actorId } = req.body;
      
      // Require actorId and verify admin/principal role
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여 설정을 수정할 수 있습니다" });
      }
      
      // Check if settings already exist
      const existing = await storage.getTeacherSalarySettings(teacherId, centerId);
      
      if (existing) {
        const updated = await storage.updateTeacherSalarySettings(existing.id, {
          baseSalary,
          classBasePay,
          classBasePayMiddle: classBasePayMiddle || 0,
          classBasePayHigh: classBasePayHigh || 0,
          studentThreshold,
          studentThresholdMiddle: studentThresholdMiddle || 0,
          studentThresholdHigh: studentThresholdHigh || 0,
          perStudentBonus,
          perStudentBonusMiddle: perStudentBonusMiddle || 0,
          perStudentBonusHigh: perStudentBonusHigh || 0,
        });
        res.json(updated);
      } else {
        const created = await storage.createTeacherSalarySettings({
          teacherId,
          centerId,
          baseSalary: baseSalary || 0,
          classBasePay: classBasePay || 0,
          classBasePayMiddle: classBasePayMiddle || 0,
          classBasePayHigh: classBasePayHigh || 0,
          studentThreshold: studentThreshold || 0,
          studentThresholdMiddle: studentThresholdMiddle || 0,
          studentThresholdHigh: studentThresholdHigh || 0,
          perStudentBonus: perStudentBonus || 0,
          perStudentBonusMiddle: perStudentBonusMiddle || 0,
          perStudentBonusHigh: perStudentBonusHigh || 0,
        });
        res.json(created);
      }
    } catch (error) {
      console.error("Failed to save teacher salary settings:", error);
      res.status(500).json({ error: "Failed to save teacher salary settings" });
    }
  });

  app.delete("/api/teacher-salary-settings/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      // Require actorId and verify admin/principal role
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여 설정을 삭제할 수 있습니다" });
      }
      
      await storage.deleteTeacherSalarySettings(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete teacher salary settings:", error);
      res.status(500).json({ error: "Failed to delete teacher salary settings" });
    }
  });

  // Teacher Salary Adjustments (급여 조정 항목)
  app.get("/api/teacher-salary-adjustments", async (req, res) => {
    try {
      const { centerId, yearMonth, teacherId } = req.query;
      
      if (!centerId || !yearMonth) {
        return res.status(400).json({ error: "centerId and yearMonth are required" });
      }
      
      if (teacherId) {
        const adjustments = await storage.getTeacherSalaryAdjustments(
          teacherId as string,
          centerId as string,
          yearMonth as string
        );
        res.json(adjustments);
      } else {
        const adjustments = await storage.getTeacherSalaryAdjustmentsByCenter(
          centerId as string,
          yearMonth as string
        );
        res.json(adjustments);
      }
    } catch (error) {
      console.error("Failed to get teacher salary adjustments:", error);
      res.status(500).json({ error: "Failed to get teacher salary adjustments" });
    }
  });

  app.post("/api/teacher-salary-adjustments", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여를 조정할 수 있습니다" });
      }
      
      const { teacherId, centerId, yearMonth, amount, description } = req.body;
      
      if (!teacherId || !centerId || !yearMonth || amount === undefined || !description) {
        return res.status(400).json({ error: "모든 필드를 입력해주세요" });
      }
      
      const adjustment = await storage.createTeacherSalaryAdjustment({
        teacherId,
        centerId,
        yearMonth,
        amount: parseInt(amount),
        description,
        createdBy: actorId as string,
      });
      
      res.json(adjustment);
    } catch (error) {
      console.error("Failed to create teacher salary adjustment:", error);
      res.status(500).json({ error: "Failed to create teacher salary adjustment" });
    }
  });

  app.patch("/api/teacher-salary-adjustments/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여를 조정할 수 있습니다" });
      }
      
      const { amount, description } = req.body;
      const updated = await storage.updateTeacherSalaryAdjustment(req.params.id, {
        amount: amount !== undefined ? parseInt(amount) : undefined,
        description,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Failed to update teacher salary adjustment:", error);
      res.status(500).json({ error: "Failed to update teacher salary adjustment" });
    }
  });

  app.delete("/api/teacher-salary-adjustments/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여 조정을 삭제할 수 있습니다" });
      }
      
      await storage.deleteTeacherSalaryAdjustment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete teacher salary adjustment:", error);
      res.status(500).json({ error: "Failed to delete teacher salary adjustment" });
    }
  });

  // Calculate teacher salary for a month
  app.get("/api/teacher-salary-calculation/:teacherId/:yearMonth", async (req, res) => {
    try {
      const { teacherId, yearMonth } = req.params;
      const { centerId } = req.query;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      // Get salary settings
      const settings = await storage.getTeacherSalarySettings(teacherId, centerId as string);
      if (!settings) {
        return res.json({ 
          baseSalary: 0, 
          performanceBonus: 0, 
          totalSalary: 0,
          breakdown: { classes: [], classCount: 0, totalStudents: 0, bonusStudents: 0 }
        });
      }
      
      // Get classes taught by this teacher in this center
      const allClasses = await storage.getClasses(centerId as string, false);
      const teacherClasses = allClasses.filter(c => c.teacherId === teacherId);
      
      // Calculate performance bonus for each class
      let performanceBonus = 0;
      const classBreakdown = [];
      let totalStudents = 0;
      let bonusStudents = 0;
      
      for (const cls of teacherClasses) {
        // Get students enrolled in this class
        const enrollments = await storage.getClassEnrollments(cls.id);
        const studentCount = enrollments.length;
        totalStudents += studentCount;
        
        // Get base pay based on class level (중등/고등)
        const classLevel = (cls as any).classLevel || "middle";
        let classBasePay = settings.classBasePay; // fallback to legacy field
        let studentThreshold = settings.studentThreshold; // fallback to legacy field
        let perStudentBonus = settings.perStudentBonus; // fallback to legacy field
        
        // Use level-specific values if available
        if (classLevel === "high") {
          if (settings.classBasePayHigh > 0) classBasePay = settings.classBasePayHigh;
          if (settings.studentThresholdHigh > 0) studentThreshold = settings.studentThresholdHigh;
          if (settings.perStudentBonusHigh > 0) perStudentBonus = settings.perStudentBonusHigh;
        } else if (classLevel === "middle") {
          if (settings.classBasePayMiddle > 0) classBasePay = settings.classBasePayMiddle;
          if (settings.studentThresholdMiddle > 0) studentThreshold = settings.studentThresholdMiddle;
          if (settings.perStudentBonusMiddle > 0) perStudentBonus = settings.perStudentBonusMiddle;
        }
        
        // Base pay for this class
        let classBonus = classBasePay;
        
        // Additional pay for students over threshold
        if (studentCount > studentThreshold) {
          const extraStudents = studentCount - studentThreshold;
          bonusStudents += extraStudents;
          classBonus += extraStudents * perStudentBonus;
        }
        
        performanceBonus += classBonus;
        classBreakdown.push({
          classId: cls.id,
          className: cls.name,
          classLevel,
          studentCount,
          basePay: classBasePay,
          extraStudents: Math.max(0, studentCount - studentThreshold),
          extraPay: Math.max(0, studentCount - studentThreshold) * perStudentBonus,
          totalPay: classBonus,
        });
      }
      
      const totalSalary = settings.baseSalary + performanceBonus;
      
      res.json({
        baseSalary: settings.baseSalary,
        performanceBonus,
        totalSalary,
        breakdown: {
          classes: classBreakdown,
          classCount: teacherClasses.length,
          totalStudents,
          bonusStudents,
        },
      });
    } catch (error) {
      console.error("Failed to calculate teacher salary:", error);
      res.status(500).json({ error: "Failed to calculate teacher salary" });
    }
  });

  // ========================================
  // Teacher Work Records Scheduler
  // ========================================
  const runTeacherWorkMaintenance = async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, "yyyy-MM-dd");
      
      // Mark records without check-out as "noCheckOut = true"
      await storage.markMissingCheckOuts(yesterdayStr);
      console.log(`[Teacher Work] Marked missing check-outs for ${yesterdayStr}`);
      
      // Delete records older than 1 year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = format(oneYearAgo, "yyyy-MM-dd");
      
      await storage.deleteOldTeacherWorkRecords(oneYearAgoStr);
      console.log(`[Teacher Work] Deleted records older than ${oneYearAgoStr}`);
    } catch (error) {
      console.error("[Teacher Work] Maintenance error:", error);
    }
  };
  
  // Run at startup and then every day at 00:05 (5 minutes past midnight)
  setTimeout(() => {
    runTeacherWorkMaintenance();
    setInterval(runTeacherWorkMaintenance, 24 * 60 * 60 * 1000);
    console.log("[Teacher Work] Maintenance scheduler started. Will run daily.");
  }, 5 * 60 * 1000); // Initial delay of 5 minutes

  // ========================================
  // Attendance Records Cleanup Scheduler
  // ========================================
  const runAttendanceRecordsCleanup = async () => {
    try {
      // Delete attendance records older than 2 months
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const twoMonthsAgoStr = format(twoMonthsAgo, "yyyy-MM-dd");
      
      const deletedCount = await storage.deleteOldAttendanceRecords(twoMonthsAgoStr);
      console.log(`[Attendance] Deleted ${deletedCount} records older than ${twoMonthsAgoStr}`);
    } catch (error) {
      console.error("[Attendance] Cleanup error:", error);
    }
  };
  
  // Run at startup and then every day
  setTimeout(() => {
    runAttendanceRecordsCleanup();
    setInterval(runAttendanceRecordsCleanup, 24 * 60 * 60 * 1000);
    console.log("[Attendance] Cleanup scheduler started. Will run daily.");
  }, 6 * 60 * 1000); // Initial delay of 6 minutes (after teacher work maintenance)

  // ========================================
  // Student Textbook Purchases (학생 교재비)
  // ========================================
  app.get("/api/student-textbook-purchases", async (req, res) => {
    try {
      const { centerId, studentId } = req.query;
      
      if (studentId) {
        const purchases = await storage.getStudentTextbookPurchases(studentId as string);
        res.json(purchases);
      } else if (centerId) {
        const purchases = await storage.getStudentTextbookPurchasesByCenter(centerId as string);
        res.json(purchases);
      } else {
        return res.status(400).json({ error: "centerId or studentId is required" });
      }
    } catch (error) {
      console.error("Failed to get student textbook purchases:", error);
      res.status(500).json({ error: "Failed to get student textbook purchases" });
    }
  });

  app.post("/api/student-textbook-purchases", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 교재비를 등록할 수 있습니다" });
      }
      
      const { studentId, centerId, textbookName, price, purchaseDate, notes } = req.body;
      
      if (!studentId || !centerId || !textbookName) {
        return res.status(400).json({ error: "학생, 센터, 교재명은 필수입니다" });
      }
      
      const purchase = await storage.createStudentTextbookPurchase({
        studentId,
        centerId,
        textbookName,
        price: price || 0,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        notes,
        createdById: actorId as string,
      });
      
      res.json(purchase);
    } catch (error) {
      console.error("Failed to create student textbook purchase:", error);
      res.status(500).json({ error: "Failed to create student textbook purchase" });
    }
  });

  app.patch("/api/student-textbook-purchases/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 교재비를 수정할 수 있습니다" });
      }
      
      const { textbookName, price, purchaseDate, notes } = req.body;
      const updated = await storage.updateStudentTextbookPurchase(req.params.id, {
        textbookName,
        price,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        notes,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Failed to update student textbook purchase:", error);
      res.status(500).json({ error: "Failed to update student textbook purchase" });
    }
  });

  app.delete("/api/student-textbook-purchases/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 교재비를 삭제할 수 있습니다" });
      }
      
      await storage.deleteStudentTextbookPurchase(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete student textbook purchase:", error);
      res.status(500).json({ error: "Failed to delete student textbook purchase" });
    }
  });

  // Points System Routes
  app.get("/api/points/my-points", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      const points = await storage.getStudentPoints(actorId as string);
      const history = await storage.getPointTransactions(actorId as string, 20);
      
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyTransactions = await storage.getPointTransactionsSince(actorId as string, monthStart);
      const monthlyEarned = monthlyTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      res.json({
        total: points?.totalPoints || 0,
        available: points?.availablePoints || 0,
        monthlyEarned,
        history: history.map(h => ({
          description: h.description,
          amount: h.amount,
          date: format(h.createdAt!, "yyyy-MM-dd"),
        })),
      });
    } catch (error) {
      console.error("Failed to get points:", error);
      res.status(500).json({ error: "Failed to get points" });
    }
  });

  app.get("/api/students/with-points", async (req, res) => {
    try {
      const { actorId, centerId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 접근 가능합니다" });
      }
      
      const students = await storage.getStudentsWithPoints(centerId as string);
      res.json(students);
    } catch (error) {
      console.error("Failed to get students with points:", error);
      res.status(500).json({ error: "Failed to get students with points" });
    }
  });

  app.post("/api/points/add", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 포인트를 지급할 수 있습니다" });
      }
      
      const { studentId, amount, reason } = req.body;
      if (!studentId || !amount || !reason) {
        return res.status(400).json({ error: "학생, 포인트, 사유는 필수입니다" });
      }
      
      await storage.addPoints(studentId, amount, "manual", reason, actorId as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to add points:", error);
      res.status(500).json({ error: "Failed to add points" });
    }
  });

  app.post("/api/points/use", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 포인트를 사용할 수 있습니다" });
      }
      
      const { studentId, amount, reason } = req.body;
      if (!studentId || !amount || !reason) {
        return res.status(400).json({ error: "학생, 포인트, 사유는 필수입니다" });
      }
      
      await storage.usePoints(studentId, amount, reason, actorId as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to use points:", error);
      res.status(500).json({ error: "Failed to use points" });
    }
  });

  // Class Plans Routes
  app.get("/api/classes", async (req, res) => {
    try {
      const { actorId, centerId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      const allClasses = await storage.getClasses(centerId as string | undefined);
      res.json(allClasses.filter(c => !c.isArchived));
    } catch (error) {
      console.error("Failed to get classes:", error);
      res.status(500).json({ error: "Failed to get classes" });
    }
  });

  app.get("/api/class-plans/weekly", async (req, res) => {
    try {
      const { actorId, classId, weekStart } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      if (!classId) {
        return res.json(null);
      }
      
      const plan = await storage.getClassPlan(classId as string, "weekly", weekStart as string);
      res.json(plan);
    } catch (error) {
      console.error("Failed to get weekly plan:", error);
      res.status(500).json({ error: "Failed to get weekly plan" });
    }
  });

  app.get("/api/class-plans/monthly", async (req, res) => {
    try {
      const { actorId, classId, month } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      if (!classId) {
        return res.json(null);
      }
      
      const monthStart = `${month}-01`;
      const plan = await storage.getClassPlan(classId as string, "monthly", monthStart);
      res.json(plan);
    } catch (error) {
      console.error("Failed to get monthly plan:", error);
      res.status(500).json({ error: "Failed to get monthly plan" });
    }
  });

  app.post("/api/class-plans/weekly", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 수업 계획을 작성할 수 있습니다" });
      }
      
      const { classId, weekStart, content } = req.body;
      if (!classId || !weekStart) {
        return res.status(400).json({ error: "수업과 주 시작일은 필수입니다" });
      }
      
      const plan = await storage.upsertClassPlan(classId, "weekly", weekStart, content || "", actorId as string);
      res.json(plan);
    } catch (error) {
      console.error("Failed to save weekly plan:", error);
      res.status(500).json({ error: "Failed to save weekly plan" });
    }
  });

  app.post("/api/class-plans/monthly", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 수업 계획을 작성할 수 있습니다" });
      }
      
      const { classId, month, content } = req.body;
      if (!classId || !month) {
        return res.status(400).json({ error: "수업과 월은 필수입니다" });
      }
      
      const monthStart = `${month}-01`;
      const plan = await storage.upsertClassPlan(classId, "monthly", monthStart, content || "", actorId as string);
      res.json(plan);
    } catch (error) {
      console.error("Failed to save monthly plan:", error);
      res.status(500).json({ error: "Failed to save monthly plan" });
    }
  });

  return httpServer;
}
