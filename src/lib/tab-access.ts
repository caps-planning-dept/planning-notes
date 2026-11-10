import type { Tab } from "./workspace";

/** 탭 열람자 한 줄. 설정 가능자(canManage)는 열람자이기도 하다. */
export type TabViewer = { tabId: string; userId: string; canManage: boolean };

type Person = { userId: string; role: "admin" | "member" };

/** 자신과 모든 상위 탭을 가까운 순서로 돌려준다. 고리가 있어도 멈춘다. */
export function tabChain(tabs: Tab[], id: string): Tab[] {
  const chain: Tab[] = [];
  const seen = new Set<string>();
  let current = tabs.find((tab) => tab.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    const parentId: string | null = current.parentId;
    current = tabs.find((tab) => tab.id === parentId);
  }
  return chain;
}

function isViewer(viewers: TabViewer[], tabId: string, userId: string) {
  return viewers.some((viewer) => viewer.tabId === tabId && viewer.userId === userId);
}

/**
 * DB의 private.can_see_tab과 같은 기준이다. 관리자도 같다.
 * 자신과 상위 탭 중 "지정한 멤버만"인 탭에 모두 열람자로 들어 있어야 한다.
 */
export function canSeeTab(tabs: Tab[], viewers: TabViewer[], id: string, person: Person): boolean {
  return tabChain(tabs, id).every((tab) => !tab.viewersOnly || isViewer(viewers, tab.id, person.userId));
}

/** 상위 탭 때문에 이 탭을 볼 수 없는지 알려 준다. 체크해도 보이지 않는 멤버를 표시할 때 쓴다. */
export function blockedByParent(tabs: Tab[], viewers: TabViewer[], id: string, person: Person): boolean {
  const parentId = tabs.find((tab) => tab.id === id)?.parentId;
  return parentId != null && !canSeeTab(tabs, viewers, parentId, person);
}

/** 이 탭에서 처음으로 "지정한 멤버만"인 상위 탭. 없으면 null. */
export function restrictedAncestor(tabs: Tab[], id: string): Tab | null {
  return tabChain(tabs, id).slice(1).find((tab) => tab.viewersOnly) ?? null;
}

/** DB의 private.can_manage_tab과 같은 기준(볼 수 있는 탭에서). 캡처 탭은 관리자만 설정한다. */
export function canManageTab(tab: Tab, viewers: TabViewer[], person: Person): boolean {
  if (person.role === "admin") return true;
  if (tab.template === "capture") return false;
  return viewers.some((viewer) => viewer.tabId === tab.id && viewer.userId === person.userId && viewer.canManage);
}

/** 열람자 줄 가운데 설정할 수 있는 사람인지: 관리자이거나 설정 가능(캡처 탭 제외). */
function isKeeper(tab: Tab, viewer: TabViewer, members: Person[]): boolean {
  const member = members.find((item) => item.userId === viewer.userId);
  if (!member) return false;
  return member.role === "admin" || (viewer.canManage && tab.template !== "capture");
}

/**
 * DB의 private.keep_tab_manager와 같은 기준.
 * 이 사람이 빠지거나(leave) 설정 권한을 거두면(unmanage) 설정할 수 있는 사람이 남지 않는지 알려 준다.
 * 그러면 먼저 다른 사람에게 넘겨야 한다. "모든 멤버" 탭은 관리자가 언제나 보므로 관리자의 작업은 막지 않는다.
 */
export function needsHandover(
  tab: Tab,
  viewers: TabViewer[],
  members: Person[],
  actor: Person,
  targetUserId: string,
  kind: "leave" | "unmanage",
): boolean {
  const row = viewers.find((viewer) => viewer.tabId === tab.id && viewer.userId === targetUserId);
  if (!row || !isKeeper(tab, row, members)) return false;
  const targetIsAdmin = members.some((member) => member.userId === targetUserId && member.role === "admin");
  if (kind === "unmanage" && targetIsAdmin) return false;
  if (!tab.viewersOnly && actor.role === "admin") return false;
  return !viewers.some(
    (viewer) => viewer.tabId === tab.id && viewer.userId !== targetUserId && isKeeper(tab, viewer, members),
  );
}
