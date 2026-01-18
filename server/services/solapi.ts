import { SolapiMessageService } from "solapi";
import { storage } from "../storage";
import { decrypt } from "../crypto";

interface CenterCredentials {
  apiKey: string;
  apiSecret: string;
  senderNumber: string;
}

// Simple cache with TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
const centerNameToIdCache: Map<string, { value: string; expires: number }> = new Map();
const messageServicesCache: Map<string, { value: SolapiMessageService; expires: number }> = new Map();

function getCachedValue<T>(cache: Map<string, { value: T; expires: number }>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) {
    return entry.value;
  }
  if (entry) cache.delete(key);
  return null;
}

function setCachedValue<T>(cache: Map<string, { value: T; expires: number }>, key: string, value: T): void {
  // Limit cache size to prevent memory leaks
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
}

const envCredentials: Record<string, Partial<CenterCredentials>> = {
  "DMC센터": {
    apiKey: process.env.SOLAPI_API_KEY_DMC,
    apiSecret: process.env.SOLAPI_API_SECRET_DMC,
    senderNumber: process.env.SOLAPI_SENDER_NUMBER_DMC,
  },
  "목동센터": {
    apiKey: process.env.SOLAPI_API_KEY,
    apiSecret: process.env.SOLAPI_API_SECRET,
    senderNumber: process.env.SOLAPI_SENDER_NUMBER_MOKDONG,
  },
};

async function getCenterIdByName(centerName: string): Promise<string | null> {
  const cached = getCachedValue(centerNameToIdCache, centerName);
  if (cached) return cached;
  
  try {
    const centers = await storage.getCenters();
    const center = centers.find(c => c.name === centerName);
    if (center) {
      setCachedValue(centerNameToIdCache, centerName, center.id);
      return center.id;
    }
  } catch (error) {
    console.error("[SOLAPI] Error getting center ID:", error);
  }
  return null;
}

async function getCredentialsFromDb(centerId: string): Promise<CenterCredentials | null> {
  try {
    const dbCreds = await storage.getSolapiCredentials(centerId);
    if (dbCreds) {
      return {
        apiKey: decrypt(dbCreds.apiKey),
        apiSecret: decrypt(dbCreds.apiSecret),
        senderNumber: dbCreds.senderNumber,
      };
    }
  } catch (error) {
    console.error("[SOLAPI] Error decrypting credentials from DB:", error);
  }
  return null;
}

async function getCredentials(centerName: string): Promise<CenterCredentials | null> {
  const centerId = await getCenterIdByName(centerName);
  
  if (centerId) {
    const dbCreds = await getCredentialsFromDb(centerId);
    if (dbCreds && dbCreds.apiKey && dbCreds.apiSecret && dbCreds.senderNumber) {
      console.log("[SOLAPI] Using database credentials for", centerName);
      return dbCreds;
    }
  }
  
  const envCreds = envCredentials[centerName];
  if (envCreds?.apiKey && envCreds?.apiSecret && envCreds?.senderNumber) {
    console.log("[SOLAPI] Using environment variable credentials for", centerName);
    return envCreds as CenterCredentials;
  }
  
  console.warn(`[SOLAPI] No credentials found for ${centerName}`);
  return null;
}

async function getMessageService(centerName: string): Promise<SolapiMessageService | null> {
  const creds = await getCredentials(centerName);
  if (!creds) {
    return null;
  }
  
  const cacheKey = `${centerName}_${creds.apiKey.slice(-4)}`;
  const cached = getCachedValue(messageServicesCache, cacheKey);
  if (cached) return cached;
  
  const service = new SolapiMessageService(creds.apiKey, creds.apiSecret);
  setCachedValue(messageServicesCache, cacheKey, service);
  return service;
}

export interface SendSmsParams {
  to: string;
  text: string;
  centerName?: string;
}

export interface SendAlimtalkParams {
  to: string;
  templateId: string;
  variables?: Record<string, string>;
}

