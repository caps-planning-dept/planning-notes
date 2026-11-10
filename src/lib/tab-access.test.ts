import { describe, expect, it } from "vitest";
import {
  blockedByParent,
  canManageTab,
  canSeeTab,
  needsHandover,
  restrictedAncestor,
  type TabViewer,
} from "./tab-access";
import type { Tab } from "./workspace";

function tab(id: string, parentId: string | null, extra: Partial<Tab> = {}): Tab {
  return { id, parentId, title: id, template: "note", color: null, deletedAt: null, createdAt: 0, pinnedAt: null, viewersOnly: false, ...extra };
}

const admin = { userId: "admin", role: "admin" as const };
const kim = { userId: "kim", role: "member" as const };
const lee = { userId: "lee", role: "member" as const };
const members = [admin, kim, lee];
const viewer = (tabId: string, who: { userId: string } | string, canManage = false): TabViewer => ({
  tabId,
  userId: typeof who === "string" ? who : who.userId,
  canManage,
});

describe("탭 열람", () => {
  it("모든 멤버 탭은 누구나 본다", () => {
    expect(canSeeTab([tab("a", null)], [], "a", kim)).toBe(true);
  });

  it("지정한 멤버만인 탭은 열람자만 본다. 관리자도 같다", () => {
    const tabs = [tab("a", null, { viewersOnly: true })];
    const viewers = [viewer("a", kim)];
    expect(canSeeTab(tabs, viewers, "a", kim)).toBe(true);
    expect(canSeeTab(tabs, viewers, "a", lee)).toBe(false);
    expect(canSeeTab(tabs, viewers, "a", admin)).toBe(false);
    expect(canSeeTab(tabs, [...viewers, viewer("a", admin)], "a", admin)).toBe(true);
  });

  it("상위 탭을 볼 수 없으면 하위 탭도 볼 수 없다", () => {
    const tabs = [tab("a", null, { viewersOnly: true }), tab("b", "a"), tab("c", "b", { viewersOnly: true })];
    const viewers = [viewer("a", kim), viewer("c", lee)];
    expect(canSeeTab(tabs, viewers, "b", kim)).toBe(true);
    expect(canSeeTab(tabs, viewers, "b", lee)).toBe(false);
    expect(canSeeTab(tabs, viewers, "c", lee)).toBe(false);
    expect(canSeeTab(tabs, viewers, "c", kim)).toBe(false);
    expect(blockedByParent(tabs, viewers, "c", lee)).toBe(true);
    expect(blockedByParent(tabs, viewers, "c", kim)).toBe(false);
  });

  it("가장 가까운 지정 상위 탭을 찾는다", () => {
    const tabs = [tab("a", null, { viewersOnly: true }), tab("b", "a"), tab("c", "b")];
    expect(restrictedAncestor(tabs, "c")?.id).toBe("a");
    expect(restrictedAncestor(tabs, "a")).toBeNull();
  });
});

describe("열람자 설정 권한", () => {
  it("관리자와 설정 가능자만 바꾼다", () => {
    const target = tab("a", null);
    const viewers = [viewer("a", kim, true), viewer("a", lee)];
    expect(canManageTab(target, viewers, admin)).toBe(true);
    expect(canManageTab(target, viewers, kim)).toBe(true);
    expect(canManageTab(target, viewers, lee)).toBe(false);
  });

  it("캡처 탭은 관리자만 바꾼다", () => {
    const target = tab("a", null, { template: "capture", viewersOnly: true });
    expect(canManageTab(target, [viewer("a", kim, true)], kim)).toBe(false);
  });

  it("마지막 설정 가능자가 빠지려면 먼저 넘겨야 한다", () => {
    const target = tab("a", null);
    expect(needsHandover(target, [viewer("a", kim, true)], members, kim, "kim", "leave")).toBe(true);
    expect(needsHandover(target, [viewer("a", kim, true), viewer("a", lee, true)], members, kim, "kim", "leave")).toBe(false);
  });

  it("모든 멤버 탭에서는 관리자가 마지막 설정 가능자를 뺄 수 있다", () => {
    expect(needsHandover(tab("a", null), [viewer("a", kim, true)], members, admin, "kim", "leave")).toBe(false);
  });

  it("지정한 멤버만 탭은 관리자도 마지막 설정 가능자를 바로 빼지 못한다", () => {
    const target = tab("a", null, { viewersOnly: true });
    expect(needsHandover(target, [viewer("a", admin)], members, admin, "admin", "leave")).toBe(true);
    expect(needsHandover(target, [viewer("a", admin), viewer("a", kim, true)], members, admin, "admin", "leave")).toBe(false);
    expect(needsHandover(target, [viewer("a", admin), viewer("a", kim, true)], members, kim, "kim", "leave")).toBe(false);
  });

  it("관리자의 설정 권한 칸은 거둬도 넘길 필요가 없다", () => {
    const target = tab("a", null, { viewersOnly: true });
    expect(needsHandover(target, [viewer("a", admin, true)], members, admin, "admin", "unmanage")).toBe(false);
  });

  it("캡처 탭은 다른 관리자가 열람자로 있어야 관리자가 빠진다", () => {
    const target = tab("a", null, { template: "capture", viewersOnly: true });
    expect(needsHandover(target, [viewer("a", admin), viewer("a", kim)], members, admin, "admin", "leave")).toBe(true);
    expect(needsHandover(target, [viewer("a", admin), viewer("a", kim)], members, kim, "kim", "leave")).toBe(false);
  });

  it("내보낸 멤버는 설정 가능자로 세지 않는다", () => {
    const target = tab("a", null);
    const viewers = [viewer("a", kim, true), viewer("a", "gone", true)];
    expect(needsHandover(target, viewers, members, kim, "kim", "leave")).toBe(true);
  });
});
