import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "homework-images";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 credentials not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
    }
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      // Disable checksum for R2 compatibility
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return r2Client;
}

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

export async function getUploadUrl(contentType: string = "image/jpeg", prefix: string = "homework"): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string }> {
  const client = getR2Client();
  const objectKey = `${prefix}/${randomUUID()}`;
  
  // Don't include ContentType in the command - let the client set it freely
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });

  // Generate presigned URL with minimal signed headers for R2 compatibility
  const uploadUrl = await getSignedUrl(client, command, { 
    expiresIn: 900,
    // Only sign the essential headers - let content-type be unsigned
    signableHeaders: new Set(['host']),
    // Exclude checksum-related headers from signature
    unhoistableHeaders: new Set([
      'content-type',
      'x-amz-checksum-crc32',
      'x-amz-checksum-crc32c', 
      'x-amz-checksum-sha1',
      'x-amz-checksum-sha256',
      'x-amz-sdk-checksum-algorithm',
    ]),
  });
  
  const publicUrl = R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/${objectKey}`
    : uploadUrl.split("?")[0];

  return { uploadUrl, objectKey, publicUrl };
}

export async function getDownloadUrl(objectKey: string): Promise<string> {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${objectKey}`;
  }
  
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });

  return await getSignedUrl(client, command, { expiresIn: 3600 });
}

export async function deleteObject(objectKey: string): Promise<void> {
  const client = getR2Client();
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });
  await client.send(command);
}

export async function deleteExpiredObjects(maxAgeDays: number = 10): Promise<number> {
  const client = getR2Client();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
  
  let deletedCount = 0;
  let continuationToken: string | undefined;
  
  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: "homework/",
      ContinuationToken: continuationToken,
    });
    
    const response = await client.send(listCommand);
    
    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.LastModified && object.LastModified < cutoffDate && object.Key) {
          try {
            await deleteObject(object.Key);
            deletedCount++;
            console.log(`[R2 Cleanup] Deleted expired object: ${object.Key}`);
          } catch (error) {
            console.error(`[R2 Cleanup] Failed to delete ${object.Key}:`, error);
          }
        }
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return deletedCount;
}

export async function startCleanupScheduler(intervalHours: number = 24): Promise<void> {
  const runCleanup = async () => {
    if (!isR2Configured()) {
      console.log("[R2 Cleanup] R2 not configured, skipping cleanup");
      return;
    }
    
    console.log("[R2 Cleanup] Starting cleanup of expired homework images...");
    try {
      const deletedCount = await deleteExpiredObjects(10);
      console.log(`[R2 Cleanup] Cleanup complete. Deleted ${deletedCount} expired objects.`);
    } catch (error) {
      console.error("[R2 Cleanup] Cleanup failed:", error);
    }
  };

  await runCleanup();
  
  setInterval(runCleanup, intervalHours * 60 * 60 * 1000);
  console.log(`[R2 Cleanup] Scheduler started. Will run every ${intervalHours} hours.`);
}
