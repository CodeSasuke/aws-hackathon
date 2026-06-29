import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<any> }) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        surveyFiles: true,
        reports: true,
        themes: { orderBy: { count: "desc" }, take: 5 }
      }
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const report = project.reports[0];
    if (!report) {
      return NextResponse.json({ error: "Report has not been generated yet. Please run analysis first." }, { status: 400 });
    }

    // Initialize PDF Document
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    // Capture PDF output in buffer chunks
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));
    });

    // --- PDF Styling & Content ---

    // 1. Cover / Header Banner
    doc.rect(0, 0, 595.28, 120).fill("#1F497D"); // Corporate Navy Blue
    
    doc.fillColor("#FFFFFF")
       .font("Helvetica-Bold")
       .fontSize(22)
       .text("SurveyIQ", 50, 35)
       .fontSize(12)
       .font("Helvetica")
       .text("ENTERPRISE SURVEY INTELLIGENCE", 50, 60);

    doc.fillColor("#FFFFFF")
       .font("Helvetica-Bold")
       .fontSize(14)
       .text("EXECUTIVE BOARD REPORT", 380, 50, { align: "right" });

    doc.moveDown(5);

    // 2. Meta Info Table
    doc.fillColor("#333333");
    doc.font("Helvetica-Bold").fontSize(16).text(project.name, 50, 150);
    
    doc.font("Helvetica").fontSize(10).fillColor("#666666");
    doc.text(`Generated: ${new Date(report.createdAt).toLocaleDateString()}`, 50, 175);
    const file = project.surveyFiles[0];
    if (file) {
      doc.text(`Total Responses Analyzed: ${file.totalRowCount}  |  Quality Score: ${file.qualityScore}%`, 50, 190);
    }

    doc.moveTo(50, 210).lineTo(545, 210).strokeColor("#D3D3D3").lineWidth(1).stroke();

    // 3. Section: Executive Summary
    doc.moveDown(2);
    doc.fillColor("#1F497D").font("Helvetica-Bold").fontSize(14).text("1. Executive Summary", 50, 230);
    
    doc.fillColor("#333333")
       .font("Helvetica")
       .fontSize(10)
       .text(report.executiveSummary, 50, 255, { align: "justify", lineGap: 4, width: 495 });

    // 4. Section: Key Findings
    doc.addPage();
    doc.rect(0, 0, 595.28, 40).fill("#366092"); // Sub-banner Slate Blue
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(12).text("KEY FINDINGS & OBSERVATIONS", 50, 15);

    let yOffset = 70;
    doc.fillColor("#333333");

    const findings = report.keyFindings as any[];
    findings.forEach((finding: any, index: number) => {
      // Box divider
      doc.rect(50, yOffset, 495, 80).fillAndStroke("#F2F5F8", "#D3D3D3"); // Light gray background box
      
      doc.fillColor("#1F497D")
         .font("Helvetica-Bold")
         .fontSize(11)
         .text(`Finding ${index + 1}: ${finding.title}`, 60, yOffset + 10);

      doc.fillColor("#333333")
         .font("Helvetica")
         .fontSize(9.5)
         .text(`Observation: ${finding.observation}`, 60, yOffset + 28, { width: 475 })
         .font("Helvetica-Bold")
         .text(`Impact: ${finding.impact}`, 60, yOffset + 55, { width: 475 });

      yOffset += 95;
    });

    // 5. Section: Top Themes
    doc.fillColor("#1F497D").font("Helvetica-Bold").fontSize(12).text("Primary Themes Identified in Feedback:", 50, yOffset + 10);
    yOffset += 30;

    project.themes.forEach((theme: any) => {
      doc.fillColor("#333333")
         .font("Helvetica-Bold")
         .fontSize(10)
         .text(`• ${theme.name}`, 65, yOffset)
         .font("Helvetica")
         .text(`(${theme.count} responses  —  Category: ${theme.category || "General"})`, 200, yOffset);
      yOffset += 18;
    });

    // 6. Section: Recommendations & Next Steps
    doc.addPage();
    doc.rect(0, 0, 595.28, 40).fill("#366092");
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(12).text("BUSINESS STRATEGY RECOMMENDATIONS", 50, 15);

    let recYOffset = 70;
    const recommendations = report.recommendations as any[];
    recommendations.forEach((rec: any, index: number) => {
      // Left border indicator (High priority = Red, Medium = Orange, Low = Gray)
      const colorMap: Record<string, string> = { HIGH: "#C00000", MEDIUM: "#E36C09", LOW: "#7F7F7F" };
      const priorityColor = colorMap[rec.priority?.toUpperCase()] || "#366092";

      doc.rect(50, recYOffset, 6, 70).fill(priorityColor); // Left colored accent bar
      doc.rect(56, recYOffset, 489, 70).fillAndStroke("#FAFAFA", "#EAEAEA"); // Gray box body

      doc.fillColor("#1F497D")
         .font("Helvetica-Bold")
         .fontSize(10.5)
         .text(`${index + 1}. ${rec.title}`, 70, recYOffset + 10)
         .fillColor(priorityColor)
         .fontSize(8.5)
         .text(`Priority: ${rec.priority || "MEDIUM"}`, 450, recYOffset + 12, { align: "right" });

      doc.fillColor("#333333")
         .font("Helvetica")
         .fontSize(9.5)
         .text(`Action: ${rec.action}`, 70, recYOffset + 30, { width: 450 });

      recYOffset += 85;
    });

    // Footer signature
    doc.moveDown(3);
    doc.font("Helvetica-Oblique")
       .fontSize(9)
       .fillColor("#888888")
       .text("This report was generated using the SurveyIQ Analytics engine.", 50, doc.page.height - 50, { align: "center" });

    // Finalize PDF
    doc.end();

    const pdfBuffer = await pdfPromise;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="surveyiq-board-report-${id}.pdf"`
      }
    });
  } catch (error) {
    console.error("GET PDF Export Error:", error);
    return NextResponse.json({ error: "Failed to generate PDF board report" }, { status: 500 });
  }
}
