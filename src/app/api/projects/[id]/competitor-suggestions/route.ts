import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id } = await params;
    const suggestions = await prisma.competitorSuggestion.findMany({
      where: { projectId: id },
      orderBy: [
        { mentions: "desc" }
      ]
    });
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("GET competitor-suggestions error:", error);
    return NextResponse.json({ error: "Failed to fetch competitor suggestions" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id: projectId } = await params;
    const { brandName, status, aliases } = await req.json();
    
    // 1. Update status
    const updatedSuggestion = await prisma.competitorSuggestion.update({
      where: {
        projectId_brandName: {
          projectId,
          brandName
        }
      },
      data: { status }
    });
    
    // 2. If approved, merge into project nlpConfig
    if (status === "APPROVED") {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { nlpConfig: true }
      });
      
      if (project) {
        const currentConfig = (project.nlpConfig as any) || {
          primaryBrand: "SurveyIQ",
          competitors: [],
          categories: [],
          ignoreWords: [],
          customPhrases: []
        };
        
        // Check if already exists in competitors
        const exists = currentConfig.competitors.some((c: any) => {
          if (typeof c === "string") {
            return c.toLowerCase() === brandName.toLowerCase();
          }
          return c.name.toLowerCase() === brandName.toLowerCase();
        });
        
        if (!exists) {
          currentConfig.competitors.push({
            name: brandName,
            aliases: aliases || []
          });
          
          await prisma.project.update({
            where: { id: projectId },
            data: { nlpConfig: currentConfig }
          });
        }
      }
    }
    
    return NextResponse.json(updatedSuggestion);
  } catch (error) {
    console.error("PATCH competitor-suggestions error:", error);
    return NextResponse.json({ error: "Failed to update competitor suggestion" }, { status: 500 });
  }
}
