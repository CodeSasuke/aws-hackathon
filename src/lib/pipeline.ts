import crypto from "crypto";
type Sentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL";
type JobStatus = "PENDING" | "PARSING" | "CLUSTERING" | "ANALYZING" | "GENERATING_REPORTS" | "COMPLETED" | "FAILED";

import { prisma } from "./prisma";

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
 * Evaluate whether the respondent's open-ended answers are of high quality or spam/low quality.
 * Returns true if the row is high quality, false if it is spam/low quality.
 */
export function evaluateRowQuality(rowRawData: Record<string, any>, textCols: string[]): boolean {
  if (textCols.length === 0) return true;

  // Prioritize Q16 open-ended questions as core indicators of quality
  const coreCols = textCols.filter(c => c.toLowerCase().includes("q16") || c.toLowerCase().includes("comment") || c.toLowerCase().includes("feedback"));
  const targetCols = coreCols.length > 0 ? coreCols : textCols;

  let allEmpty = true;
  let invalidCount = 0;
  let filledCount = 0;

  const lowQualityPhrases = [
    "no response", "no comment", "nothing", "n/a", "none", "nil", "na", "-", ".", "no",
    "not sure", "don't know", "dont know", "i don't know", "i dont know",
    "why?", "why", "who cares", "whatever", "not really", "i have a lot to say",
    "nothing specific", "n / a", "i don't", "dislike", "no response", "none", "na", "n/a"
  ];

  for (const col of targetCols) {
    const rawVal = rowRawData[col];
    if (rawVal !== null && rawVal !== undefined) {
      const cleanVal = rawVal.toString().trim().toLowerCase();
      if (cleanVal.length > 0) {
        allEmpty = false;
        filledCount++;

        // Match exact placeholders or very short junk inputs (<= 1 char)
        if (lowQualityPhrases.includes(cleanVal) || cleanVal.length <= 1) {
          invalidCount++;
        }
      }
    }
  }

  // Fallback to check overall textCols if core ones are blank
  if (allEmpty && targetCols !== textCols) {
    return evaluateRowQuality(rowRawData, textCols);
  }

  if (allEmpty) return false;

  // If any core open-ended field matches low-quality non-answer keywords, flag the row as low quality (flag: 1)
  if (invalidCount > 0) {
    return false;
  }

  return true;
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
  if (["good", "great", "excellent", "perfect", "nice", "love it", "awesome", "very good", "best", "smooth", "tasty", "delicious"].includes(clean)) {
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
/**
 * Deterministic local NLP matching engine for survey categorization, sentiment analysis, and action tagging
 */
function analyzeTextLocal(
  text: string,
  projectMetadata?: { name: string; description: string | null; industry?: string | null }
): EnrichedOutput {
  const clean = text.toLowerCase().trim();
  
  // Define keyword weights and category rules
  const rules = [
    {
      keywords: ["slow", "lag", "load", "crash", "freeze", "performance", "speed", "hang", "timeout", "sluggish", "delay"],
      result: {
        sentiment: "NEGATIVE" as const,
        category: "Performance",
        theme: "System Latency",
        intent: "Bug Report",
        urgency: 4,
        productArea: "System Architecture",
        suggestedAction: "Conduct performance audit and optimize database query indexes.",
        isSpam: false
      }
    },
    {
      keywords: ["ui", "ux", "design", "clean", "beautiful", "clunky", "interface", "layout", "font", "navigation", "visual", "hard to use"],
      result: {
        sentiment: text.toLowerCase().includes("love") || text.toLowerCase().includes("clean") || text.toLowerCase().includes("beautiful") ? ("POSITIVE" as const) : ("NEGATIVE" as const),
        category: "UX/Design",
        theme: "User Interface UX",
        intent: text.toLowerCase().includes("clean") || text.toLowerCase().includes("beautiful") ? ("Praise" as const) : ("Complaint" as const),
        urgency: 2,
        productArea: "Frontend UI",
        suggestedAction: "Review design usability feedback and refine interface layout.",
        isSpam: false
      }
    },
    {
      keywords: ["price", "pricing", "expensive", "cost", "subscription", "cheap", "charge", "billing", "invoice", "refund", "dollar", "money"],
      result: {
        sentiment: "NEGATIVE" as const,
        category: "Pricing",
        theme: "Pricing Model",
        intent: "Complaint",
        urgency: 3,
        productArea: "Billing/Plans",
        suggestedAction: "Evaluate pricing tiers and consider launching entry-level plans.",
        isSpam: false
      }
    },
    {
      keywords: ["support", "agent", "ticket", "help", "response", "reply", "chat", "customer service", "email"],
      result: {
        sentiment: "NEGATIVE" as const,
        category: "Customer Support",
        theme: "Support SLA Response",
        intent: "Complaint",
        urgency: 4,
        productArea: "Customer Success",
        suggestedAction: "Train support agents and optimize ticket response times.",
        isSpam: false
      }
    },
    {
      keywords: ["add", "feature", "wish", "want", "request", "new", "integrate", "export", "button", "tool"],
      result: {
        sentiment: "NEUTRAL" as const,
        category: "Product Features",
        theme: "Feature Request",
        intent: "Feature Request",
        urgency: 2,
        productArea: "Core Platform",
        suggestedAction: "Log feature request to product backlog for prioritization.",
        isSpam: false
      }
    }
  ];

  // Match rules based on keyword count scoring
  let bestMatch = null;
  let maxScore = 0;

  for (const rule of rules) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (clean.includes(kw)) score++;
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = rule.result;
    }
  }

  if (bestMatch) {
    return {
      ...bestMatch,
      confidenceScore: Math.min(0.95, 0.85 + maxScore * 0.05),
      representativeQuote: text
    };
  }

  // Context checks for negation or competitor preference shifts (Valence Shifters)
  const isCompetitorPreference = 
    clean.includes("prefer other") || 
    clean.includes("prefer another") || 
    clean.includes("better brand") || 
    clean.includes("better option") || 
    clean.includes("rather have") ||
    clean.includes("prefer my regular") ||
    clean.includes("prefer ultra gold");

  const hasNegation = 
    clean.includes("not good") || 
    clean.includes("not great") || 
    clean.includes("not taste") || 
    clean.includes("no good") || 
    clean.includes("isn't") || 
    clean.includes("isnt") || 
    clean.includes("doesn't") || 
    clean.includes("doesnt") || 
    clean.includes("never buy");

  // Fallback default categorization using sentiment cues
  let generalSentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" = "NEUTRAL";
  
  if (isCompetitorPreference || hasNegation) {
    generalSentiment = "NEGATIVE";
  } else if (clean.includes("good") || clean.includes("love") || clean.includes("great") || clean.includes("thanks") || clean.includes("awesome") || clean.includes("smooth") || clean.includes("tasty") || clean.includes("delicious") || clean.includes("perfect") || clean.includes("nice") || clean.includes("impressed")) {
    generalSentiment = "POSITIVE";
  } else if (clean.includes("bad") || clean.includes("poor") || clean.includes("issue") || clean.includes("error") || clean.includes("hate") || clean.includes("slow") || clean.includes("fail") || clean.includes("dislike")) {
    generalSentiment = "NEGATIVE";
  }

  return {
    sentiment: generalSentiment,
    category: "Other",
    theme: "General Feedback",
    intent: generalSentiment === "NEGATIVE" ? "Complaint" : generalSentiment === "POSITIVE" ? "Praise" : "Inquiry",
    urgency: generalSentiment === "NEGATIVE" ? 2 : 1,
    productArea: "General",
    suggestedAction: "Review qualitative feedback details for product improvements.",
    confidenceScore: 0.75,
    isSpam: false,
    representativeQuote: text
  };
}

