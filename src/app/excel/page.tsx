"use client";

import React, { useState, useEffect } from "react";
import Script from "next/script";
import { Database, CheckCircle, UploadCloud, AlertCircle } from "lucide-react";

export default function ExcelAddInPage() {
  const [officeReady, setOfficeReady] = useState(false);
  const [status, setStatus] = useState("Initializing Office interface...");
  const [loading, setLoading] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>(["System loaded. Ready to analyze."]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkOffice = setInterval(() => {
        if ((window as any).Office) {
          clearInterval(checkOffice);
          (window as any).Office.onReady((info: any) => {
            if (info.host === (window as any).Office.HostType.Excel) {
              setOfficeReady(true);
              setStatus("Ready. Please select a column containing feedback text.");
              addLog("Office.js initialized. Connected to Microsoft Excel.");
            } else {
              setStatus("Running outside of Excel environment.");
            }
          });
        }
      }, 100);
      return () => clearInterval(checkOffice);
    }
  }, []);

  const addLog = (message: string) => {
    setLogMessages((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleAnalyzeSelection = async () => {
    if (!officeReady) {
      addLog("Office.js is not initialized yet.");
      return;
    }

    setLoading(true);
    setStatus("Reading selected cells...");
    addLog("Reading selected Excel range...");

    try {
      const { Office, Excel } = window as any;

      await Excel.run(async (context: any) => {
        const range = context.workbook.getSelectedRange();
        range.load(["values", "rowCount", "columnCount"]);
        await context.sync();

        const rowCount = range.rowCount;
        const columnCount = range.columnCount;

        if (columnCount > 1) {
          addLog("Warning: Multiple columns selected. Selecting the first column.");
        }

        // Extract values from the first column of the selection
        const texts: string[] = [];
        for (let i = 0; i < rowCount; i++) {
          const val = range.values[i][0];
          texts.push(val ? val.toString().trim() : "");
        }

        // Filter out empty rows or headers if needed
        addLog(`Found ${texts.length} rows. Dispatched to SurveyIQ Bedrock pipeline...`);
        setStatus("Running AI analysis...");

        // Call our Next.js API endpoint
        const response = await fetch("/api/excel-add-in/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts })
        });

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }

        const results = data.results;
        addLog("AI processing completed. Writing results back to spreadsheet...");
        setStatus("Writing results back...");

        // Prepare adjacent offset columns matrix to write:
        // Column +1: Sentiment
        // Column +2: Theme
        // Column +3: Category
        // Column +4: Suggested Action
        // Column +5: Urgency
        const writeMatrix: any[][] = [];
        for (let i = 0; i < rowCount; i++) {
          const res = results[i];
          if (res) {
            writeMatrix.push([
              res.sentiment,
              res.theme,
              res.category,
              res.suggestedAction,
              res.urgency
            ]);
          } else {
            writeMatrix.push(["N/A", "N/A", "N/A", "N/A", 0]);
          }
        }

        // Get adjacent range: 5 columns wide, starting 1 column to the right of selection
        const targetRange = range.getOffsetRange(0, 1).getResizedRange(0, 4);
        targetRange.values = writeMatrix;

        // Apply visual formats (Green for POSITIVE, Red for NEGATIVE, Gray for NEUTRAL)
        for (let i = 0; i < rowCount; i++) {
          const cell = targetRange.getCell(i, 0); // Sentiment cell
          const sentiment = writeMatrix[i][0];
          
          if (sentiment === "POSITIVE") {
            cell.format.fill.color = "#D1FAE5"; // Emerald-100
            cell.format.font.color = "#065F46"; // Emerald-800
          } else if (sentiment === "NEGATIVE") {
            cell.format.fill.color = "#FEE2E2"; // Red-100
            cell.format.font.color = "#991B1B"; // Red-800
          } else {
            cell.format.fill.color = "#F3F4F6"; // Gray-100
            cell.format.font.color = "#374151"; // Gray-800
          }
          cell.format.font.bold = true;
        }

        // Highlight header values if first row is a header (optional, we format anyway)
        await context.sync();
        addLog("Spreadsheet successfully enriched with AI fields.");
        setStatus("Complete! Sheet updated.");
      });
    } catch (error: any) {
      console.error("OfficeJS Execution Error:", error);
      addLog(`Error: ${error.message || "Failed to edit document"}`);
      setStatus("Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col justify-between border-t-4 border-blue-600 font-sans antialiased">
      <Script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js" strategy="beforeInteractive" />

      {/* Main Container */}
      <div className="p-5 space-y-6">
        
        {/* Brand Header */}
        <div className="flex items-center space-x-2 border-b border-gray-150 pb-4">
          <Database className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="font-bold text-base text-gray-900 tracking-tight">SurveyIQ</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Survey Intelligence Add-In</p>
          </div>
        </div>

        {/* Instructions Block */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Instructions</h2>
          <ol className="text-xs text-gray-600 space-y-2 list-decimal pl-4">
            <li>Select a single column of feedback comments in your spreadsheet.</li>
            <li>Ensure the selection contains raw text customer comments.</li>
            <li>Click the **Analyze Selection** button below.</li>
          </ol>
        </div>

        {/* Action Panel */}
        <div className="space-y-4 pt-2">
          <button
            onClick={handleAnalyzeSelection}
            disabled={loading || !officeReady}
            className="w-full flex items-center justify-center bg-[#107c41] hover:bg-[#0b5a30] text-white font-bold py-2.5 rounded text-xs transition-colors disabled:opacity-50 tracking-wide uppercase"
          >
            {loading ? "Analyzing..." : "Analyze Selection"}
          </button>

          {/* Status Indicator */}
          <div className="border border-gray-250 bg-gray-50 rounded p-3 text-xs flex items-start space-x-2">
            {loading ? (
              <span className="flex h-3.5 w-3.5 relative mt-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500"></span>
              </span>
            ) : officeReady ? (
              <CheckCircle className="h-4.5 w-4.5 text-[#107c41] flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4.5 w-4.5 text-amber-500 flex-shrink-0" />
            )}
            <p className="text-gray-700 leading-tight font-medium">{status}</p>
          </div>
        </div>

        {/* Activity Logs Console */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">System Logs</h2>
          <div className="h-48 overflow-y-auto bg-gray-50 border border-gray-200 rounded p-3 font-mono text-[10px] text-gray-600 space-y-1.5 scrollbar-thin">
            {logMessages.map((log, idx) => (
              <div key={idx} className="border-b border-gray-100 pb-1 last:border-0 truncate" title={log}>
                {log}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Footer Branding */}
      <footer className="p-4 border-t border-gray-150 bg-gray-50 text-[10px] text-gray-400 text-center font-medium">
        SurveyIQ Client v1.0.0 (AWS & Vercel)
      </footer>
    </div>
  );
}
