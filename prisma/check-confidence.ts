import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const one = await prisma.aiActivityMatch.findUnique({
    where: { id: "0c03ad94-12ed-438d-99db-6ef623748d7b" }
  });
  console.log(one);
  const missing = await prisma.aiActivityMatch.count({
    where: { semanticSimilarity: null }
  });
  const total = await prisma.aiActivityMatch.count();
  console.log({ missing, total });
}

main().finally(() => prisma.$disconnect());
