/**
 * prisma/demo-create.ts
 * Live hackathon demo script — creates a project step-by-step with visible progress
 * 
 * Usage:  npm run demo-create "Bridge Construction Project"
 */

import { PrismaClient } from "@prisma/client";
import { splitOverallIntoCriteria } from "../lib/services/confidenceService";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DELAY_MS = 400; // Speed up/slow down for presentation

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
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

// ─── Reference Data ───────────────────────────────────────────────────────────

const DISCIPLINES = ["CIVIL", "PIPING", "ELECTRICAL", "INSTRUMENTATION", "MECHANICAL", "HSE"] as const;
const AREAS = ["AREA-A", "AREA-B", "AREA-C", "AREA-D", "UTILITY-BLOCK"] as const;
const CONTRACTORS = ["BuildCo Ltd", "PipeTech Inc", "ElectroStar", "MechForce", "SafeGuard Corp"];
const SUPERVISORS = ["SUP-001", "SUP-002", "SUP-003", "SUP-004", "SUP-005"];
const DELAY_REASONS = ["Material", "Manpower", "Equipment", "Weather", "Approval", "Design Change"];

const ACTIVITY_TEMPLATES: Record<typeof DISCIPLINES[number], string[]> = {
  CIVIL: [
    "Foundation Excavation", "Concrete Pouring – Block A", "Pile Driving – North Section",
    "Retaining Wall Construction", "Grading & Levelling", "Drainage Installation"
  ],
  PIPING: [
    "Process Pipe Spool Fabrication", "Pipe Rack Installation – Row 1", "Hydrostatic Pressure Testing",
    "Flange Assembly & Torquing", "Insulation Wrapping – Hot Lines", "Valve Installation – Main Header"
  ],
  ELECTRICAL: [
    "MCC Panel Installation", "Cable Tray Erection", "LV Cable Pulling – Zone B",
    "Motor Connection & Testing", "Street Lighting Installation", "Earthing & Bonding"
  ],
  INSTRUMENTATION: [
    "Field Instrument Installation", "Control Valve Calibration", "DCS Loop Check",
    "Signal Cable Termination", "Transmitter Mounting & Hook-up", "Safety Shutdown System Testing"
  ],
  MECHANICAL: [
    "Pump Package Installation", "Vessel Erection – V-101", "Compressor Skid Assembly",
    "Heat Exchanger Bundle Pulling", "Agitator Installation", "Mechanical Seal Replacement"
  ],
  HSE: [
    "Safety Barrier Installation", "Fire Hydrant Network Testing", "Gas Detector Calibration",
    "Emergency Shower & Eyewash Testing", "Permit-to-Work Audit", "Scaffolding Inspection"
  ]
};

const SUPERVISOR_DESCRIPTIONS: Record<typeof DISCIPLINES[number], string[]> = {
  CIVIL: [
    "Foundation work completed ahead of schedule in north section",
    "Concrete pour for Block A is 60% done, waiting for shuttering",
    "Excavation hit rock at 2m depth, equipment change required"
  ],
  PIPING: [
    "Spool fabrication complete for lines 6-inch and below",
    "Hydrostatic test passed on Unit 3 tie-ins",
    "Insulation work on hot lines progressing, 40% done"
  ],
  ELECTRICAL: [
    "MCC panel installed and energised in substation B",
    "Cable pulling in Zone B complete, termination pending",
    "Transformer testing passed, ready for HV energisation"
  ],
  INSTRUMENTATION: [
    "All field instruments installed in Area-A, loop checks ongoing",
    "DCS cabinet wiring 80% complete",
    "Pressure relief valves set and tagged per datasheet"
  ],
  MECHANICAL: [
    "Pump P-101A installed and grouted, awaiting coupling alignment",
    "Vessel V-201 erected and nozzle orientations verified",
    "Compressor skid alignment complete, ready for NDE"
  ],
  HSE: [
    "Weekly scaffold inspection completed, 2 tags issued",
    "Gas detector functional test complete – all sensors pass",
    "Fire drill conducted, evacuation time within target"
  ]
};

type Decision = "AUTO_ACCEPT" | "ACCEPT_MONITOR" | "FLAG_FOR_REVIEW" | "NO_MATCH" | "REJECTED";

