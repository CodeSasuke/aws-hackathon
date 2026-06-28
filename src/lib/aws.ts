import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "placeholder",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "placeholder",
};

// S3 client — uses AWS_REGION (ap-south-1, where your bucket is)
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials,
});

// Bedrock client — always uses us-east-1 (Claude 3.5 Sonnet guaranteed available)
export const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_BEDROCK_REGION || "us-east-1",
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

/**
 * Invoke Claude 3.5 Sonnet on AWS Bedrock
 */
export async function invokeClaude35(systemPrompt: string, userPrompt: string, temperature = 0.2): Promise<string> {
  const modelId = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
  
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    temperature,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userPrompt
          }
        ]
      }
    ]
  };

  try {
    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (responseBody?.content && responseBody.content.length > 0) {
      return responseBody.content[0].text;
    }
    throw new Error("Empty response from Bedrock model");
  } catch (error) {
    console.error("AWS Bedrock Invocation Error:", error);
    throw error;
  }
}
