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

    // Start hybrid AI pipeline asynchronously in the background
    runSurveyAnalysisPipeline(id).catch(async (error) => {
      console.error(`Background analysis failed for project ${id}:`, error);
      
      // Update status to FAILED
      await prisma.project.update({
        where: { id },
        data: { status: "FAILED" }
      }).catch(e => console.error("Failed to set project status to FAILED:", e));
    });

    return NextResponse.json({
      message: "Analysis pipeline started successfully",
      status: "PARSING"
    }, { status: 200 });
  } catch (error) {
    console.error("POST Analyze Error:", error);
    return NextResponse.json({ error: "Failed to trigger analysis" }, { status: 500 });
  }
}
