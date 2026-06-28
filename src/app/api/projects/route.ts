import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { s3Client } from "@/lib/aws";

// Auto-detect survey columns
function autoDetectColumns(rows: any[]): { textCols: string[]; ratingCols: string[]; dateCols: string[] } {
  const textCols: string[] = [];
  const ratingCols: string[] = [];
  const dateCols: string[] = [];

  if (rows.length === 0) return { textCols, ratingCols, dateCols };

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);

  for (const key of keys) {
    const keyLower = key.toLowerCase();
    
    // Find representative values for the column across the first few rows
    const valuesSample = rows.slice(0, 5).map(r => r[key]).filter(v => v !== null && v !== undefined);
    if (valuesSample.length === 0) continue;
    const value = valuesSample[0];

    // Check by header name keywords or value types
    if (
      keyLower.includes("date") ||
      keyLower.includes("time") ||
      keyLower.includes("created") ||
      !isNaN(Date.parse(value.toString())) && value.toString().includes("-")
    ) {
      dateCols.push(key);
    } else if (
      keyLower.includes("rate") ||
      keyLower.includes("rating") ||
      keyLower.includes("score") ||
      keyLower.includes("csat") ||
      keyLower.includes("nps") ||
      typeof value === "number"
    ) {
      ratingCols.push(key);
    } else if (
      keyLower.includes("feedback") ||
      keyLower.includes("comment") ||
      keyLower.includes("response") ||
      keyLower.includes("text") ||
      keyLower.includes("why") ||
      keyLower.includes("what") ||
      (
        typeof value === "string" && 
        value.trim().length > 12 && 
        !["yes", "no", "true", "false"].includes(value.trim().toLowerCase())
      )
    ) {
      textCols.push(key);
    }
  }

  return { textCols, ratingCols, dateCols };
}

export async function GET(req: Request) {
  try {
    const userEmail = req.headers.get("x-user-email");
    let user;
    if (userEmail) {
      user = await prisma.user.findFirst({
        where: { email: userEmail }
      });
    }
    if (!user) {
      user = await prisma.user.findFirst();
    }
    if (!user) {
      const org = await prisma.organization.create({ data: { name: "Default Org" } });
      user = await prisma.user.create({
        data: {
          name: "Default Analyst",
          email: "analyst@surveyiq.app",
          passwordHash: "demo123",
          organizationId: org.id
        }
      });
    }

    const projects = await prisma.project.findMany({
      where: { organizationId: user.organizationId },
      include: {
        surveyFiles: true,
        reports: true
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    console.error("GET Projects Error:", error);
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, description, s3Key, filename, fileSize } = await req.json();

    if (!name || !s3Key || !filename) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userEmail = req.headers.get("x-user-email");
    let user;
    if (userEmail) {
      user = await prisma.user.findFirst({
        where: { email: userEmail }
      });
    }
    if (!user) {
      user = await prisma.user.findFirst();
    }
    if (!user) {
      const org = await prisma.organization.create({ data: { name: "Default Org" } });
      user = await prisma.user.create({
        data: {
          name: "Default Analyst",
          email: "analyst@surveyiq.app",
          passwordHash: "demo123",
          organizationId: org.id
        }
      });
    }

    // 1. Fetch file buffer from Amazon S3
    const bucketName = process.env.AWS_S3_BUCKET || "surveyiq-uploads";
    let buffer: Buffer;

    try {
      const s3Response = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: s3Key
        })
      );
      
      const chunks = [];
      for await (const chunk of s3Response.Body as any) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    } catch (s3Error) {
      console.error("S3 GetObject Error:", s3Error);
      return NextResponse.json({ error: "Failed to fetch uploaded file from S3" }, { status: 404 });
    }

    // 2. Parse Excel/CSV workbook using xlsx package
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    let rawRows = XLSX.utils.sheet_to_json(sheet) as any[];

    // Filter out rows that are part of multiple headers (Unique ID must be a valid number)
    rawRows = rawRows.filter(row => {
      const idKey = Object.keys(row).find(k => k.toLowerCase().includes("unique id") || k.toLowerCase() === "id");
      if (!idKey) return true;
      const val = row[idKey];
      return val !== null && val !== undefined && !isNaN(Number(val.toString().trim()));
    });

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Uploaded survey file is empty" }, { status: 400 });
    }

    // 3. Auto-detect columns
    const columnMappings = autoDetectColumns(rawRows);

    // 4. Create Project, SurveyFile, and Response rows in a database transaction
    const project = await prisma.$transaction(async (tx: any) => {
      const proj = await tx.project.create({
        data: {
          name,
          description,
          organizationId: user.organizationId,
          createdById: user.id,
          status: "PENDING"
        }
      });

      await tx.surveyFile.create({
        data: {
          projectId: proj.id,
          s3Key,
          filename,
          fileSize: fileSize || 0,
          totalRowCount: rawRows.length,
          columnMappings: columnMappings as any
        }
      });

      // Write raw responses into DB
      const responseData = rawRows.map((row, index) => ({
        projectId: proj.id,
        rowIndex: index + 1,
        rawData: row as any,
        responseHash: "" // Calculated during analysis pipeline
      }));

      await tx.response.createMany({
        data: responseData
      });

      return proj;
    });

    return NextResponse.json({
      message: "Project created successfully",
      projectId: project.id,
      detectedColumns: columnMappings,
      rowCount: rawRows.length
    }, { status: 201 });
  } catch (error) {
    console.error("POST Project Error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
