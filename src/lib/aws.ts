import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "placeholder",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "placeholder",
};

// S3 client — uses AWS_REGION (ap-south-1, where your bucket is)
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials,
});

/**
 * Generate a presigned S3 upload URL for survey Excel/CSV uploads
 */
export async function getPresignedUploadUrl(filename: string, contentType: string): Promise<{ url: string; key: string }> {
  const timestamp = Date.now();
  const key = `uploads/${timestamp}-${filename}`;
  const bucketName = process.env.AWS_S3_BUCKET || "surveyiq-uploads";

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return { url, key };
}

/**
 * Generate a presigned S3 download URL for reports and sheets
 */
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET || "surveyiq-uploads";

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

