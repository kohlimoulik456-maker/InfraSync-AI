export const dependencyTypeByCode = {
  FS: "FINISH_TO_START",
  SS: "START_TO_START",
  FF: "FINISH_TO_FINISH",
  SF: "START_TO_FINISH"
} as const;

export type ScheduleDependencyType = typeof dependencyTypeByCode[keyof typeof dependencyTypeByCode];

export interface ParsedDependency {
  predecessorActivityId: string;
  dependencyType: ScheduleDependencyType;
  lagDays: number;
}

export function parsePredecessors(
  predecessors: unknown,
  legacyPredecessorId: unknown
): { dependencies: ParsedDependency[]; error?: string } {
  const source = String(predecessors ?? "").trim() || String(legacyPredecessorId ?? "").trim();
  if (!source) return { dependencies: [] };

  const dependencies: ParsedDependency[] = [];
  const seen = new Map<string, number>();
  for (const token of source.split(";")) {
    const parts = token.trim().split(":");
    if (parts.length > 3 || !parts[0]?.trim()) return { dependencies: [], error: `Invalid predecessor entry "${token}".` };
    const code = (parts[1]?.trim().toUpperCase() || "FS") as keyof typeof dependencyTypeByCode;
    if (!Object.prototype.hasOwnProperty.call(dependencyTypeByCode, code)) {
      return { dependencies: [], error: `Unsupported dependency type "${parts[1]}".` };
    }
    const lagDays = parts[2] === undefined || parts[2].trim() === "" ? 0 : Number(parts[2]);
    if (!Number.isInteger(lagDays)) return { dependencies: [], error: `Dependency lag "${parts[2]}" must be a whole number of days.` };

    const dependency = {
      predecessorActivityId: parts[0].trim(),
      dependencyType: dependencyTypeByCode[code],
      lagDays
    };
    const key = `${dependency.predecessorActivityId}:${dependency.dependencyType}`;
    if (seen.has(key)) {
      if (seen.get(key) !== lagDays) return { dependencies: [], error: `Conflicting lag values for predecessor "${dependency.predecessorActivityId}".` };
      continue;
    }
    seen.set(key, lagDays);
    dependencies.push(dependency);
  }
  return { dependencies };
}

export function hasDependencyCycle(
  activityIds: string[],
  dependencies: { predecessorActivityId: string; successorActivityId: string }[]
): boolean {
  const indegree = new Map(activityIds.map((activityId) => [activityId, 0]));
  const successors = new Map(activityIds.map((activityId) => [activityId, [] as string[]]));
  for (const dependency of dependencies) {
    successors.get(dependency.predecessorActivityId)?.push(dependency.successorActivityId);
    indegree.set(dependency.successorActivityId, (indegree.get(dependency.successorActivityId) ?? 0) + 1);
  }
  const ready = activityIds.filter((activityId) => indegree.get(activityId) === 0);
  for (let index = 0; index < ready.length; index++) {
    for (const successorId of successors.get(ready[index]) ?? []) {
      const remaining = (indegree.get(successorId) ?? 0) - 1;
      indegree.set(successorId, remaining);
      if (remaining === 0) ready.push(successorId);
    }
  }
  return ready.length !== activityIds.length;
}

export interface WbsPathSegment {
  code?: string | null;
  name?: string | null;
}

export interface WbsInputActivity {
  activityId: string;
  path: WbsPathSegment[];
}

export interface WbsTreeNode {
  nodeKey: string;
  parentKey: string | null;
  code: string | null;
  name: string;
  level: number;
  sortOrder: number;
}

export function buildWbsTree(activities: WbsInputActivity[]): {
  nodes: WbsTreeNode[];
  activityNodeKeys: Map<string, string>;
} {
  const nodesByKey = new Map<string, WbsTreeNode>();
  const keyByCode = new Map<string, string>();
  const nextSortByParent = new Map<string, number>();
  const activityNodeKeys = new Map<string, string>();

  for (const activity of activities) {
    const path = activity.path
      .map((segment) => ({ code: segment.code?.trim() || null, name: segment.name?.trim() || "" }))
      .filter((segment) => segment.name || segment.code)
      .map((segment) => ({ ...segment, name: segment.name || segment.code! }));
    let parentKey: string | null = null;

    for (const [index, segment] of path.entries()) {
      const identity = segment.code ? `code:${segment.code}` : `name:${segment.name}`;
      const nodeKey: string = JSON.stringify([parentKey, identity]) as string;
      const existing = nodesByKey.get(nodeKey);
      if (existing && existing.name !== segment.name) {
        throw new Error(`WBS code "${segment.code}" has conflicting names in this schedule.`);
      }
      if (segment.code) {
        const existingKey = keyByCode.get(segment.code);
        if (existingKey && existingKey !== nodeKey) {
          throw new Error(`WBS code "${segment.code}" is used by more than one node in this schedule.`);
        }
        keyByCode.set(segment.code, nodeKey);
      }
      if (!existing) {
        const sortOrder = nextSortByParent.get(parentKey ?? "") ?? 0;
        nodesByKey.set(nodeKey, {
          nodeKey,
          parentKey,
          code: segment.code,
          name: segment.name,
          level: index + 1,
          sortOrder
        });
        nextSortByParent.set(parentKey ?? "", sortOrder + 1);
      }
      parentKey = nodeKey;
    }

    if (parentKey) activityNodeKeys.set(activity.activityId, parentKey);
  }

  return { nodes: [...nodesByKey.values()], activityNodeKeys };
}