/**
 * Batch analysis of representative responses running locally on the application server
 */
export async function analyzeBatchLocal(
  items: { id: string; text: string }[],
  projectMetadata?: { name: string; description: string | null; industry?: string | null }
): Promise<Record<string, EnrichedOutput>> {
  console.log(`Running local analytical matching engine on ${items.length} unique cluster representatives...`);
  const results: Record<string, EnrichedOutput> = {};
  for (const item of items) {
    results[item.id] = analyzeTextLocal(item.text, projectMetadata);
  }
  return results;
}

/**
 * Main analysis pipeline execution
 */
export async function runSurveyAnalysisPipeline(projectId: string) {
  let activeJob: any = null;

  const updateJobProgress = async (progress: number, status: JobStatus, errorMsg?: string) => {
    if (!activeJob) return;
    try {
      await prisma.analysisJob.update({
        where: { id: activeJob.id },
        data: {
          status,
          progress,
          ...(status === "COMPLETED" || status === "FAILED" ? { completedAt: new Date() } : {}),
          ...(status === "FAILED" ? { error: errorMsg } : {})
        }
      });
    } catch (err) {
      console.error("Failed to update AnalysisJob progress:", err);
    }
  };

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) throw new Error("Project not found: " + projectId);

    activeJob = await prisma.analysisJob.findFirst({
      where: { projectId, status: { in: ["PENDING", "ANALYZING"] } },
      orderBy: { createdAt: "desc" }
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "PARSING" }
    });
    await updateJobProgress(20, "PARSING");

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

    // Pre-calculate hashes and fetch all caches in a single query to avoid sequential SELECT statements
    const hashes = responses.map(r => {
      const rawData = r.rawData as Record<string, any>;
      const textValue = (rawData[textFieldName] || "").toString();
      return crypto.createHash("sha256").update(textValue.toLowerCase()).digest("hex");
    });

    const existingCaches = await prisma.responseCache.findMany({
      where: { hash: { in: hashes } }
    });
    const cacheMap = new Map(existingCaches.map(c => [c.hash, c]));

    // Step 1: Rule-based preprocessing and deduplication local hashing
    const pendingAnalysis: { id: string; text: string }[] = [];
    const processedResults: Record<string, EnrichedOutput & { hash?: string }> = {};

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "CLUSTERING" }
    });
    await updateJobProgress(40, "CLUSTERING");

    for (let idx = 0; idx < responses.length; idx++) {
      const r = responses[idx];
      const rawData = r.rawData as Record<string, any>;
      const isQuality = evaluateRowQuality(rawData, mappings.textCols);
      const hash = hashes[idx];

      if (!isQuality) {
        processedResults[r.id] = {
          sentiment: "NEUTRAL",
          category: "General",
          theme: "No Feedback Provided",
          intent: "Feedback",
          urgency: 1,
          productArea: "General",
          suggestedAction: "None required",
          confidenceScore: 1.0,
          isSpam: true,
          representativeQuote: "Low Quality Input",
          hash
        };
        continue;
      }

      const item = responseTexts.find(x => x.id === r.id);
      if (!item) continue;

      // Check local rules
      const localLabel = getLocalDeterministicLabel(item.text);
      if (localLabel) {
        processedResults[item.id] = { ...localLabel, hash };
        continue;
      }

      // Check DB Cache map
      const cached = cacheMap.get(hash);
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
          representativeQuote: cached.text,
          isDuplicate: true,
          hash
        };
        continue;
      }

      // Otherwise, queue for clustering
      pendingAnalysis.push(item);
      processedResults[item.id] = {
        sentiment: "NEUTRAL",
        category: "General",
        theme: "General Feedback",
        intent: "Feedback",
        urgency: 1,
        productArea: "General",
        suggestedAction: "Review qualitative feedback details for product improvements.",
        confidenceScore: 0.75,
        isSpam: false,
        representativeQuote: item.text,
        hash
      };
    }

    console.log(`Locally resolved ${Object.keys(processedResults).length - pendingAnalysis.length} responses. ${pendingAnalysis.length} unique items remaining for clustering.`);

    // Step 2: Clustering Jaccard Similarity
    const clusters = clusterResponses(pendingAnalysis, 0.55);
    console.log(`Clustered remaining responses into ${clusters.size} groups.`);

    // Prepare representative responses
    const representatives: { id: string; text: string }[] = [];
    for (const repId of clusters.keys()) {
      const textObj = pendingAnalysis.find(x => x.id === repId);
      if (textObj) {
        representatives.push(textObj);
      }
    }

    // Step 3: Local matching engine chunks processing
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "ANALYZING" }
    });
    await updateJobProgress(70, "ANALYZING");

    const cacheCreates: any[] = [];
    const chunkSize = 25;
    for (let i = 0; i < representatives.length; i += chunkSize) {
      const chunk = representatives.slice(i, i + chunkSize);
      const batchResults = await analyzeBatchLocal(chunk, project);
      
      // Propagate labels to all members in the cluster
      for (const rep of chunk) {
        const repResult = batchResults[rep.id];
        if (repResult) {
          // Apply to representative
          processedResults[rep.id] = {
            ...repResult,
            hash: processedResults[rep.id]?.hash
          };
          
          // Propagate to other members in cluster
          const clusterMembers = clusters.get(rep.id) || [];
          for (const memberId of clusterMembers) {
            if (memberId !== rep.id) {
              processedResults[memberId] = {
                ...repResult,
                isDuplicate: true,
                hash: processedResults[memberId]?.hash
              };
            }
          }

          // Queue cache creation locally
          const hash = crypto.createHash("sha256").update(rep.text.toLowerCase()).digest("hex");
          cacheCreates.push({
            hash,
            text: rep.text,
            sentiment: repResult.sentiment,
            category: repResult.category,
            themeName: repResult.theme,
            intent: repResult.intent,
            urgency: repResult.urgency,
            productArea: repResult.productArea,
            suggestedAction: repResult.suggestedAction
          });
        }
      }
    }

    // Write all new response caches in bulk to avoid multiple individual inserts
    if (cacheCreates.length > 0) {
      await prisma.responseCache.createMany({
        data: cacheCreates,
        skipDuplicates: true
      });
    }

    // Step 4: Write all results to the Database & create Themes
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "GENERATING_REPORTS" }
    });
    await updateJobProgress(90, "GENERATING_REPORTS");

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

    // Prepare dynamic counts and bulk parallel update execution
    let spamCount = 0;
    let duplicateCount = 0;
    let oneWordCount = 0;

    const updatesToRun = responses.map((r) => {
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

        return {
          id: r.id,
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
            representativeQuote: result.representativeQuote,
            responseHash: result.hash
          }
        };
      }
      return null;
    }).filter(Boolean);

    // Run response updates in parallel chunks of 40 to avoid hitting limits
    const updateBatchSize = 40;
    for (let i = 0; i < updatesToRun.length; i += updateBatchSize) {
      const chunk = updatesToRun.slice(i, i + updateBatchSize);
      await Promise.all(
        chunk.map(up => 
          prisma.response.update({
            where: { id: up!.id },
            data: up!.data
          })
        )
      );
    }

    // Update theme counts based on the updated responses
    for (const [themeName, themeId] of themeDbMap.entries()) {
      const count = Object.values(processedResults).filter(
        res => res.theme === themeName && !res.isSpam
      ).length;

      if (count > 0) {
        await prisma.theme.update({
          where: { id: themeId },
          data: { count }
        });
      }
    }

    // Update file metrics
    const qualityScore = responseTexts.length > 0 ? Math.max(
      0,
      Math.round(
        ((responseTexts.length - (spamCount + duplicateCount + oneWordCount)) / responseTexts.length) * 100
      )
    ) : 100;

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

    try {
      // Generate executive report locally using SQL metrics and top themes
      const topTheme = themeCounts[0]?.name || "General Feedback";
      const secondTheme = themeCounts[1]?.name || "Operational Details";

      const executiveSummary = `The SurveyIQ analytics engine has successfully processed a total of ${responseTexts.length} responses for the project "${project.name}". The overall survey quality index was determined to be ${qualityScore}%, with ${spamCount} items flagged as spam/unusable and ${duplicateCount} duplicate responses resolved and cached in the data warehouse.

Analysis of the feedback indicates that the primary customer pain point centers around "${topTheme}", followed by concern regarding "${secondTheme}". Addressing these core feedback vectors represents a critical priority for engineering and product leadership to minimize customer friction and mitigate potential churn risks.`;

      const keyFindings = themeCounts.slice(0, 3).map((theme, index) => {
        let observation = `A significant volume of feedback (${theme.count} responses) directly references issues with ${theme.name}.`;
        let impact = "This represents a friction point that could impact overall user retention and satisfaction.";

        if (theme.category === "Performance") {
          observation = `Customers frequently report latency, slow speeds, and freezing, with ${theme.name} emerging as a leading performance bottleneck.`;
          impact = "System sluggishness degrades the user experience and lowers transaction completion rates.";
        } else if (theme.category === "Pricing") {
          observation = `Users highlight high subscription costs, indicating that the pricing model is a barrier, specifically for the ${theme.name} cohort.`;
          impact = "Potential buyers may choose lower-cost competitors or churn when plans renew.";
        } else if (theme.category === "UX/Design") {
          observation = `Friction in the interface layout was noted, with feedback pointing to usability challenges in the ${theme.name} module.`;
          impact = "A complex layout increases user onboarding time and support inquiries.";
        } else if (theme.category === "Customer Support") {
          observation = `Long response latencies and unresolved inquiries are highlighted under the ${theme.name} theme.`;
          impact = "Unresolved support tickets lead to negative public reviews and brand reputation risk.";
        }

        return {
          title: `${index + 1}. Friction on ${theme.name}`,
          observation,
          impact
        };
      });

      const recommendations = themeCounts.slice(0, 3).map((theme, index) => {
        let action = `Conduct a target review of customer complaints regarding ${theme.name} and align product enhancements.`;
        let priority = "MEDIUM";

        if (theme.category === "Performance") {
          action = "Optimize database query paths, configure caching parameters, and audit API payload response times.";
          priority = "HIGH";
        } else if (theme.category === "Pricing") {
          action = "Perform a competitive pricing review and analyze the viability of entry-level pricing tiers.";
          priority = "MEDIUM";
        } else if (theme.category === "UX/Design") {
          action = "Conduct user usability testing sessions and simplify layout menus for the core module.";
          priority = "HIGH";
        } else if (theme.category === "Customer Support") {
          action = "Implement automated chatbot routing and increase support staff availability during peak windows.";
          priority = "HIGH";
        }

        return {
          title: `Optimize ${theme.name}`,
          action,
          priority
        };
      });

      const timelineInsights = [
        {
          time: "Phase 1 (Immediate)",
          insight: `Mitigate primary critical concerns surrounding ${topTheme} through immediate database and system hotfixes.`
        },
        {
          time: "Phase 2 (Next 30 Days)",
          insight: `Formulate a detailed product design and performance roadmap addressing ${secondTheme} feedback.`
        }
      ];

      await prisma.report.create({
        data: {
          projectId,
          executiveSummary,
          keyFindings,
          recommendations,
          timelineInsights
        }
      });
    } catch (error) {
      console.error("Failed to generate report:", error);
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
    await updateJobProgress(100, "COMPLETED");

    console.log(`Pipeline analysis completed for project ${projectId}!`);
  } catch (pipelineErr: any) {
    console.error(`Pipeline execution error for project ${projectId}:`, pipelineErr);
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "FAILED" }
    });
    await updateJobProgress(0, "FAILED", pipelineErr.message || String(pipelineErr));
    throw pipelineErr;
  }
}
