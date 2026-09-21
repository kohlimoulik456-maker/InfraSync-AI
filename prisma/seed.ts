/**
 * prisma/seed.ts
 * Populates every existing project with realistic demo data so the dashboard
 * renders graphs, tables, and KPI cards instead of empty/zero states.
 *
 * Run:  npm run seed   (calls tsx prisma/seed.ts)
 */

import { PrismaClient } from "@prisma/client";
import { splitOverallIntoCriteria } from "../lib/services/confidenceService";

const prisma = new PrismaClient();

// ─── helpers ──────────────────────────────────────────────────────────────────

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

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number) {
  return Math.round(Math.random() * (max - min) + min);
}

function randFloat(min: number, max: number, dp = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}

// ─── reference data ───────────────────────────────────────────────────────────

const DISCIPLINES = ["CIVIL", "PIPING", "ELECTRICAL", "INSTRUMENTATION", "MECHANICAL", "HSE"] as const;
const AREAS = ["AREA-A", "AREA-B", "AREA-C", "AREA-D", "UTILITY-BLOCK"] as const;
const CONTRACTORS = ["BuildCo Ltd", "PipeTech Inc", "ElectroStar", "MechForce", "SafeGuard Corp"];
const SUPERVISORS = ["SUP-001", "SUP-002", "SUP-003", "SUP-004", "SUP-005"];
const DELAY_REASONS = ["Material", "Manpower", "Equipment", "Weather", "Approval", "Design Change", "Other"];

const ACTIVITY_TEMPLATES: Record<typeof DISCIPLINES[number], string[]> = {
  CIVIL: [
    "Foundation Excavation", "Concrete Pouring – Block A", "Pile Driving – North Section",
    "Retaining Wall Construction", "Grading & Levelling", "Drainage Installation",
    "Road Base Compaction", "Underground Cable Trenching", "Slab on Grade – Phase 1"
  ],
  PIPING: [
    "Process Pipe Spool Fabrication", "Pipe Rack Installation – Row 1", "Hydrostatic Pressure Testing",
    "Flange Assembly & Torquing", "Insulation Wrapping – Hot Lines", "Steam Tracing Installation",
    "Valve Installation – Main Header", "Tie-in Connections – Unit 3", "Flushing & Cleaning"
  ],
  ELECTRICAL: [
    "MCC Panel Installation", "Cable Tray Erection", "LV Cable Pulling – Zone B",
    "Motor Connection & Testing", "Street Lighting Installation", "Earthing & Bonding",
    "Control Room Wiring", "UPS System Commissioning", "Transformer Testing"
  ],
  INSTRUMENTATION: [
    "Field Instrument Installation", "Control Valve Calibration", "DCS Loop Check",
    "Signal Cable Termination", "Transmitter Mounting & Hook-up", "Safety Shutdown System Testing",
    "Pressure Relief Valve Setting", "SCADA Integration Testing", "Analyser House Installation"
  ],
  MECHANICAL: [
    "Pump Package Installation", "Vessel Erection – V-101", "Compressor Skid Assembly",
    "Heat Exchanger Bundle Pulling", "Agitator Installation", "Mechanical Seal Replacement",
    "Gearbox Alignment", "Cooling Tower Erection", "Fan Assembly & Balancing"
  ],
  HSE: [
    "Safety Barrier Installation", "Fire Hydrant Network Testing", "Gas Detector Calibration",
    "Emergency Shower & Eyewash Testing", "Permit-to-Work Audit", "Scaffolding Inspection",
    "Hazardous Material Storage Compliance", "First Aid Station Setup", "Fire Drill Execution"
  ]
};

const DECISIONS = ["AUTO_ACCEPT", "ACCEPT_MONITOR", "FLAG_FOR_REVIEW", "NO_MATCH", "REJECTED"] as const;
type Decision = typeof DECISIONS[number];

const MATCH_STATUSES = ["PENDING", "VALID", "INVALID"] as const;

