import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { parse } from "pg-connection-string";

const connectionString = process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (connectionString) {
    const poolConfig = parse(connectionString);
    if (!connectionString.includes("localhost") && !connectionString.includes("127.0.0.1")) {
      poolConfig.ssl = { rejectUnauthorized: false };
    } else {
      poolConfig.ssl = false;
    }
    const pool = new Pool(poolConfig as any);
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }
  // Fallback for when no DB is connected (build time, etc.)
  const pool = new Pool({ connectionString: "postgresql://localhost:5432/surveyiq" });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
