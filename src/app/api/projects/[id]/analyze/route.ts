import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSurveyAnalysisPipeline } from "@/lib/pipeline";

export async function POST(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if project is already analyzing
    if (["PARSING", "CLUSTERING", "ANALYZING", "GENERATING_REPORTS"].includes(project.status)) {
      return NextResponse.json({ message: "Analysis already in progress", status: project.status }, { status: 200 });
    }

    // Create an AnalysisJob task directly in the queue using Prisma
    await prisma.analysisJob.create({
      data: {
        projectId: id,
        status: "PENDING",
        priority: 0,
        progress: 0
      }
    });

    // Update parent Project status to PENDING
    await prisma.project.update({
      where: { id },
      data: { status: "PENDING" }
    });

    // Trigger Next.js background execution of the pipeline
    runSurveyAnalysisPipeline(id).catch(async (err) => {
      console.error("Error executing background analysis pipeline:", err);
      try {
        await prisma.project.update({
          where: { id },
          data: { status: "FAILED" }
        });
      } catch (dbErr) {
        console.error("Failed to update status to FAILED:", dbErr);
      }
    });

    return NextResponse.json({
      message: "Analysis job scheduled in queue successfully",
      status: "PENDING"
    }, { status: 200 });
  } catch (error) {
    console.error("POST Analyze Error:", error);
    return NextResponse.json({ error: "Failed to trigger analysis" }, { status: 500 });
  }
}
