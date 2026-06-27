import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🌱 Seeding SurveyIQ database...\n");

  // Clean existing tables in order
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.response.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.surveyFile.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.responseCache.deleteMany();

  console.log("🧹 Cleaned old database tables\n");

  // 1. Create Organization
  const organization = await prisma.organization.create({
    data: { name: "Acme Analytics Corp" }
  });

  // 2. Create Users
  const passwordHash = await bcrypt.hash("demo123", 12);
  const adminUser = await prisma.user.create({
    data: {
      name: "Sarah Jenkins",
      email: "analyst@surveyiq.app",
      passwordHash,
      role: "ADMIN",
      organizationId: organization.id
    }
  });

  console.log(`👤 Created default analyst: ${adminUser.email} (password: demo123)\n`);

  // 3. Create Project
  const project = await prisma.project.create({
    data: {
      name: "Q3 Customer Experience Feedback",
      description: "Annual Q3 customer feedback survey regarding billing, performance, and features.",
      status: "COMPLETED",
      organizationId: organization.id,
      createdById: adminUser.id
    }
  });

  // 4. Create Survey File
  const surveyFile = await prisma.surveyFile.create({
    data: {
      projectId: project.id,
      s3Key: "uploads/q3-customer-experience-feedback.xlsx",
      filename: "q3-customer-experience-feedback.xlsx",
      fileSize: 45280,
      totalRowCount: 50,
      spamCount: 2,
      duplicateCount: 6,
      oneWordCount: 4,
      qualityScore: 76,
      columnMappings: {
        textCols: ["Feedback Comment"],
        ratingCols: ["CSAT Score"],
        dateCols: ["Submission Date"]
      }
    }
  });

  // 5. Create Themes
  const themes = [
    { name: "Checkout Reliability", category: "Performance" },
    { name: "Pricing & Subscription Cost", category: "Pricing" },
    { name: "Mobile App Crashes", category: "Performance" },
    { name: "Customer Support Quality", category: "Support" },
    { name: "Documentation Clarity", category: "Product Features" }
  ];

  const dbThemes: Record<string, string> = {};
  for (const t of themes) {
    const createdTheme = await prisma.theme.create({
      data: {
        projectId: project.id,
        name: t.name,
        category: t.category,
        count: 0
      }
    });
    dbThemes[t.name] = createdTheme.id;
  }

  // 6. Create Responses (Hydrating with structured feedback rows)
  const feedbackData = [
    {
      text: "The checkout screen frozen multiple times. Fix the app crashes.",
      sentiment: "NEGATIVE" as const,
      category: "Performance",
      theme: "Mobile App Crashes",
      urgency: 4,
      action: "Resolve payment memory leaks in iOS/Android builds",
      quote: "checkout screen frozen multiple times"
    },
    {
      text: "I love the product but pricing is too high for small companies.",
      sentiment: "NEGATIVE" as const,
      category: "Pricing",
      theme: "Pricing & Subscription Cost",
      urgency: 3,
      action: "Introduce Tiered pricing for SMBs",
      quote: "pricing is too high for small companies"
    },
    {
      text: "Awesome experience, support solved my issues in five minutes.",
      sentiment: "POSITIVE" as const,
      category: "Support",
      theme: "Customer Support Quality",
      urgency: 1,
      action: "Maintain current SLA response standards",
      quote: "solved my issues in five minutes"
    },
    {
      text: "The documentation page is really hard to follow, code examples are outdated.",
      sentiment: "NEGATIVE" as const,
      category: "Product Features",
      theme: "Documentation Clarity",
      urgency: 2,
      action: "Update API code examples in docs",
      quote: "documentation page is really hard to follow"
    },
    {
      text: "Great dashboard and visual elements. Clean tables.",
      sentiment: "POSITIVE" as const,
      category: "UX/Design",
      theme: "General Praise",
      urgency: 1,
      action: "None required",
      quote: "Great dashboard and visual elements"
    },
    {
      text: "App freezes during payment checkout.",
      sentiment: "NEGATIVE" as const,
      category: "Performance",
      theme: "Checkout Reliability",
      urgency: 5,
      action: "Inspect Stripe integration latency",
      quote: "App freezes during payment"
    },
    {
      text: "Good service.",
      sentiment: "POSITIVE" as const,
      category: "General",
      theme: "General Praise",
      urgency: 1,
      action: "None required",
      quote: "Good service"
    },
    {
      text: "The subscription pricing model feels rigid and expensive.",
      sentiment: "NEGATIVE" as const,
      category: "Pricing",
      theme: "Pricing & Subscription Cost",
      urgency: 3,
      action: "Introduce flexible payment plans",
      quote: "pricing model feels rigid"
    }
  ];

  for (let i = 0; i < 30; i++) {
    const rawFeed = feedbackData[i % feedbackData.length];
    const themeId = dbThemes[rawFeed.theme] || null;

    await prisma.response.create({
      data: {
        projectId: project.id,
        rowIndex: i + 1,
        rawData: {
          "Feedback Comment": rawFeed.text,
          "CSAT Score": (5 - (rawFeed.urgency % 3)),
          "Submission Date": "2026-06-25"
        },
        responseHash: crypto.createHash("sha256").update(rawFeed.text.toLowerCase()).digest("hex"),
        sentiment: rawFeed.sentiment,
        themeId,
        category: rawFeed.category,
        intent: rawFeed.sentiment === "NEGATIVE" ? "Complaint" : "Praise",
        urgency: rawFeed.urgency,
        productArea: rawFeed.category,
        suggestedAction: rawFeed.action,
        confidenceScore: 0.94,
        isSpam: false,
        isDuplicate: i >= feedbackData.length,
        representativeQuote: rawFeed.quote
      }
    });

    if (themeId && i < feedbackData.length) {
      await prisma.theme.update({
        where: { id: themeId },
        data: { count: { increment: 1 } }
      });
    }
  }

  // 7. Create Executive Report
  await prisma.report.create({
    data: {
      projectId: project.id,
      executiveSummary: "Analysis of the Q3 feedback survey reveals high appreciation for our support teams but reveals critical friction during checkout payment processing and pricing package structures. Mobile App crashes represent the highest churn risk for small business segments.",
      keyFindings: [
        {
          title: "Payment Checkout Failures",
          observation: "Approximately 22% of negative responses report UI freezing or payment timeout during checkout.",
          impact: "Immediately blocks user conversions and increases customer acquisition cost."
        },
        {
          title: "Pricing Rigidity",
          observation: "SMBs find the subscription plans expensive with no usage-based option.",
          impact: "Blocks startup segment acquisition and fuels competitor migration."
        }
      ],
      recommendations: [
        {
          title: "Patch Payment Checkout flow",
          action: "Resolve payment memory leaks and optimize backend Stripe callback latencies.",
          priority: "HIGH"
        },
        {
          title: "Design SMB Pricing package",
          action: "Launch a lighter-tier plan ($9/mo) with limited data capacities.",
          priority: "MEDIUM"
        }
      ],
      timelineInsights: [
        {
          time: "Immediate Actions",
          insight: "Fix checkout module crash before the Q4 marketing campaign."
        }
      ]
    }
  });

  console.log("✅ Seeding completed! Database is fully hydrated for demonstration.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