function randomDecision(): Decision {
  const r = Math.random();
  if (r < 0.40) return "AUTO_ACCEPT";
  if (r < 0.65) return "ACCEPT_MONITOR";
  if (r < 0.80) return "FLAG_FOR_REVIEW";
  if (r < 0.92) return "NO_MATCH";
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

const LESSON_TITLES: Record<string, string> = {
  Material:        "Steel delivery bottleneck resolved via pre-order strategy",
  Manpower:        "Multi-skill training reduced crew switching delays",
  Equipment:       "Crane pre-mobilisation reduced waiting hours",
  Weather:         "Wind speed monitoring protocol avoids unsafe lifts",
  Approval:        "Early permit submission reduced PTW cycle time",
  "Design Change": "Freeze design at 90% IFC cut rework by 30%"
};

// ─── Main Demo Flow ───────────────────────────────────────────────────────────

async function demoCreate(projectName: string) {
  console.log("\n🎬  InfraSync-AI — Live Hackathon Demo\n");
  console.log(`📁  Creating project: "${projectName}"\n`);
  await sleep(DELAY_MS);

  // Step 1: Create project
  const project = await prisma.project.create({
    data: { projectName }
  });

  console.log(`✅  Project created: ${project.projectId.slice(0, 8)}...\n`);
  await sleep(DELAY_MS);

  const activities: { activityId: string; discipline: string; activityStatus: string }[] = [];

  // Step 2: Add activities by discipline
  console.log("📋  Adding baseline schedule activities...\n");

  for (const discipline of DISCIPLINES) {
    process.stdout.write(`   ${discipline.padEnd(18)} `);
    const templates = ACTIVITY_TEMPLATES[discipline];
    const count = rand(4, 6);

    for (let i = 0; i < count; i++) {
      const area = pick(AREAS);
      const contractor = pick(CONTRACTORS);
      const startOffset = rand(-60, 20);
      const duration = rand(10, 40);
      const plannedStart = daysAgo(-startOffset);
      const plannedFinish = new Date(plannedStart.getTime() + duration * 86400000);
      const plannedDuration = duration;
      const now = new Date();

      let activityStatus: string;
      if (plannedFinish < now) {
        activityStatus = Math.random() < 0.65 ? "COMPLETED" : "DELAYED";
      } else if (plannedStart < now) {
        activityStatus = Math.random() < 0.7 ? "IN_PROGRESS" : "DELAYED";
      } else {
        activityStatus = "NOT_STARTED";
      }

      const act = await prisma.scheduleActivity.create({
        data: {
          projectId: project.projectId,
          activityName: `${templates[i % templates.length]} – ${area}`,
          discipline,
          area,
          contractor,
          wbsL1: discipline,
          wbsL2: area,
          wbsL3: `WP-${rand(100, 199)}`,
          plannedStart,
          plannedFinish,
          plannedDuration,
          activityStatus
        }
      });

      activities.push({ activityId: act.activityId, discipline, activityStatus });
      process.stdout.write("█");
      await sleep(DELAY_MS / 3);
    }

    console.log(` ${count} activities`);
  }

  console.log(`\n   Total: ${activities.length} activities added\n`);
  await sleep(DELAY_MS);

  // Step 3: Add activity actuals
  console.log("📊  Generating progress actuals...\n");

  const withActuals = activities.filter(a => a.activityStatus !== "NOT_STARTED");
  let actualCount = 0;

  for (const act of withActuals) {
    const isCompleted = act.activityStatus === "COMPLETED";
    const isDelayed = act.activityStatus === "DELAYED";
    const delayDays = isDelayed ? rand(3, 30) : isCompleted && Math.random() < 0.2 ? rand(1, 10) : 0;
    const progress = isCompleted ? 100 : rand(20, 85);

    await prisma.activityActual.create({
      data: {
        activityId: act.activityId,
        actualStart: daysAgo(rand(5, 70)),
        actualFinish: isCompleted ? daysAgo(rand(0, 20)) : null,
        progressValue: progress,
        delayDays: delayDays > 0 ? delayDays : null,
        delayReason: delayDays > 0 ? pick(DELAY_REASONS) : null,
        verifiedAt: daysAgo(rand(0, 10))
      }
    });

    actualCount++;
    if (actualCount % 3 === 0) {
      process.stdout.write(".");
      await sleep(DELAY_MS / 4);
    }
  }

  console.log(`\n   ${actualCount} actuals recorded\n`);
  await sleep(DELAY_MS);

  // Step 4: Add supervisor updates
  console.log("👷  Processing supervisor field updates...\n");

  const updatesPerDiscipline = 3;
  let updateCount = 0;
  let matchCount = 0;

  for (const discipline of DISCIPLINES) {
    process.stdout.write(`   ${discipline.padEnd(18)} `);

    for (let u = 0; u < updatesPerDiscipline; u++) {
      const area = pick(AREAS);
      const supervisor = pick(SUPERVISORS);
      const descriptions = SUPERVISOR_DESCRIPTIONS[discipline];
      const description = descriptions[u % descriptions.length];

      const linkedActivity = activities.find(a => a.discipline === discipline);

      const update = await prisma.supervisorUpdate.create({
        data: {
          projectId: project.projectId,
          activityId: linkedActivity?.activityId ?? null,
          supervisorId: supervisor,
          discipline,
          areaUnit: area,
          activityDescription: description,
          rawText: description,
          createdAt: daysAgo(rand(0, 25))
        }
      });

      updateCount++;

      // Add AI match
      const decision = randomDecision();
      const confidence = confidenceForDecision(decision);
      const matchStatus = decision === "FLAG_FOR_REVIEW" ? "PENDING"
        : decision === "REJECTED" ? "INVALID" : "VALID";

      await prisma.aiActivityMatch.create({
        data: {
          updateId: update.updateId,
          activityId: linkedActivity?.activityId ?? null,
          projectId: project.projectId,
          overallConfidence: confidence,
          ...splitOverallIntoCriteria(confidence),
          decision,
          matchStatus,
          createdAt: daysAgo(rand(0, 25))
        }
      });

      matchCount++;
      process.stdout.write("█");
      await sleep(DELAY_MS / 2);
    }

    console.log(` ${updatesPerDiscipline} updates`);
  }

  console.log(`\n   ${updateCount} updates | ${matchCount} AI matches\n`);
  await sleep(DELAY_MS);

  // Step 5: Add lessons learned
  console.log("💡  Capturing lessons learned...\n");

  let lessonCount = 0;
  for (const reason of DELAY_REASONS.slice(0, 5)) {
    const linkedActivity = activities.find(a => 
      a.activityStatus === "COMPLETED" || a.activityStatus === "DELAYED"
    );

    await prisma.lessonLearned.create({
      data: {
        projectId: project.projectId,
        activityId: linkedActivity?.activityId ?? null,
        discipline: linkedActivity?.discipline ?? pick(DISCIPLINES),
        area: pick(AREAS),
        contractor: pick(CONTRACTORS),
        title: LESSON_TITLES[reason],
        description: `Lesson captured: ${LESSON_TITLES[reason].toLowerCase()}.`,
        delayReason: reason,
        actualDuration: rand(15, 60),
        crewSize: rand(4, 12),
        observation: `Field observation: ${LESSON_TITLES[reason]}`,
        lesson: LESSON_TITLES[reason],
        recommendation: `Implement ${reason.toLowerCase()} mitigation strategy`,
        approved: Math.random() < 0.8,
        createdAt: daysAgo(rand(10, 90))
      }
    });

    lessonCount++;
    process.stdout.write(`   ✓ ${reason}\n`);
    await sleep(DELAY_MS / 2);
  }

  console.log(`\n   ${lessonCount} lessons captured\n`);
  await sleep(DELAY_MS);

  // Summary
  const completed = activities.filter(a => a.activityStatus === "COMPLETED").length;
  const inProgress = activities.filter(a => a.activityStatus === "IN_PROGRESS").length;
  const delayed = activities.filter(a => a.activityStatus === "DELAYED").length;
  const progressPct = ((completed / activities.length) * 100).toFixed(1);

  console.log("━".repeat(60));
  console.log("\n✅  Project creation complete!\n");
  console.log(`📊  Summary:`);
  console.log(`    • ${activities.length} activities (${completed} completed, ${inProgress} in-progress, ${delayed} delayed)`);
  console.log(`    • ${actualCount} verified actuals`);
  console.log(`    • ${updateCount} supervisor updates`);
  console.log(`    • ${matchCount} AI matches processed`);
  console.log(`    • ${lessonCount} lessons learned`);
  console.log(`    • Overall progress: ${progressPct}%\n`);
  console.log(`🌐  Open dashboard:\n`);
  console.log(`    http://localhost:3000/pm/projects/${project.projectId}/dashboard\n`);
  console.log("━".repeat(60) + "\n");

  await prisma.$disconnect();
}

// ─── CLI Entry ────────────────────────────────────────────────────────────────

const projectName = process.argv[2] || "Hackathon Demo Project";
demoCreate(projectName).catch(e => {
  console.error("\n❌ Demo creation failed:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