// Weighted random decision that produces realistic distribution
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
    case "AUTO_ACCEPT":    return randFloat(88, 99);
    case "ACCEPT_MONITOR": return randFloat(70, 87);
    case "FLAG_FOR_REVIEW":return randFloat(45, 69);
    case "NO_MATCH":       return randFloat(10, 44);
    case "REJECTED":       return randFloat(5, 40);
  }
}

const LESSON_TITLES: Record<string, string[]> = {
  Material:        ["Steel delivery bottleneck resolved via pre-order strategy", "Bulk cement procurement improved lead time"],
  Manpower:        ["Multi-skill training reduced crew switching delays", "Shift overlap schedule reduced idle time"],
  Equipment:       ["Crane pre-mobilisation reduced waiting hours", "Hydraulic torque tool preventive maintenance plan"],
  Weather:         ["Wind speed monitoring protocol avoids unsafe lifts", "Monsoon contingency plan for civil works"],
  Approval:        ["Early permit submission reduced PTW cycle time", "Digital PTW system cut approval time by 40%"],
  "Design Change": ["Freeze design at 90% IFC cut rework by 30%", "3D model clash detection eliminated field changes"],
  Other:           ["Weekly coordination meetings improved cross-discipline alignment", "Digital progress reporting reduced reporting lag"]
};

const SUPERVISOR_DESCRIPTIONS: Record<typeof DISCIPLINES[number], string[]> = {
  CIVIL:           ["Foundation work completed ahead of schedule in north section", "Concrete pour for Block A is 60% done, waiting for shuttering", "Excavation hit rock at 2m depth, equipment change required"],
  PIPING:          ["Spool fabrication complete for lines 6-inch and below", "Hydrostatic test passed on Unit 3 tie-ins", "Insulation work on hot lines progressing, 40% done"],
  ELECTRICAL:      ["MCC panel installed and energised in substation B", "Cable pulling in Zone B complete, termination pending", "Transformer testing passed, ready for HV energisation"],
  INSTRUMENTATION: ["All field instruments installed in Area-A, loop checks ongoing", "DCS cabinet wiring 80% complete", "Pressure relief valves set and tagged per datasheet"],
  MECHANICAL:      ["Pump P-101A installed and grouted, awaiting coupling alignment", "Vessel V-201 erected and nozzle orientations verified", "Compressor skid alignment complete, ready for NDE"],
  HSE:             ["Weekly scaffold inspection completed, 2 tags issued", "Gas detector functional test complete – all sensors pass", "Fire drill conducted, evacuation time within target"]
};

// ─── main seeder ──────────────────────────────────────────────────────────────

