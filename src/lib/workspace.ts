export type TabTemplate = "note" | "calendar";

export type Tab = {
  id: string;
  parentId: string | null;
  title: string;
  template: TabTemplate;
  color: string | null;
  deletedAt: number | null;
};

export const DEFAULT_TAB_COLOR = "#2b2a27";
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function visibleChildren(tabs: Tab[], parentId: string | null): Tab[] {
  return tabs.filter((tab) => tab.parentId === parentId && tab.deletedAt === null);
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

/** 휴지통 목록을 돌려준다. 함께 삭제된 하위 탭은 상위 탭 복구에 포함되므로 뺀다. */
export function trashedRoots(tabs: Tab[]): Tab[] {
  return tabs.filter((tab) => {
    if (tab.deletedAt === null) return false;
    const parent = tabs.find((other) => other.id === tab.parentId);
    return parent?.deletedAt !== tab.deletedAt;
  });
}
