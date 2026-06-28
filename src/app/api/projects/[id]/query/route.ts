import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id } = await params;
    const { query } = await req.json();

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        themes: {
          orderBy: { count: "desc" }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const responses = await prisma.response.findMany({
      where: { projectId: id }
    });

    const total = responses.length;
    const negativeResponses = responses.filter(r => r.sentiment === "NEGATIVE");
    const positiveResponses = responses.filter(r => r.sentiment === "POSITIVE");
    const neutralResponses = responses.filter(r => r.sentiment === "NEUTRAL");

    const negPercent = total ? Math.round((negativeResponses.length / total) * 100) : 0;
    const posPercent = total ? Math.round((positiveResponses.length / total) * 100) : 0;

    let answer = "";

    const queryStr = (query || "").toLowerCase();

    if (queryStr.includes("unhappy") || queryStr.includes("complain") || queryStr.includes("negative")) {
      // Find top negative themes/categories from responses
      const negThemesMap: Record<string, { count: number, category: string, action: string }> = {};
      negativeResponses.forEach(r => {
        const tName = r.category || "General";
        if (!negThemesMap[tName]) {
          negThemesMap[tName] = { count: 0, category: r.category || "General", action: r.suggestedAction || "Review feedback" };
        }
        negThemesMap[tName].count++;
      });

      const sortedNeg = Object.entries(negThemesMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);

      answer = `### Critical Friction Areas Identified (Based on ${negativeResponses.length} Negative Responses):\n\n`;
      if (sortedNeg.length > 0) {
        sortedNeg.forEach(([name, details], idx) => {
          answer += `${idx + 1}. **${name} (Count: ${details.count}):** Customers expressed dissatisfaction in this area. Impacting approximately ${Math.round((details.count / (total || 1)) * 100)}% of total responses.\n   *Recommended Action:* ${details.action}\n\n`;
        });
      } else {
        answer += "No negative sentiment themes detected in the survey responses yet.";
      }
    } else if (queryStr.includes("prioritize") || queryStr.includes("roadmap") || queryStr.includes("next")) {
      // Prioritize based on theme count and response urgency
      const sortedThemes = project.themes.slice(0, 5);
      
      answer = `### Strategic Backlog Priority List (Based on Theme Frequency & Urgency):\n\n`;
      if (sortedThemes.length > 0) {
        sortedThemes.forEach((t, idx) => {
          const priority = t.count > 10 ? "HIGH" : t.count > 3 ? "MEDIUM" : "LOW";
          answer += `${idx + 1}. **Priority ${priority}: ${t.name} (Frequency: ${t.count})**\n   *Suggested Action:* Focus engineering/design resources here to optimize customer experience.\n\n`;
        });
      } else {
        answer += "No themes detected to prioritize yet. Run the analysis pipeline first.";
      }
    } else {
      // General overview
      answer = `### Project Feedback General Overview:\n\n` +
               `- **Total Processed Responses:** ${total}\n` +
               `- **Positive Sentiment:** ${positiveResponses.length} (${posPercent}%)\n` +
               `- **Negative Sentiment:** ${negativeResponses.length} (${negPercent}%)\n` +
               `- **Neutral Sentiment:** ${neutralResponses.length} (${total ? 100 - posPercent - negPercent : 0}%)\n\n` +
               `*Recommendation:* Target the highest frequency negative feedback categories to drive customer satisfaction.`;
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Query API error:", error);
    return NextResponse.json({ error: "Failed to generate query answer" }, { status: 500 });
  }
}
