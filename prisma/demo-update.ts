/**
 * prisma/demo-update.ts
 * Simulates live field updates coming in — adds more data to an existing project
 * 
 * Usage:  npm run demo-update <projectId>
 *         npm run demo-update e3516b2e-d12a-40b7-b466-9c4241d21923
 */

import { PrismaClient } from "@prisma/client";
import { splitOverallIntoCriteria } from "../lib/services/confidenceService";

const prisma = new PrismaClient();

const DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function rand(min: number, max: number) {
  return Math.round(Math.random() * (max - min) + min);
}

function randFloat(min: number, max: number) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SUPERVISORS = ["SUP-001", "SUP-002", "SUP-003", "SUP-004", "SUP-006"];
const DELAY_REASONS = ["Material", "Manpower", "Equipment", "Weather", "Approval"];

const NEW_UPDATES = [
  "Concrete curing complete, ready for next phase",
  "Cable termination work started in MCC room",
  "Valve pressure testing completed successfully",
  "Foundation bolting completed, torque values recorded",
  "Insulation work delayed due to material shortage",
  "Fire alarm loop testing in progress – 70% done",
  "Pump alignment verified and documented",
  "Emergency lighting installation complete in all zones",
  "Piping hydro test passed with zero leaks",
  "Scaffolding erected for high-level electrical work"
];

type Decision = "AUTO_ACCEPT" | "ACCEPT_MONITOR" | "FLAG_FOR_REVIEW" | "NO_MATCH" | "REJECTED";

function randomDecision(): Decision {
  const r = Math.random();
  if (r < 0.45) return "AUTO_ACCEPT";
  if (r < 0.70) return "ACCEPT_MONITOR";
  if (r < 0.85) return "FLAG_FOR_REVIEW";
  if (r < 0.93) return "NO_MATCH";
  return "REJECTED";
}

function confidenceForDecision(d: Decision): number {
  switch (d) {
    case "AUTO_ACCEPT":     return randFloat(88, 99);
    case "ACCEPT_MONITOR":  return randFloat(70, 87);
    case "FLAG_FOR_REVIEW": return randFloat(45, 69);
    case "NO_MATCH":        return randFloat(10, 44);
    case "REJECTED":        return randFloat(5, 40);
  }
}

