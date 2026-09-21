# 🎬 InfraSync-AI Hackathon Demo Guide

## Quick Start

1. **Start the app:**
   ```bash
   cd "/Users/moulikkohli/Downloads/infrasync-ai APP/infrasync-ai"
   npm run dev
   ```
   Open: http://localhost:3000/pm

2. **Live project creation (recommended for demo):**
   ```bash
   npm run demo-create "Bridge Construction Project"
   ```
   This creates a project step-by-step with visible progress (30-40 seconds)

3. **Simulate live field updates:**
   ```bash
   npm run demo-update <projectId>
   ```
   Adds 8-12 new supervisor updates with AI matching in real-time

---

## 🎯 Presentation Flow

### Option A: Fresh Project Demo (Most Impressive)

**Before the demo:**
- Start `npm run dev`
- Have the projects list page open: http://localhost:3000/pm

**During the demo:**

1. **Run the live creation:**
   ```bash
   npm run demo-create "Smart City Infra Phase 2"
   ```

2. **While it runs, narrate:**
   - "The system is importing the baseline schedule..."
   - "Now adding 35+ activities across 6 engineering disciplines"
   - "Processing field actuals and progress updates"
   - "AI is matching supervisor reports to scheduled activities"
   - "Capturing institutional knowledge as lessons learned"

3. **Open the dashboard URL it outputs:**
   - Show the 9 dashboard sections with live data
   - Highlight: Pie chart, bar charts, discipline breakdown, AI confidence analysis

4. **Run live updates:**
   ```bash
   npm run demo-update <projectId from step 1>
   ```
   - Refresh the dashboard to show new data appearing

### Option B: Pre-loaded Demo (Faster)

**Before the demo:**
- Seed all projects: `npm run seed`
- Open any project dashboard

**During the demo:**
- Walk through each dashboard section
- Run `demo-update` to show live updates
- Show the "Institutional Memory" concept

---

## 🎨 What to Highlight

### 1. Project Health Overview (KPI Cards)
- Overall progress %
- Completed, in-progress, delayed, not-started counts
- Pending AI audits
- Schedule variance

### 2. Planned vs Actual Progress (Bars)
- Planned completion % (time-based)
- Actual verified completion %
- Gap shows on-site reality vs schedule

### 3. Activity Status Analysis (Pie Chart + Table)
- Visual status distribution
- Detailed activity table with delays, confidence scores

### 4. Discipline-wise Performance (Bar Chart)
- All 6 disciplines (CIVIL, PIPING, ELECTRICAL, INSTRUMENTATION, MECHANICAL, HSE)
- Progress %, delayed count, avg AI confidence

### 5. AI Confidence & Audit Analysis (Bar Chart)
- 5 decision types: AUTO_ACCEPT, ACCEPT_MONITOR, FLAG_FOR_REVIEW, NO_MATCH, REJECTED
- Confidence distribution (0-59%, 60-79%, 80-89%, 90-100%)
- Average confidence score

### 6. Delay & Variance Analysis (2 Charts)
- Delay days by discipline
- Delay reason distribution (Material, Manpower, Equipment, Weather, Approval, Design Change)

### 7. Critical / At-Risk Activities (List)
- Rule-based flags: overdue, predecessor incomplete, pending audit
- NOT a CPM engine — transparent heuristics

### 8. Supervisor Reporting Analysis (Stats + Feed)
- Total updates, by supervisor, by discipline
- Latest update feed with timestamps

### 9. Institutional Memory (Metrics)
- Verified records count
- Approved lessons learned
- Common delay reasons
- Link to full institutional memory page

---

## 💡 Key Talking Points

1. **AI-Powered Activity Matching**
   - Supervisors speak naturally (voice/text/Excel)
   - AI maps unstructured updates → structured schedule activities
   - Confidence-based routing (auto-accept vs. human review)

2. **Multi-Discipline Coordination**
   - Single unified view across 6+ engineering disciplines
   - Cross-functional progress tracking
   - Identifies bottlenecks before they cascade

3. **Institutional Memory**
   - Learns from delays and issues
   - Builds a knowledge base for future projects
   - Prevents repeated mistakes

4. **Real-Time Dashboard**
   - Live updates as field data comes in
   - Recharts-powered visualizations
   - Filter by discipline, area, status

---

## 🚀 Advanced: Custom Delays

Want to slow down the demo creation for a bigger audience?

Edit `prisma/demo-create.ts` line 16:
```typescript
const DELAY_MS = 800; // Increase for slower, more visible progress
```

Re-run: `npm run demo-create "Your Project"`

---

## 📝 Script Snippets

### Get all project IDs:
```bash
npx tsx -e "
import {PrismaClient} from '@prisma/client';
const p = new PrismaClient();
p.project.findMany().then(ps => {
  ps.forEach(proj => console.log(proj.projectId, '→', proj.projectName));
  p.\$disconnect();
});
"
```

### Quick seed all projects:
```bash
npm run seed
```

### Reset a project (wipe data):
```bash
npx tsx -e "
import {PrismaClient} from '@prisma/client';
const p = new PrismaClient();
const pid = 'PROJECT_ID_HERE';
Promise.all([
  p.lessonLearned.deleteMany({ where: { projectId: pid } }),
  p.aiActivityMatch.deleteMany({ where: { activity: { projectId: pid } } }),
  p.activityActual.deleteMany({ where: { activity: { projectId: pid } } }),
  p.supervisorUpdate.deleteMany({ where: { projectId: pid } }),
  p.scheduleActivity.deleteMany({ where: { projectId: pid } })
]).then(() => { console.log('Reset complete'); p.\$disconnect(); });
"
```

---

## ⚡ Troubleshooting

**Port 3000 already in use:**
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

**Database connection error:**
- Check `.env` file has correct `DATABASE_URL`
- Ensure PostgreSQL is running: `psql -d infrasync`

**Prisma schema out of sync:**
```bash
npx prisma db push
npx prisma generate
```

---

## 🎯 30-Second Elevator Pitch

"InfraSync-AI transforms construction project tracking. Supervisors report progress naturally—voice, text, or Excel—and our AI instantly maps that to the baseline schedule. No more manual data entry. No more weeks-old reports. Just real-time dashboards showing exactly where you are, what's delayed, and why. We capture institutional knowledge so every delay becomes a lesson for the next project. Built for infrastructure projects with 1000+ activities across multiple engineering disciplines."

---

Good luck with your demo! 🚀
