import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      select: { nlpConfig: true }
    });
    
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    
    return NextResponse.json(project.nlpConfig || {
      primaryBrand: "SurveyIQ",
      competitors: [],
      categories: [],
      ignoreWords: [],
      customPhrases: []
    });
  } catch (error) {
    console.error("GET nlp-config error:", error);
    return NextResponse.json({ error: "Failed to fetch NLP configuration" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Support both direct config payload and wrapped body { config, syncGlobal }
    const config = body.config !== undefined ? body.config : body;
    const syncGlobal = body.syncGlobal || false;
    
    const currentProject = await prisma.project.findUnique({
      where: { id },
      select: { organizationId: true }
    });

    if (syncGlobal && currentProject?.organizationId) {
      await prisma.project.updateMany({
        where: { organizationId: currentProject.organizationId },
        data: { nlpConfig: config }
      });
    } else {
      await prisma.project.update({
        where: { id },
        data: { nlpConfig: config }
      });
    }
    
    return NextResponse.json(config);
  } catch (error) {
    console.error("PATCH nlp-config error:", error);
    return NextResponse.json({ error: "Failed to update NLP configuration" }, { status: 500 });
  }
}
