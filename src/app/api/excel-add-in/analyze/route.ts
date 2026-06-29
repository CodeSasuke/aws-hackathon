import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getLocalDeterministicLabel, clusterResponses, analyzeBatchLocal } from "@/lib/pipeline";
type Sentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

interface EnrichedResult {
  text: string;
  sentiment: Sentiment;
  category: string;
  theme: string;
  intent: string;
  urgency: number;
  productArea: string;
  suggestedAction: string;
  confidenceScore: number;
  isSpam: boolean;
}

export async function POST(req: Request) {
  try {
    const { texts } = await req.json();

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: "Missing or invalid texts array" }, { status: 400 });
    }

    console.log(`Excel Add-in analyzing ${texts.length} selected cells...`);

    const results: Record<number, EnrichedResult> = {};
    const pendingAnalysis: { index: number; text: string }[] = [];

    // Step 1: Preprocessing & Cache Check
    for (let i = 0; i < texts.length; i++) {
      const text = (texts[i] || "").toString().trim();
      
      // Checking local rule filters
      const localResult = getLocalDeterministicLabel(text);
      if (localResult) {
        results[i] = { text, ...localResult };
        continue;
      }

      // Check Database cache for identical inputs
      const hash = crypto.createHash("sha256").update(text.toLowerCase()).digest("hex");
      const cached = await prisma.responseCache.findUnique({ where: { hash } });

      if (cached) {
        results[i] = {
          text,
          sentiment: cached.sentiment,
          category: cached.category || "General",
          theme: cached.themeName || "General Feedback",
          intent: cached.intent || "Feedback",
          urgency: cached.urgency || 1,
          productArea: cached.productArea || "General",
          suggestedAction: cached.suggestedAction || "None required",
          confidenceScore: 1.0,
          isSpam: false
        };
        continue;
      }

      // Otherwise queue for local clustering
      pendingAnalysis.push({ index: i, text });
    }

    console.log(`Local Cache hit: ${texts.length - pendingAnalysis.length} rows. Unique items for processing: ${pendingAnalysis.length}`);

    // Step 2: Local Clustering
    if (pendingAnalysis.length > 0) {
      // Map format for clusterResponses: { id: string, text: string }
      const clusterInput = pendingAnalysis.map(x => ({ id: x.index.toString(), text: x.text }));
      const clusters = clusterResponses(clusterInput, 0.55);

      // Select representatives
      const representatives: { id: string; text: string }[] = [];
      for (const repId of clusters.keys()) {
        const item = clusterInput.find(x => x.id === repId);
        if (item) representatives.push(item);
      }

      // Batch call local analytical matching engine
      const chunkSize = 25;
      for (let k = 0; k < representatives.length; k += chunkSize) {
        const chunk = representatives.slice(k, k + chunkSize);
        const batchResults = await analyzeBatchLocal(chunk);

        // Propagate labels
        for (const rep of chunk) {
          const repResult = batchResults[rep.id];
          if (repResult) {
            const repIndex = parseInt(rep.id);
            const enriched = {
              text: rep.text,
              sentiment: repResult.sentiment,
              category: repResult.category,
              theme: repResult.theme,
              intent: repResult.intent,
              urgency: repResult.urgency,
              productArea: repResult.productArea,
              suggestedAction: repResult.suggestedAction,
              confidenceScore: repResult.confidenceScore,
              isSpam: repResult.isSpam
            };

            // Assign to representative
            results[repIndex] = enriched;

            // Propagate to other cluster members
            const members = clusters.get(rep.id) || [];
            for (const memberId of members) {
              if (memberId !== rep.id) {
                const memberIndex = parseInt(memberId);
                const memberText = clusterInput.find(x => x.id === memberId)?.text || "";
                results[memberIndex] = {
                  ...enriched,
                  text: memberText
                };
              }
            }

            // Cache the representative in database
            const hash = crypto.createHash("sha256").update(rep.text.toLowerCase()).digest("hex");
            await prisma.responseCache.upsert({
              where: { hash },
              update: {},
              create: {
                hash,
                text: rep.text,
                sentiment: repResult.sentiment,
                category: repResult.category,
                themeName: repResult.theme,
                intent: repResult.intent,
                urgency: repResult.urgency,
                productArea: repResult.productArea,
                suggestedAction: repResult.suggestedAction
              }
            }).catch((e: unknown) => console.error("Cache write failure:", e));
          }
        }
      }
    }

    // Assemble final output in original index order
    const sortedOutput: EnrichedResult[] = [];
    for (let i = 0; i < texts.length; i++) {
      sortedOutput.push(
        results[i] || {
          text: texts[i] || "",
          sentiment: "NEUTRAL",
          category: "General",
          theme: "Analysis Failed",
          intent: "Feedback",
          urgency: 1,
          productArea: "General",
          suggestedAction: "Re-run analysis",
          confidenceScore: 0.0,
          isSpam: false
        }
      );
    }

    return NextResponse.json({ results: sortedOutput }, { status: 200 });
  } catch (error) {
    console.error("Excel Add-in Analyze Endpoint Error:", error);
    return NextResponse.json({ error: "Failed to process survey data" }, { status: 500 });
  }
}
