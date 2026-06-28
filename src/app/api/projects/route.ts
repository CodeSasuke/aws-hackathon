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
  const totalRowsCount = rows.length;

  for (const key of keys) {
    const keyLower = key.toLowerCase();
    
    // Gather all non-empty values for this column across the dataset
    const values = rows
      .map(r => r[key])
      .filter(v => v !== null && v !== undefined && v.toString().trim() !== "");
      
    if (values.length === 0) continue;
    const firstVal = values[0];

    // 1. Date checks
    if (
      keyLower.includes("date") ||
      keyLower.includes("time") ||
      keyLower.includes("created") ||
      (!isNaN(Date.parse(firstVal.toString())) && firstVal.toString().includes("-"))
    ) {
      dateCols.push(key);
      continue;
    }

    // 2. Rating score checks (all numeric values)
    const isAllNumbers = values.every(v => !isNaN(Number(v.toString().trim())));
    if (isAllNumbers) {
      const isIdColumn = keyLower.includes("id") || keyLower.includes("index") || keyLower.includes("row");
      if (!isIdColumn) {
        ratingCols.push(key);
      }
      continue;
    }

    // 3. Open-ended vs. Multiple-choice Categorical checks
    const uniqueValues = new Set(values.map(v => v.toString().trim()));
    const uniquenessRatio = uniqueValues.size / values.length;
    
    const wordCounts = values.map(v => v.toString().trim().split(/\s+/).length);
    const avgWordCount = wordCounts.reduce((a, b) => a + b, 0) / values.length;

    const hasFeedbackKeywords = 
      keyLower.includes("feedback") ||
      keyLower.includes("comment") ||
      keyLower.includes("response") ||
      keyLower.includes("explain") ||
      keyLower.includes("describe") ||
      keyLower.includes("why") ||
      keyLower.includes("what") ||
      keyLower.includes("open") ||
      keyLower.includes("oe_") ||
      keyLower.includes("openended");

    // Standard rating scale or category keywords representing closed multiple choice selections
    const scaleKeywords = [
      "relevant", "appealing", "different", "believable", "expensive", "buy", "frequency",
      "praise", "neutral", "agree", "disagree", "satisfied", "dissatisfied", "probably", "definitely",
      "male", "female", "urban", "rural", "town", "city", "suburban", "yes", "no"
    ];
    const hasScaleValues = values.slice(0, 10).some(v => 
      scaleKeywords.some(kw => v.toString().toLowerCase().includes(kw))
    );

    const isLongEnough = values.some(v => v.toString().trim().length > 12);
    const isCardinalityHigh = totalRowsCount > 10 ? uniquenessRatio > 0.35 : uniquenessRatio >= 0.6;

    if (
      (isCardinalityHigh && avgWordCount > 1.8 && isLongEnough && !hasScaleValues) ||
      (hasFeedbackKeywords && avgWordCount > 1.5)
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
    const { name, description, s3Key, filename, fileSize, textColumns } = await req.json();

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

    // 3. Auto-detect columns, then override textCols if user specified them
    const columnMappings = autoDetectColumns(rawRows);
    
    // If user explicitly provided open-ended text columns, use those instead
    if (textColumns && Array.isArray(textColumns) && textColumns.length > 0) {
      columnMappings.textCols = textColumns;
    }

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
      allColumns: rawRows.length > 0 ? Object.keys(rawRows[0]) : [],
      rowCount: rawRows.length
    }, { status: 201 });
  } catch (error) {
    console.error("POST Project Error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
