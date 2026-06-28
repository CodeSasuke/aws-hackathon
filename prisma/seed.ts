import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🧹 Cleaning SurveyIQ database tables...");
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.response.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.surveyFile.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.responseCache.deleteMany();
  console.log("✅ Database tables successfully cleaned!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
