import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        surveyFiles: true,
        themes: {
          orderBy: { count: "desc" }
        },
        reports: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Retrieve up to 500 responses to display in our Excel editor grid
    const responses = await prisma.response.findMany({
      where: { projectId: id },
      orderBy: { rowIndex: "asc" },
      take: 500
    });

    return NextResponse.json({
      project,
      responses
    }, { status: 200 });
  } catch (error) {
    console.error("GET Project Details Error:", error);
    return NextResponse.json({ error: "Failed to fetch project details" }, { status: 500 });
  }
}
