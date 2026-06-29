import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { surveyFiles: true, themes: true }
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const responses = await prisma.response.findMany({
      where: { projectId: id },
      orderBy: { rowIndex: "asc" }
    });

    if (responses.length === 0) {
      return NextResponse.json({ error: "No responses available to export" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SurveyIQ";
    workbook.created = new Date();

    // 1. Create Executive Dashboard Sheet
    const dashSheet = workbook.addWorksheet("Dashboard & Themes");
    
    // Add title
    dashSheet.mergeCells("A1:D1");
    const titleCell = dashSheet.getCell("A1");
    titleCell.value = `${project.name} — SurveyIQ Executive Dashboard`;
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1F497D" } }; // Navy Blue
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    dashSheet.getRow(1).height = 40;

    // Add stats
    const file = project.surveyFiles[0];
    dashSheet.addRow([]);
    dashSheet.addRow(["Key Metrics", "Value"]);
    dashSheet.addRow(["Total Responses", file?.totalRowCount || responses.length]);
    dashSheet.addRow(["Quality Score", `${file?.qualityScore || 100}%`]);
    dashSheet.addRow(["Spam Count", file?.spamCount || 0]);
    dashSheet.addRow(["Duplicate Count", file?.duplicateCount || 0]);
    
    // Style stats table
    dashSheet.getRow(3).font = { bold: true };
    dashSheet.getColumn("A").width = 24;
    dashSheet.getColumn("B").width = 15;

    // Add Themes section
    dashSheet.addRow([]);
    dashSheet.addRow(["Top Detected Themes", "Response Count", "Category"]);
    const headerRow = dashSheet.lastRow;
    if (headerRow) {
      headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
      headerRow.eachCell((cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "366092" } }; // Slate Blue
      });
    }

    for (const theme of project.themes) {
      dashSheet.addRow([theme.name, theme.count, theme.category || "N/A"]);
    }
    dashSheet.getColumn("C").width = 20;

    // 2. Create Enriched Dataset Sheet
    const dataSheet = workbook.addWorksheet("Enriched Dataset");
    
    // Get headers from first row
    const firstRowData = responses[0].rawData as Record<string, any>;
    const originalHeaders = Object.keys(firstRowData);

    const columns = [
      { header: "Row #", key: "rowIndex", width: 8 },
      ...originalHeaders.map((header) => ({ header, key: `raw_${header}`, width: 18 })),
      { header: "Sentiment", key: "sentiment", width: 12 },
      { header: "Theme", key: "theme", width: 22 },
      { header: "Category", key: "category", width: 18 },
      { header: "Intent", key: "intent", width: 12 },
      { header: "Urgency", key: "urgency", width: 10 },
      { header: "Product Area", key: "productArea", width: 18 },
      { header: "Suggested Action", key: "suggestedAction", width: 35 },
      { header: "Confidence", key: "confidenceScore", width: 12 },
      { header: "Spam Flag", key: "isSpam", width: 10 },
      { header: "Duplicate Flag", key: "isDuplicate", width: 10 }
    ];

    dataSheet.columns = columns;

    // Style data headers
    const dataHeaderRow = dataSheet.getRow(1);
    dataHeaderRow.font = { bold: true, color: { argb: "FFFFFF" } };
    dataHeaderRow.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1F497D" } };
    });
    dataSheet.getRow(1).height = 28;

    // Add responses rows
    for (const r of responses) {
      const rowValue: Record<string, any> = {
        rowIndex: r.rowIndex,
        sentiment: r.sentiment || "PENDING",
        theme: r.themeId ? (project.themes.find((t: any) => t.id === r.themeId)?.name || "N/A") : "N/A",
        category: r.category || "N/A",
        intent: r.intent || "N/A",
        urgency: r.urgency || 0,
        productArea: r.productArea || "N/A",
        suggestedAction: r.suggestedAction || "N/A",
        confidenceScore: r.confidenceScore ? r.confidenceScore.toFixed(2) : "N/A",
        isSpam: r.isSpam ? "YES" : "NO",
        isDuplicate: r.isDuplicate ? "YES" : "NO"
      };

      // Add raw data fields
      const rawData = r.rawData as Record<string, any>;
      for (const key of originalHeaders) {
        rowValue[`raw_${key}`] = rawData[key] || "";
      }

      dataSheet.addRow(rowValue);
    }

    // Auto-align cells
    dataSheet.eachRow((row: any) => {
      row.alignment = { vertical: "middle" };
    });

    // Write to buffer
    const fileBuffer = await workbook.xlsx.writeBuffer();

    return new Response(new Uint8Array(fileBuffer as any), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="surveyiq-report-${id}.xlsx"`
      }
    });
  } catch (error) {
    console.error("GET Excel Export Error:", error);
    return NextResponse.json({ error: "Failed to generate Excel report" }, { status: 500 });
  }
}
