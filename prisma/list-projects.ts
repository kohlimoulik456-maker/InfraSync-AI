/**
 * prisma/list-projects.ts
 * Quick project ID lookup for demo
 * 
 * Usage:  npm run list-projects
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listProjects() {
  const projects = await prisma.project.findMany({
    select: {
      projectId: true,
      projectName: true,
      createdAt: true,
      _count: {
        select: {
          activities: true,
          supervisorUpdates: true,
          lessonsLearned: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  if (projects.length === 0) {
    console.log("\n📂  No projects found. Create one with:\n");
    console.log('   npm run demo-create "Your Project Name"\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📊  ${projects.length} Project(s):\n`);
  console.log("━".repeat(80));

  for (const p of projects) {
    const shortId = p.projectId.slice(0, 8);
    const date = p.createdAt.toISOString().split("T")[0];
    console.log(`\n${p.projectName}`);
    console.log(`   ID: ${p.projectId}`);
    console.log(`   Created: ${date}`);
    console.log(`   Data: ${p._count.activities} activities | ${p._count.supervisorUpdates} updates | ${p._count.lessonsLearned} lessons`);
    console.log(`   Dashboard: http://localhost:3000/pm/projects/${p.projectId}/dashboard`);
  }

  console.log("\n" + "━".repeat(80));
  console.log("\n💡 To simulate live updates on a project:\n");
  console.log("   npm run demo-update <projectId>\n");

  await prisma.$disconnect();
}

listProjects().catch(e => {
  console.error("Error:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