async function seedProject(projectId: string, projectName: string, index: number) {
  console.log(`  → Seeding: ${projectName} (${projectId})`);

  // Wipe old demo data for this project to allow re-running safely
  await prisma.lessonLearned.deleteMany({ where: { projectId } });
  await prisma.aiActivityMatch.deleteMany({ where: { activity: { projectId } } });
  await prisma.activityActual.deleteMany({ where: { activity: { projectId } } });
  await prisma.supervisorUpdate.deleteMany({ where: { projectId } });
  await prisma.scheduleActivity.deleteMany({ where: { projectId } });

  // ── 1. Schedule Activities (30–40 per project, spread across disciplines) ──

  const activitiesCreated: {
    activityId: string;
    discipline: typeof DISCIPLINES[number];
    area: typeof AREAS[number];
    activityStatus: string;
    plannedFinish: Date;
  }[] = [];

  let prevActivityId: string | undefined;

  for (const discipline of DISCIPLINES) {
    const templates = ACTIVITY_TEMPLATES[discipline];
    const count = rand(5, 7); // 5-7 per discipline = 30-42 total

    for (let i = 0; i < count; i++) {
      const area = pick(AREAS);
      const contractor = pick(CONTRACTORS);
      const wbsL1 = discipline;
      const wbsL2 = area;
      const wbsL3 = `WP-${rand(100, 199)}`;

      // Spread planned dates: some in past (completed/delayed), some future (not started)
      const startOffset = rand(-90, 30) + index * 5;
      const duration = rand(10, 45);
      const plannedStart = daysAgo(-startOffset); // negative offset = future
      const plannedFinish = new Date(plannedStart.getTime() + duration * 86400000);
      const plannedDuration = duration;

      const now = new Date();
      let activityStatus: string;
      if (plannedFinish < now) {
        // past planned finish: completed or delayed
        activityStatus = Math.random() < 0.65 ? "COMPLETED" : "DELAYED";
      } else if (plannedStart < now) {
        // started, not finished: in progress or delayed
        activityStatus = Math.random() < 0.7 ? "IN_PROGRESS" : "DELAYED";
      } else {
        activityStatus = "NOT_STARTED";
      }

      const templateName = templates[i % templates.length];

      const created = await prisma.scheduleActivity.create({
        data: {
          projectId,
          activityName: `${templateName} – ${area}`,
          discipline,
          area,
          contractor,
          wbsL1,
          wbsL2,
          wbsL3,
          plannedStart,
          plannedFinish,
          plannedDuration,
          activityStatus,
          predecessorId: i > 0 && Math.random() < 0.4 ? prevActivityId : undefined
        }
      });

      activitiesCreated.push({ activityId: created.activityId, discipline, area, activityStatus, plannedFinish });
      prevActivityId = created.activityId;
    }
  }

  // ── 2. Activity Actuals (for completed + delayed + in-progress) ──

  const activitiesWithActuals = activitiesCreated.filter(
    (a) => a.activityStatus !== "NOT_STARTED"
  );

  for (const act of activitiesWithActuals) {
    const isCompleted = act.activityStatus === "COMPLETED";
    const isDelayed = act.activityStatus === "DELAYED";

    const delayDays = isDelayed ? rand(3, 30) : isCompleted && Math.random() < 0.2 ? rand(1, 10) : 0;
    const actualFinish = isCompleted
      ? new Date(act.plannedFinish.getTime() + delayDays * 86400000)
      : null;
    const progress = isCompleted ? 100 : rand(20, 85);

    await prisma.activityActual.create({
      data: {
        activityId: act.activityId,
        actualStart: daysAgo(rand(5, 80)),
        actualFinish,
        progressValue: progress,
        delayDays: delayDays > 0 ? delayDays : null,
        delayReason: delayDays > 0 ? pick(DELAY_REASONS) : null,
        verifiedAt: daysAgo(rand(0, 14))
      }
    });
  }

  // ── 3. Supervisor Updates + AI Matches ──

  const updatesPerProject = rand(15, 25);

  for (let u = 0; u < updatesPerProject; u++) {
    const discipline = pick(DISCIPLINES);
    const area = pick(AREAS);
    const supervisor = pick(SUPERVISORS);
    const descriptions = SUPERVISOR_DESCRIPTIONS[discipline];
    const description = descriptions[u % descriptions.length];

    // Try to link to a real activity if possible
    const linkedActivity = activitiesCreated.find(
      (a) => a.discipline === discipline && a.area === area
    );

    const update = await prisma.supervisorUpdate.create({
      data: {
        projectId,
        activityId: linkedActivity?.activityId ?? null,
        supervisorId: supervisor,
        discipline,
        areaUnit: area,
        activityDescription: description,
        rawText: description,
        createdAt: daysAgo(rand(0, 30))
      }
    });

    // Create 1-2 AI matches per update
    const matchCount = Math.random() < 0.7 ? 1 : 2;
    for (let m = 0; m < matchCount; m++) {
      const decision = randomDecision();
      const confidence = confidenceForDecision(decision);
      const matchStatus =
        decision === "FLAG_FOR_REVIEW" ? "PENDING"
        : decision === "REJECTED" ? "INVALID"
        : "VALID";

      await prisma.aiActivityMatch.create({
        data: {
          updateId: update.updateId,
          activityId: linkedActivity?.activityId ?? null,
          projectId,
          overallConfidence: confidence,
          ...splitOverallIntoCriteria(confidence),
          decision,
          matchStatus,
          createdAt: daysAgo(rand(0, 30))
        }
      });
    }
  }

  // ── 4. Lessons Learned ──

  const lessonCount = rand(4, 8);
  const usedReasons = new Set<string>();

  for (let l = 0; l < lessonCount; l++) {
    const reason = pick(DELAY_REASONS);
    usedReasons.add(reason);
    const titles = LESSON_TITLES[reason] || LESSON_TITLES["Other"];
    const title = titles[l % titles.length];

    // Link to a real activity from that discipline if available
    const linkedActivity = activitiesCreated.find(a => 
      a.activityStatus === "COMPLETED" || a.activityStatus === "DELAYED"
    );

    await prisma.lessonLearned.create({
      data: {
        projectId,
        activityId: linkedActivity?.activityId ?? null,
        discipline: linkedActivity?.discipline ?? pick(DISCIPLINES),
        area: linkedActivity?.area ?? pick(AREAS),
        contractor: pick(CONTRACTORS),
        title,
        description: `Lesson captured during ${projectName}: ${title.toLowerCase()}.`,
        delayReason: reason,
        actualDuration: rand(15, 60),
        crewSize: rand(4, 12),
        observation: `Field observation: ${title}`,
        lesson: title,
        recommendation: `Implement ${reason.toLowerCase()} mitigation strategy`,
        approved: Math.random() < 0.75,
        createdAt: daysAgo(rand(10, 120))
      }
    });
  }

  // ── 5. Fund tracing ledger ──

  const fundTransactions = [
    { type: "RECEIPT", amount: 12500000, days: 120, description: "Mobilization advance received", category: "Advance", manager: "Arjun Mehta" },
    { type: "RECEIPT", amount: 8000000, days: 70, description: "Milestone payment received", category: "Progress certificate", manager: "Arjun Mehta" },
    { type: "RECEIPT", amount: 5500000, days: 25, description: "Interim payment certificate received", category: "Progress certificate", manager: "Arjun Mehta" },
    { type: "EXPENDITURE", amount: 6400000, days: 108, description: "Civil works and site mobilization", category: "Construction", manager: "Arjun Mehta" },
    { type: "EXPENDITURE", amount: 4700000, days: 78, description: "Piping materials and fabrication", category: "Materials", manager: "Arjun Mehta" },
    { type: "EXPENDITURE", amount: 2900000, days: 48, description: "Electrical equipment procurement", category: "Procurement", manager: "Arjun Mehta" },
    { type: "EXPENDITURE", amount: 1600000, days: 14, description: "Site labor and supervision", category: "Labor", manager: "Arjun Mehta" }
  ];

  for (const transaction of fundTransactions) {
    await prisma.fundTransaction.create({
      data: {
        projectId,
        transactionType: transaction.type,
        amount: transaction.amount,
        transactionDate: daysAgo(transaction.days),
        description: transaction.description,
        category: transaction.category,
        manager: transaction.manager
      }
    });
  }

  const totalActivities = activitiesCreated.length;
  const completed = activitiesCreated.filter((a) => a.activityStatus === "COMPLETED").length;
  const delayed = activitiesCreated.filter((a) => a.activityStatus === "DELAYED").length;
  const inProgress = activitiesCreated.filter((a) => a.activityStatus === "IN_PROGRESS").length;

  console.log(
    `     ✓ ${totalActivities} activities (${completed} completed, ${inProgress} in-progress, ${delayed} delayed) | ${updatesPerProject} supervisor updates | ${lessonCount} lessons`
  );
}

async function main() {
  console.log("\n🌱  InfraSync-AI Demo Seeder\n");

  const projects = await prisma.project.findMany({
    select: { projectId: true, projectName: true }
  });

  if (projects.length === 0) {
    console.log("No projects found. Create a project first via the UI, then re-run the seed.");
    return;
  }

  console.log(`Found ${projects.length} project(s). Seeding demo data…\n`);

  for (let i = 0; i < projects.length; i++) {
    await seedProject(projects[i].projectId, projects[i].projectName, i);
  }

  console.log("\n✅  Seeding complete! Open the dashboard for any project to see charts and tables.\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
