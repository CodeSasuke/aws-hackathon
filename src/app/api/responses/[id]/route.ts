import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { sentiment, category, themeName, suggestedAction, urgency } = body;

    // Find the response
    const response = await prisma.response.findUnique({
      where: { id }
    });

    if (!response) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    const projectId = response.projectId;
    let themeId = response.themeId;

    // If themeName is provided, find or create the Theme record
    if (themeName !== undefined && themeName !== null) {
      const cleanThemeName = themeName.trim();
      if (cleanThemeName) {
        const theme = await prisma.theme.upsert({
          where: {
            projectId_name: {
              projectId,
              name: cleanThemeName
            }
          },
          update: {},
          create: {
            projectId,
            name: cleanThemeName,
            category: category || "General",
            count: 0
          }
        });
        themeId = theme.id;
      } else {
        themeId = null;
      }
    }

    // Resolve user ID for AuditLog
    const userEmail = req.headers.get("x-user-email");
    let user = userEmail ? await prisma.user.findFirst({ where: { email: userEmail } }) : null;
    if (!user) {
      user = await prisma.user.findFirst();
    }
    if (!user) {
      // Create default analyst if none exists
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

    // Track old values for audit logging
    const changes: Record<string, any> = {};
    if (sentiment !== undefined && sentiment !== response.sentiment) {
      changes.sentiment = { old: response.sentiment, new: sentiment };
    }
    if (category !== undefined && category !== response.category) {
      changes.category = { old: response.category, new: category };
    }
    if (themeId !== response.themeId) {
      changes.themeId = { old: response.themeId, new: themeId };
    }
    if (suggestedAction !== undefined && suggestedAction !== response.suggestedAction) {
      changes.suggestedAction = { old: response.suggestedAction, new: suggestedAction };
    }
    if (urgency !== undefined && urgency !== response.urgency) {
      changes.urgency = { old: response.urgency, new: urgency };
    }

    // Perform database updates inside transaction
    const updatedResponse = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.response.update({
        where: { id },
        data: {
          ...(sentiment !== undefined ? { sentiment } : {}),
          ...(category !== undefined ? { category } : {}),
          themeId,
          ...(suggestedAction !== undefined ? { suggestedAction } : {}),
          ...(urgency !== undefined ? { urgency: parseInt(urgency.toString()) } : {})
        }
      });

      // Recalculate counts for all themes in this project
      const themes = await tx.theme.findMany({
        where: { projectId }
      });

      for (const t of themes) {
        const count = await tx.response.count({
          where: {
            projectId,
            themeId: t.id,
            isSpam: false
          }
        });
        await tx.theme.update({
          where: { id: t.id },
          data: { count }
        });
      }

      // Log manual audit trail
      if (Object.keys(changes).length > 0) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            projectId,
            action: "MANUAL_OVERRIDE",
            metadata: {
              responseId: id,
              rowIndex: response.rowIndex,
              changes
            }
          }
        });
      }

      return updated;
    });

    return NextResponse.json(updatedResponse, { status: 200 });
  } catch (error) {
    console.error("PATCH Response Override Error:", error);
    return NextResponse.json({ error: "Failed to update response override" }, { status: 500 });
  }
}
