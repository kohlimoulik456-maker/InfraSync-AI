import { PrismaClient } from "@prisma/client";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  throw new Error("SOURCE_DATABASE_URL and TARGET_DATABASE_URL are required.");
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

async function migrate() {
  const projects = await source.project.findMany();
  const activities = await source.scheduleActivity.findMany();
  const updates = await source.supervisorUpdate.findMany();
  const funds = await source.fundTransaction.findMany();
  const actuals = await source.activityActual.findMany();
  const matches = await source.aiActivityMatch.findMany();
  const lessons = await source.lessonLearned.findMany();

  await target.project.createMany({ data: projects, skipDuplicates: true });
  await target.scheduleActivity.createMany({ data: activities, skipDuplicates: true });
  await target.supervisorUpdate.createMany({ data: updates, skipDuplicates: true });
  await target.fundTransaction.createMany({ data: funds, skipDuplicates: true });
  await target.activityActual.createMany({ data: actuals, skipDuplicates: true });
  await target.aiActivityMatch.createMany({ data: matches, skipDuplicates: true });
  await target.lessonLearned.createMany({ data: lessons, skipDuplicates: true });

  console.log(`Migrated ${projects.length} projects, ${activities.length} activities, ${updates.length} updates, ${lessons.length} lessons.`);
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });