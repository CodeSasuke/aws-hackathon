import { NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@/lib/aws";

export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }

    // Call S3 presigned URL helper
    const presignedData = await getPresignedUploadUrl(filename, contentType);

    return NextResponse.json(presignedData, { status: 200 });
  } catch (error) {
    console.error("Presigned URL API Error:", error);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