export async function sendSms(params: SendSmsParams): Promise<{ success: boolean; error?: string }> {
  const centerName = params.centerName || "DMC센터";
  console.log("[SOLAPI] sendSms called:", { to: params.to, centerName, textLength: params.text.length });
  
  const creds = await getCredentials(centerName);
  if (!creds) {
    console.log("[SOLAPI] Credentials not configured for", centerName);
    return { success: false, error: `SOLAPI not configured for ${centerName}` };
  }
  
  const service = await getMessageService(centerName);
  if (!service) {
    console.log("[SOLAPI] Service not available for", centerName);
    return { success: false, error: `SOLAPI service not available for ${centerName}` };
  }

  console.log("[SOLAPI] Sending SMS from:", creds.senderNumber, "to:", params.to.replace(/-/g, ""));
  
  try {
    console.log("[SOLAPI] Attempting to send message with params:", {
      to: params.to.replace(/-/g, ""),
      from: creds.senderNumber,
      textPreview: params.text.substring(0, 50) + "...",
    });
    
    const result = await service.sendOne({
      to: params.to.replace(/-/g, ""),
      from: creds.senderNumber,
      text: params.text,
    });
    
    console.log("[SOLAPI] sendOne result:", JSON.stringify(result, null, 2));
    console.log("[SOLAPI] SMS sent successfully");
    return { success: true };
  } catch (error: any) {
    const errorStr = error?.toString?.() || "No toString";
    
    console.error("[SOLAPI] SMS send error - toString:", errorStr);
    console.error("[SOLAPI] Error name:", error?.name);
    console.error("[SOLAPI] Error message:", error?.message);
    
    try {
      console.error("[SOLAPI] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      console.error("[SOLAPI] Could not stringify error");
    }
    
    if (error?.response) {
      console.error("[SOLAPI] Error response:", JSON.stringify(error.response));
    }
    if (error?.cause) {
      console.error("[SOLAPI] Error cause:", error.cause);
    }
    if (error?._tag) {
      console.error("[SOLAPI] Error _tag:", error._tag);
    }
    
    return { success: false, error: error?.message || errorStr || "Failed to send SMS" };
  }
}

export async function sendAttendanceNotification(
  studentName: string,
  checkInTime: Date,
  parentPhone: string,
  centerName?: string,
  customTemplate?: string
): Promise<{ success: boolean; error?: string }> {
  const timeStr = checkInTime.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = checkInTime.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  let text = customTemplate || `[프라임수학] {학생명} 학생이 {시간}에 출석하였습니다.`;
  text = text.replace(/{학생명}/g, studentName);
  text = text.replace(/{시간}/g, timeStr);
  text = text.replace(/{날짜}/g, dateStr);
  
  return sendSms({
    to: parentPhone,
    text,
    centerName,
  });
}

export async function sendLateNotification(
  studentName: string,
  _expectedTime: string,
  parentPhone: string,
  centerName?: string,
  customTemplate?: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let text = customTemplate || `[프라임수학] {학생명} 학생이 수업에 참여하지 않았습니다. 빠르게 등원할 수 있도록 해주세요.`;
  text = text.replace(/{학생명}/g, studentName);
  text = text.replace(/{시간}/g, timeStr);
  text = text.replace(/{날짜}/g, dateStr);
  
  return sendSms({
    to: parentPhone,
    text,
    centerName,
  });
}

export async function isSolapiConfigured(centerName?: string): Promise<boolean> {
  const center = centerName || "DMC센터";
  const creds = await getCredentials(center);
  return !!(creds?.apiKey && creds?.apiSecret && creds?.senderNumber);
}

export async function sendSMS(
  centerId: string,
  to: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const centers = await storage.getCenters();
  const center = centers.find(c => c.id === centerId);
  if (!center) {
    return { success: false, error: "Center not found" };
  }
  
  return sendSms({
    to,
    text,
    centerName: center.name,
  });
}
