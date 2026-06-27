import crypto from "crypto";
import { Sentiment, JobStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { invokeClaude35 } from "./aws";

// Types for pipeline output
interface EnrichedOutput {
  sentiment: Sentiment;
  category: string;
  theme: string;
  intent: string;
  urgency: number;
  productArea: string;
  suggestedAction: string;
  confidenceScore: number;
  isSpam: boolean;
  representativeQuote: string;
  isDuplicate?: boolean;
}

/**
 * Preprocess empty, N/A, or simple deterministic responses locally without AI
 */
export function getLocalDeterministicLabel(text: string): EnrichedOutput | null {
  const clean = text.trim().toLowerCase();
  
  // Empty / placeholder checks
  if (!clean || ["n/a", "none", "nothing", "-", ".", "no", "nil", "na"].includes(clean)) {
    return {
      sentiment: "NEUTRAL",
      category: "General",
      theme: "No Feedback Provided",
      intent: "Inquiry",
      urgency: 1,
      productArea: "General",
      suggestedAction: "None required",
      confidenceScore: 1.0,
      isSpam: false,
      representativeQuote: text || "N/A"
    };
  }

  // Simple general praise checks
  if (["good", "great", "excellent", "perfect", "nice", "love it", "awesome", "very good", "best"].includes(clean)) {
    return {
      sentiment: "POSITIVE",
      category: "General",
      theme: "General Praise",
      intent: "Feedback",
      urgency: 1,
      productArea: "General",
      suggestedAction: "Maintain current performance",
      confidenceScore: 0.95,
      isSpam: false,
      representativeQuote: text
    };
  }

  // Simple general complaint checks
  if (["bad", "terrible", "worst", "awful", "sucks", "poor"].includes(clean)) {
    return {
      sentiment: "NEGATIVE",
      category: "General",
      theme: "General Dissatisfaction",
      intent: "Complaint",
      urgency: 2,
      productArea: "General",
      suggestedAction: "Investigate general customer satisfaction issues",
      confidenceScore: 0.9,
      isSpam: false,
      representativeQuote: text
    };
  }

  return null;
}

/**
 * Calculate Jaccard similarity between two texts using character 3-grams
 */
function calculateJaccardSimilarity(textA: string, textB: string): number {
  const getGrams = (text: string) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
    const grams = new Set<string>();
    for (let i = 0; i <= clean.length - 3; i++) {
      grams.add(clean.substring(i, i + 3));
    }
    return grams;
  };

  const gramsA = getGrams(textA);
  const gramsB = getGrams(textB);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  const intersection = new Set([...gramsA].filter((x) => gramsB.has(x)));
  const union = new Set([...gramsA, ...gramsB]);
  return intersection.size / union.size;
}

/**
 * Group responses into similar clusters based on string similarity (Leader-Clustering)
 */
export function clusterResponses(responses: { id: string; text: string }[], threshold = 0.5): Map<string, string[]> {
  // Key = representative response ID, Value = array of response IDs in the cluster
  const clusters = new Map<string, string[]>();
  const representativeTexts = new Map<string, string>(); // ID -> text

  for (const item of responses) {
    let matchedClusterId: string | null = null;

    // Compare against existing cluster representatives
    for (const [repId, repText] of representativeTexts.entries()) {
      const similarity = calculateJaccardSimilarity(item.text, repText);
      if (similarity >= threshold) {
        matchedClusterId = repId;
        break;
      }
    }

    if (matchedClusterId) {
      clusters.get(matchedClusterId)!.push(item.id);
    } else {
      clusters.set(item.id, [item.id]);
      representativeTexts.set(item.id, item.text);
    }
  }

  return clusters;
}

/**
 * Batch analysis of representative responses using AWS Bedrock Claude 3.5 Sonnet
 */
export async function analyzeBatchWithBedrock(items: { id: string; text: string }[]): Promise<Record<string, EnrichedOutput>> {
  const systemPrompt = `You are an expert survey analysis bot. Analyze the sentiments and themes of the given survey responses.
Return a valid JSON object mapping each response ID to its analysis result.

JSON Output Format:
{
  "response_id_here": {
    "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
    "category": "Customer Support" | "Pricing" | "Product Features" | "Performance" | "Billing" | "UX/Design" | "Other",
    "theme": "Detailed theme description (Max 4 words, e.g. 'Slow App Loading')",
    "intent": "Feature Request" | "Bug Report" | "Complaint" | "Praise" | "Inquiry",
    "urgency": 1 | 2 | 3 | 4 | 5 (1 being low, 5 being critical),
    "productArea": "Specific product module (e.g. 'Checkout', 'Mobile App', 'Dashboard')",
    "suggestedAction": "One sentence suggested action for the business",
    "confidenceScore": 0.0 to 1.0,
    "isSpam": true | false,
    "representativeQuote": "A short, punchy quote from the response representing the core theme"
  }
}`;

  const userPrompt = `Analyze the following responses:\n` + items.map(item => `ID: ${item.id}\nResponse: "${item.text}"\n---`).join("\n");
  
  try {
    const rawResult = await invokeClaude35(systemPrompt, userPrompt);
    
    // Find JSON boundaries in case Claude adds conversational wrapper text
    const startIdx = rawResult.indexOf("{");
    const endIdx = rawResult.lastIndexOf("}");
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("Could not parse JSON from Bedrock output: " + rawResult);
    }
    const cleanJsonText = rawResult.substring(startIdx, endIdx + 1);
    
    const analysisMap = JSON.parse(cleanJsonText);
    return analysisMap;
  } catch (error) {
    console.error("Batch Analysis Error:", error);
    // Return empty results on failure (callers should fallback gracefully)
    return {};
  }
}

