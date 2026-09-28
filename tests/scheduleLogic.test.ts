import assert from "node:assert/strict";
import test from "node:test";
import { buildWbsTree, hasDependencyCycle, parsePredecessors } from "../lib/services/scheduleLogic";

test("legacy predecessor IDs default to finish-to-start with zero lag", () => {
  assert.deepEqual(parsePredecessors("", "A-1"), {
    dependencies: [{ predecessorActivityId: "A-1", dependencyType: "FINISH_TO_START", lagDays: 0 }]
  });
});

test("parses multiple typed dependencies and lags", () => {
  assert.deepEqual(parsePredecessors("A-1:FS:0; A-2:ss:2; A-3:FF:-1", ""), {
    dependencies: [
      { predecessorActivityId: "A-1", dependencyType: "FINISH_TO_START", lagDays: 0 },
      { predecessorActivityId: "A-2", dependencyType: "START_TO_START", lagDays: 2 },
      { predecessorActivityId: "A-3", dependencyType: "FINISH_TO_FINISH", lagDays: -1 }
    ]
  });
});

test("rejects unsupported types, fractional lags, and conflicting duplicate links", () => {
  assert.match(parsePredecessors("A-1:XY:1", "").error ?? "", /Unsupported dependency type/);
  assert.match(parsePredecessors("A-1:FS:1.5", "").error ?? "", /whole number/);
  assert.match(parsePredecessors("A-1:FS:0;A-1:FS:2", "").error ?? "", /Conflicting lag/);
});

test("detects dependency cycles without rejecting an acyclic graph", () => {
  const chain = [
    { predecessorActivityId: "A", successorActivityId: "B" },
    { predecessorActivityId: "B", successorActivityId: "C" }
  ];
  assert.equal(hasDependencyCycle(["A", "B", "C"], chain), false);
  assert.equal(hasDependencyCycle(["A", "B", "C"], [...chain, { predecessorActivityId: "C", successorActivityId: "A" }]), true);
});

test("WBS codes keep same-named nodes distinct and stable", () => {
  const tree = buildWbsTree([
    { activityId: "A-1", path: [{ code: "P", name: "Project" }, { code: "UTIL-1", name: "Utilities" }] },
    { activityId: "A-2", path: [{ code: "P", name: "Project" }, { code: "UTIL-2", name: "Utilities" }] }
  ]);

  assert.equal(tree.nodes.length, 3);
  assert.notEqual(tree.activityNodeKeys.get("A-1"), tree.activityNodeKeys.get("A-2"));
  assert.equal(tree.nodes.filter((node) => node.name === "Utilities").length, 2);
});

test("merges identical legacy name paths and rejects duplicate codes on separate nodes", () => {
  const tree = buildWbsTree([
    { activityId: "A-1", path: [{ name: "Project" }, { name: "Civil" }] },
    { activityId: "A-2", path: [{ name: "Project" }, { name: "Civil" }] }
  ]);
  assert.equal(tree.nodes.length, 2);

  assert.throws(() => buildWbsTree([
    { activityId: "A-1", path: [{ code: "W-1", name: "Civil" }] },
    { activityId: "A-2", path: [{ code: "W-1", name: "Piping" }] }
  ]), /conflicting names/);
});