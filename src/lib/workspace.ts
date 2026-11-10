export type TabTemplate = "note" | "calendar" | "capture" | "timetable";

export type Tab = {
  id: string;
  parentId: string | null;
  title: string;
  template: TabTemplate;
  color: string | null;
  deletedAt: number | null;
  createdAt: number;
  pinnedAt: number | null;
  /** true면 지정한 멤버만 본다. */
  viewersOnly: boolean;
};

export const DEFAULT_TAB_COLOR = "#2b2a27";
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** 고정한 탭을 최근에 고정한 순서로 먼저 두고, 나머지는 최근에 만든 순서로 둔다. */
function compareRootTabs(a: Tab, b: Tab): number {
  if (a.pinnedAt !== null || b.pinnedAt !== null) {
    return (b.pinnedAt ?? -Infinity) - (a.pinnedAt ?? -Infinity);
  }
  return b.createdAt - a.createdAt;
}

/** 최상위 탭은 고정과 최신순으로, 하위 탭은 먼저 만든 순서로 돌려준다. */
export function visibleChildren(tabs: Tab[], parentId: string | null): Tab[] {
  const children = tabs.filter((tab) => tab.parentId === parentId && tab.deletedAt === null);
  return parentId === null ? children.sort(compareRootTabs) : children;
}

/** 탭의 색을 돌려준다. 색이 없으면 가장 가까운 상위 탭의 색을 따른다. */
export function resolveTabColor(tabs: Tab[], id: string): string {
  let current = tabs.find((tab) => tab.id === id);
  while (current) {
    if (current.color) return current.color;
    const parentId: string | null = current.parentId;
    current = tabs.find((tab) => tab.id === parentId);
  }
  return DEFAULT_TAB_COLOR;
}

/**
 * 페이지 안 탭 막대에 보여 줄 묶음을 돌려준다.
 * 하위 탭이 있으면 자신이, 없으면 상위 탭이 묶음의 기준이 된다.
 */
export function tabFamily(tabs: Tab[], id: string): { owner: Tab; members: Tab[] } {
  const self = tabs.find((tab) => tab.id === id);
  if (!self) throw new Error(`탭을 찾을 수 없습니다: ${id}`);
  const parent = tabs.find((tab) => tab.id === self.parentId && tab.deletedAt === null);
  const owner = visibleChildren(tabs, id).length === 0 && parent ? parent : self;
  return { owner, members: [owner, ...visibleChildren(tabs, owner.id)] };
}

function descendantIds(tabs: Tab[], id: string): string[] {
  return tabs
    .filter((tab) => tab.parentId === id)
    .flatMap((child) => [child.id, ...descendantIds(tabs, child.id)]);
}

/** 탭과 아직 휴지통에 없는 하위 탭을 같은 시각으로 휴지통에 넣는다. */
export function moveToTrash(tabs: Tab[], id: string, now: number): Tab[] {
  const targets = new Set([id, ...descendantIds(tabs, id)]);
  return tabs.map((tab) =>
    targets.has(tab.id) && tab.deletedAt === null ? { ...tab, deletedAt: now } : tab,
  );
}

/**
 * 탭을 복구한다. 함께 삭제된 하위 탭도 복구하고, 따로 먼저 삭제한 하위 탭은 그대로 둔다.
 * 상위 탭이 아직 휴지통에 있으면 최상위로 옮긴다.
 */
export function restoreFromTrash(tabs: Tab[], id: string): Tab[] {
  const target = tabs.find((tab) => tab.id === id);
  if (!target || target.deletedAt === null) return tabs;
  const parent = tabs.find((tab) => tab.id === target.parentId);
  const parentMissing = !parent || parent.deletedAt !== null;
  const family = new Set([id, ...descendantIds(tabs, id)]);
  return tabs.map((tab) => {
    if (tab.id === id) {
      return { ...tab, deletedAt: null, parentId: parentMissing ? null : tab.parentId };
    }
    return family.has(tab.id) && tab.deletedAt === target.deletedAt
      ? { ...tab, deletedAt: null }
      : tab;
  });
}

/** 삭제한 지 30일이 지난 탭을 완전히 지운다. */
export function purgeExpired(tabs: Tab[], now: number): Tab[] {
  return tabs.filter(
    (tab) => tab.deletedAt === null || now - tab.deletedAt < TRASH_RETENTION_MS,
  );
}

/**
 * 탭을 영구 삭제할 때 함께 지워지는 것을 알려 준다.
 * DB에서는 하위 탭이 휴지통에 들어간 시각과 상관없이 모두 함께 지워진다.
 */
export function purgeSummary(tabs: Tab[], id: string): { descendants: number; hasCapture: boolean } {
  const family = [id, ...descendantIds(tabs, id)];
  return {
    descendants: family.length - 1,
    hasCapture: tabs.some((tab) => family.includes(tab.id) && tab.template === "capture"),
  };
}

/** 영구 삭제한 탭과 그 하위 탭을 목록에서 뺀다. */
export function removeWithDescendants(tabs: Tab[], id: string): Tab[] {
  const family = new Set([id, ...descendantIds(tabs, id)]);
  return tabs.filter((tab) => !family.has(tab.id));
}

/** 휴지통 목록을 돌려준다. 함께 삭제된 하위 탭은 상위 탭 복구에 포함되므로 뺀다. */
export function trashedRoots(tabs: Tab[]): Tab[] {
  return tabs.filter((tab) => {
    if (tab.deletedAt === null) return false;
    const parent = tabs.find((other) => other.id === tab.parentId);
    return parent?.deletedAt !== tab.deletedAt;
  });
}

/**
 * 탭을 옮길 수 있는 상위 탭 후보를 사이드바 순서대로 돌려준다.
 * 자기 자신과 자기 하위 탭 아래로는 옮길 수 없다. 그러면 탭이 서로를 품는 고리가 생긴다.
 */
export function moveTargets(tabs: Tab[], id: string): { tab: Tab; depth: number }[] {
  const blocked = new Set([id, ...descendantIds(tabs, id)]);
  const walk = (parentId: string | null, depth: number): { tab: Tab; depth: number }[] =>
    visibleChildren(tabs, parentId)
      .filter((tab) => !blocked.has(tab.id))
      .flatMap((tab) => [{ tab, depth }, ...walk(tab.id, depth + 1)]);
  return walk(null, 0);
}

/**
 * 탭을 다른 상위 탭 아래나 최상위로 옮긴다. 하위 탭도 함께 따라간다.
 * 고정은 최상위 탭에만 쓰이므로 하위 탭이 되면 고정을 푼다. 옮길 수 없는 곳이면 그대로 돌려준다.
 */
export function moveTab(tabs: Tab[], id: string, parentId: string | null): Tab[] {
  if (parentId !== null && !moveTargets(tabs, id).some(({ tab }) => tab.id === parentId)) return tabs;
  return tabs.map((tab) =>
    tab.id === id ? { ...tab, parentId, pinnedAt: parentId === null ? tab.pinnedAt : null } : tab,
  );
}