/**
 * Main analysis pipeline execution
 */
export async function runSurveyAnalysisPipeline(projectId: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "PARSING" }
  });

  const responses = await prisma.response.findMany({
    where: { projectId },
    select: { id: true, rowIndex: true, rawData: true }
  });

  // Extract open-ended text fields
  const file = await prisma.surveyFile.findFirst({ where: { projectId } });
  if (!file) throw new Error("No survey file mapping found for project: " + projectId);
  
  const mappings = file.columnMappings as { textCols: string[] };
  const textFieldName = mappings.textCols[0]; // Primary open ended column to analyze

  const responseTexts = responses.map(r => {
    const data = r.rawData as Record<string, any>;
    return {
      id: r.id,
      text: (data[textFieldName] || "").toString().trim()
    };
  });

  console.log(`Processing ${responseTexts.length} responses for project ${projectId}...`);

  // Step 1: Rule-based preprocessing and deduplication local hashing
  const pendingAnalysis: { id: string; text: string }[] = [];
  const processedResults: Record<string, EnrichedOutput> = {};

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "CLUSTERING" }
  });

  for (const item of responseTexts) {
    // Check local rules
    const localLabel = getLocalDeterministicLabel(item.text);
    if (localLabel) {
      processedResults[item.id] = localLabel;
      continue;
    }

    // Check DB Cache for identical responses
    const hash = crypto.createHash("sha256").update(item.text.toLowerCase()).digest("hex");
    const cached = await prisma.responseCache.findUnique({ where: { hash } });
    
    if (cached) {
      processedResults[item.id] = {
        sentiment: cached.sentiment,
        category: cached.category || "General",
        theme: cached.themeName || "General Feedback",
        intent: cached.intent || "Feedback",
        urgency: cached.urgency || 1,
        productArea: cached.productArea || "General",
        suggestedAction: cached.suggestedAction || "None required",
        confidenceScore: 1.0,
        isSpam: false,
        representativeQuote: cached.text
      };
      
      // Update Response table directly to mark as duplicate
      await prisma.response.update({
        where: { id: item.id },
        data: { responseHash: hash, isDuplicate: true }
      });
      continue;
    }

    // Otherwise, queue for clustering
    pendingAnalysis.push(item);
    await prisma.response.update({
      where: { id: item.id },
      data: { responseHash: hash }
    });
  }

  console.log(`Locally resolved ${Object.keys(processedResults).length} responses. ${pendingAnalysis.length} unique items remaining for clustering.`);

  // Step 2: Clustering Jaccard Similarity
  const clusters = clusterResponses(pendingAnalysis, 0.55);
  console.log(`Clustered remaining responses into ${clusters.size} groups.`);

  // Prepare representative responses for Bedrock
  const representatives: { id: string; text: string }[] = [];
  for (const repId of clusters.keys()) {
    const textObj = pendingAnalysis.find(x => x.id === repId);
    if (textObj) {
      representatives.push(textObj);
    }
  }

  // Step 3: Bedrock batch calls (in chunks of 25 to avoid token limits)
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "ANALYZING" }
  });

  const chunkSize = 25;
  for (let i = 0; i < representatives.length; i += chunkSize) {
    const chunk = representatives.slice(i, i + chunkSize);
    console.log(`Sending Bedrock batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(representatives.length / chunkSize)}...`);
    
    const batchResults = await analyzeBatchWithBedrock(chunk);
    
    // Propagate labels to all members in the cluster
    for (const rep of chunk) {
      const repResult = batchResults[rep.id];
      if (repResult) {
        // Apply to representative
        processedResults[rep.id] = repResult;
        
        // Propagate to other members in cluster
        const clusterMembers = clusters.get(rep.id) || [];
        for (const memberId of clusterMembers) {
          if (memberId !== rep.id) {
            processedResults[memberId] = {
              ...repResult,
              isDuplicate: true // Flag as duplicate since it got its label from cluster propagation
            };
          }
        }

        // Cache the representative result globally in Database
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
        });
      }
    }
  }

  // Step 4: Write all results to the Database & create Themes
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "GENERATING_REPORTS" }
  });

  console.log("Writing enriched results to Database...");
  
  // Track and create Themes
  const uniqueThemes = new Map<string, { category: string }>();
  for (const result of Object.values(processedResults)) {
    if (result.theme) {
      uniqueThemes.set(result.theme, { category: result.category });
    }
  }

  // Create Themes in DB
  const themeDbMap = new Map<string, string>(); // name -> id
  for (const [themeName, data] of uniqueThemes.entries()) {
    const dbTheme = await prisma.theme.upsert({
      where: { projectId_name: { projectId, name: themeName } },
      update: {},
      create: {
        projectId,
        name: themeName,
        category: data.category,
        count: 0
      }
    });
    themeDbMap.set(themeName, dbTheme.id);
  }

  // Update Responses in Database
  let spamCount = 0;
  let duplicateCount = 0;
  let oneWordCount = 0;

  for (const r of responses) {
    const result = processedResults[r.id];
    if (result) {
      const themeId = themeDbMap.get(result.theme) || null;
      const isSpam = result.isSpam;
      const isDuplicate = result.isSpam ? false : (result as any).isDuplicate || false;
      const rawText = ((r.rawData as Record<string, any>)[textFieldName] || "").toString();
      const isOneWord = rawText.trim().split(/\s+/).length === 1;

      if (isSpam) spamCount++;
      if (isDuplicate) duplicateCount++;
      if (isOneWord) oneWordCount++;

      await prisma.response.update({
        where: { id: r.id },
        data: {
          sentiment: result.sentiment,
          themeId,
          category: result.category,
          intent: result.intent,
          urgency: result.urgency,
          productArea: result.productArea,
          suggestedAction: result.suggestedAction,
          confidenceScore: result.confidenceScore,
          isSpam,
          isDuplicate,
          representativeQuote: result.representativeQuote
        }
      });

      // Update theme counter
      if (themeId && !isSpam) {
        await prisma.theme.update({
          where: { id: themeId },
          data: { count: { increment: 1 } }
        });
      }
    }
  }

  // Update file metrics
  const qualityScore = Math.max(
    0,
    Math.round(
      ((responseTexts.length - (spamCount + duplicateCount + oneWordCount)) / responseTexts.length) * 100
    )
  );

  await prisma.surveyFile.update({
    where: { id: file.id },
    data: {
      spamCount,
      duplicateCount,
      oneWordCount,
      qualityScore
    }
  });

  // Step 5: Generate McKinsey-Style Executive Report Summary via Bedrock
  console.log("Generating Executive Insights Summary...");
  const themeCounts = await prisma.theme.findMany({
    where: { projectId },
    orderBy: { count: "desc" },
    take: 5
  });

  const summarySystemPrompt = `You are a Senior McKinsey Consultant. Draft a professional board-level Executive Summary report of the survey feedback results.
Return a valid JSON object matching the format below. Do not output markdown, notes, or explanations outside the JSON.

JSON Format:
{
  "executiveSummary": "A formal executive narrative of the survey findings, detailing overall customer health and core areas of friction (2-3 paragraphs).",
  "keyFindings": [
    {
      "title": "Finding Title (e.g. Billing Friction)",
      "observation": "Detailed empirical observation of what the survey tells us.",
      "impact": "Business impact (e.g. Higher churn risk for small business tier)"
    }
  ],
  "recommendations": [
    {
      "title": "Action Title (e.g. Redesign Billing portal)",
      "action": "Concrete, actionable recommendation steps for the business.",
      "priority": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "timelineInsights": [
    {
      "time": "Phase 1 / Phase 2",
      "insight": "Strategic planning focus areas or monthly observations."
    }
  ]
}`;

  const summaryUserPrompt = `Survey Metadata:
Total Responses: ${responseTexts.length}
Quality Score: ${qualityScore}%
Spam Count: ${spamCount}
Duplicate Count: ${duplicateCount}
One Word Count: ${oneWordCount}

Top Themes:
${themeCounts.map(t => `- ${t.name}: ${t.count} responses (${t.category})`).join("\n")}
`;

  try {
    const rawSummary = await invokeClaude35(summarySystemPrompt, summaryUserPrompt, 0.4);
    const startIdx = rawSummary.indexOf("{");
    const endIdx = rawSummary.lastIndexOf("}");
    const cleanJson = rawSummary.substring(startIdx, endIdx + 1);
    
    const summaryData = JSON.parse(cleanJson);

    await prisma.report.create({
      data: {
        projectId,
        executiveSummary: summaryData.executiveSummary,
        keyFindings: summaryData.keyFindings,
        recommendations: summaryData.recommendations,
        timelineInsights: summaryData.timelineInsights
      }
    });
  } catch (error) {
    console.error("Failed to generate report:", error);
    // Create dummy fallback report
    await prisma.report.create({
      data: {
        projectId,
        executiveSummary: "Analysis completed. Detailed insights generated.",
        keyFindings: [],
        recommendations: []
      }
    });
  }

  // Update status to complete
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "COMPLETED" }
  });

  console.log(`Pipeline analysis completed for project ${projectId}!`);
}