async function demoUpdate(projectId: string) {
  console.log("\n📡  InfraSync-AI — Simulating Live Field Updates\n");

  const project = await prisma.project.findUnique({ where: { projectId } });
  if (!project) {
    console.error(`❌  Project ${projectId} not found.`);
    process.exit(1);
  }

  console.log(`📁  Project: ${project.projectName} (${projectId.slice(0, 8)}...)\n`);
  await sleep(DELAY_MS);

  const activities = await prisma.scheduleActivity.findMany({
    where: { projectId },
    select: { activityId: true, activityName: true, discipline: true, area: true, activityStatus: true }
  });

  if (activities.length === 0) {
    console.error("❌  No activities found. Create activities first.");
    process.exit(1);
  }

  console.log(`📋  Found ${activities.length} activities\n`);
  console.log("👷  Simulating supervisor updates from the field...\n");
  await sleep(DELAY_MS);

  const updateCount = rand(8, 12);

  for (let i = 0; i < updateCount; i++) {
    const activity = pick(activities);
    const supervisor = pick(SUPERVISORS);
    const description = NEW_UPDATES[i % NEW_UPDATES.length];

    console.log(`   [${i + 1}/${updateCount}] ${supervisor} → ${activity.discipline} / ${activity.area}`);
    console.log(`       "${description}"`);

    const update = await prisma.supervisorUpdate.create({
      data: {
        projectId,
        activityId: activity.activityId,
        supervisorId: supervisor,
        discipline: activity.discipline,
        areaUnit: activity.area,
        activityDescription: description,
        rawText: description,
        createdAt: new Date()
      }
    });

    await sleep(DELAY_MS / 2);

    // AI matching
    const decision = randomDecision();
    const confidence = confidenceForDecision(decision);
    const matchStatus = decision === "FLAG_FOR_REVIEW" ? "PENDING"
      : decision === "REJECTED" ? "INVALID" : "VALID";

    await prisma.aiActivityMatch.create({
      data: {
        updateId: update.updateId,
        activityId: activity.activityId,
        projectId,
        overallConfidence: confidence,
        ...splitOverallIntoCriteria(confidence),
        decision,
        matchStatus,
        createdAt: new Date()
      }
    });

    console.log(`       🤖 AI: ${decision} (${confidence.toFixed(1)}% confidence)`);

    // Update activity actual if high confidence
    if (decision === "AUTO_ACCEPT" || decision === "ACCEPT_MONITOR") {
      const existing = await prisma.activityActual.findFirst({
        where: { activityId: activity.activityId },
        orderBy: { verifiedAt: "desc" }
      });

      const newProgress = existing ? Math.min(100, existing.progressValue! + rand(5, 20)) : rand(10, 40);
      const isCompleted = newProgress >= 100;

      await prisma.activityActual.create({
        data: {
          activityId: activity.activityId,
          actualStart: existing?.actualStart ?? daysAgo(rand(5, 30)),
          actualFinish: isCompleted ? new Date() : null,
          progressValue: newProgress,
          delayDays: null,
          delayReason: null,
          verifiedAt: new Date()
        }
      });

      if (isCompleted && activity.activityStatus !== "COMPLETED") {
        await prisma.scheduleActivity.update({
          where: { activityId: activity.activityId },
          data: { activityStatus: "COMPLETED" }
        });
        console.log(`       ✅ Activity marked COMPLETED (${newProgress}%)`);
      } else {
        console.log(`       📊 Progress updated: ${newProgress}%`);
      }
    }

    console.log("");
    await sleep(DELAY_MS * 1.5);
  }

  // Add a new lesson learned
  console.log("💡  Capturing new lesson learned...\n");
  const reason = pick(DELAY_REASONS);
  const lessonTitles: Record<string, string> = {
    Material: "Just-in-time delivery reduced on-site storage costs",
    Manpower: "Cross-training program improved resource flexibility",
    Equipment: "Predictive maintenance reduced unplanned downtime",
    Weather: "Weather contingency buffer built into critical path",
    Approval: "Parallel permitting process reduced approval cycle"
  };

  const linkedActivity = activities.find(a => 
    a.activityStatus === "COMPLETED" || a.activityStatus === "DELAYED"
  );

  await prisma.lessonLearned.create({
    data: {
      projectId,
      activityId: linkedActivity?.activityId ?? null,
      discipline: linkedActivity?.discipline ?? pick(["CIVIL", "PIPING", "ELECTRICAL", "INSTRUMENTATION", "MECHANICAL", "HSE"]),
      area: linkedActivity?.area ?? pick(["AREA-A", "AREA-B", "AREA-C", "AREA-D", "UTILITY-BLOCK"]),
      contractor: pick(["BuildCo Ltd", "PipeTech Inc", "ElectroStar", "MechForce", "SafeGuard Corp"]),
      title: lessonTitles[reason],
      description: `Recent insight: ${lessonTitles[reason].toLowerCase()}.`,
      delayReason: reason,
      actualDuration: rand(18, 55),
      crewSize: rand(5, 10),
      observation: `Field observation: ${lessonTitles[reason]}`,
      lesson: lessonTitles[reason],
      recommendation: `Apply ${reason.toLowerCase()} best practice to future projects`,
      approved: true,
      createdAt: new Date()
    }
  });

  console.log(`   ✓ ${reason}: ${lessonTitles[reason]}\n`);
  await sleep(DELAY_MS);

  // Summary
  const allUpdates = await prisma.supervisorUpdate.count({ where: { projectId } });
  const allMatches = await prisma.aiActivityMatch.count({ where: { projectId } });
  const allActuals = await prisma.activityActual.count({ where: { activity: { projectId } } });
  const allLessons = await prisma.lessonLearned.count({ where: { projectId, approved: true } });

  console.log("━".repeat(60));
  console.log("\n✅  Field update simulation complete!\n");
  console.log(`📊  Updated Totals:`);
  console.log(`    • ${allUpdates} supervisor updates`);
  console.log(`    • ${allMatches} AI matches`);
  console.log(`    • ${allActuals} verified actuals`);
  console.log(`    • ${allLessons} approved lessons\n`);
  console.log(`🌐  Refresh dashboard to see new data:\n`);
  console.log(`    http://localhost:3000/pm/projects/${projectId}/dashboard\n`);
  console.log("━".repeat(60) + "\n");

  await prisma.$disconnect();
}

const projectId = process.argv[2];
if (!projectId) {
  console.error("\n❌ Usage: npm run demo-update <projectId>\n");
  console.log("Get project IDs by running:\n");
  console.log('  npx tsx -e "import {PrismaClient} from \'@prisma/client\'; const p=new PrismaClient(); p.project.findMany().then(ps => ps.forEach(p => console.log(p.projectId, p.projectName))).then(() => p.$disconnect())"\n');
  process.exit(1);
}

demoUpdate(projectId).catch(e => {
  console.error("\n❌ Update failed:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
