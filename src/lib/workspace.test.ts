import { describe, expect, it } from "vitest";
import {
  moveToTrash,
  purgeExpired,
  purgeSummary,
  removeWithDescendants,
  resolveTabColor,
  restoreFromTrash,
  tabFamily,
  trashedRoots,
  type Tab,
  visibleChildren,
} from "./workspace";

const DAY = 24 * 60 * 60 * 1000;

function tab(id: string, parentId: string | null, extra: Partial<Tab> = {}): Tab {
  return { id, parentId, title: id, template: "note", color: null, deletedAt: null, createdAt: 0, pinnedAt: null, ...extra };
}

const ids = (tabs: Tab[]) => tabs.map((item) => item.id);

describe("탭 순서", () => {
  it("최상위 탭은 최근에 만든 탭이 맨 위에 온다", () => {
    const tabs = [tab("old", null, { createdAt: 1 }), tab("new", null, { createdAt: 3 }), tab("mid", null, { createdAt: 2 })];
    expect(ids(visibleChildren(tabs, null))).toEqual(["new", "mid", "old"]);
  });

  it("고정한 탭은 더 최근에 만든 탭보다 위에 온다", () => {
    const tabs = [tab("pinned", null, { createdAt: 1, pinnedAt: 10 }), tab("new", null, { createdAt: 3 })];
    expect(ids(visibleChildren(tabs, null))).toEqual(["pinned", "new"]);
  });

  it("고정한 탭끼리는 최근에 고정한 탭이 위에 온다", () => {
    const tabs = [tab("first", null, { pinnedAt: 10 }), tab("second", null, { pinnedAt: 20 })];
    expect(ids(visibleChildren(tabs, null))).toEqual(["second", "first"]);
  });

  it("하위 탭은 먼저 만든 탭이 위에 남는다", () => {
    const tabs = [tab("root", null), tab("a", "root", { createdAt: 1 }), tab("b", "root", { createdAt: 2 })];
    expect(ids(visibleChildren(tabs, "root"))).toEqual(["a", "b"]);
  });

  it("원본 목록의 순서를 바꾸지 않는다", () => {
    const tabs = [tab("old", null, { createdAt: 1 }), tab("new", null, { createdAt: 2 })];
    visibleChildren(tabs, null);
    expect(ids(tabs)).toEqual(["old", "new"]);
  });
});

describe("탭 색상", () => {
  it("색을 정하지 않은 하위 탭은 가장 가까운 상위 탭의 색을 따른다", () => {
    const tabs = [tab("a", null, { color: "#ff0000" }), tab("b", "a"), tab("c", "b")];
    expect(resolveTabColor(tabs, "c")).toBe("#ff0000");
  });

  it("자기 색이 있으면 상위 탭보다 우선한다", () => {
    const tabs = [tab("a", null, { color: "#ff0000" }), tab("b", "a", { color: "#00ff00" })];
    expect(resolveTabColor(tabs, "b")).toBe("#00ff00");
  });

  it("어디에도 색이 없으면 기본 무채색을 쓴다", () => {
    expect(resolveTabColor([tab("a", null)], "a")).toBe("#2b2a27");
  });
});

describe("페이지 안 탭 묶음", () => {
  const ids = (tabs: Tab[], id: string) => tabFamily(tabs, id).members.map((t) => t.id);

  it("하위 탭이 없는 최상위 탭은 자기 자신만 보여 준다", () => {
    expect(ids([tab("a", null)], "a")).toEqual(["a"]);
  });

  it("상위 탭과 하위 탭 어디에서 보아도 같은 묶음이 보인다", () => {
    const tabs = [tab("a", null), tab("b", "a"), tab("c", "a"), tab("x", null)];
    expect(ids(tabs, "a")).toEqual(["a", "b", "c"]);
    expect(ids(tabs, "c")).toEqual(["a", "b", "c"]);
  });

  it("자기 하위 탭이 있는 탭은 자신을 기준으로 묶는다", () => {
    const tabs = [tab("a", null), tab("b", "a"), tab("c", "b")];
    expect(ids(tabs, "b")).toEqual(["b", "c"]);
  });

  it("휴지통에 있는 탭은 묶음에서 뺀다", () => {
    const tabs = [tab("a", null), tab("b", "a"), tab("c", "a", { deletedAt: 1 })];
    expect(ids(tabs, "a")).toEqual(["a", "b"]);
  });
});

describe("휴지통", () => {
  it("상위 탭을 지우면 하위 탭도 목록에서 사라지고 휴지통에는 상위 탭만 보인다", () => {
    const tabs = moveToTrash([tab("a", null), tab("b", "a"), tab("c", null)], "a", 1000);
    expect(visibleChildren(tabs, null).map((t) => t.id)).toEqual(["c"]);
    expect(trashedRoots(tabs).map((t) => t.id)).toEqual(["a"]);
  });

  it("상위 탭을 복구하면 함께 지운 하위 탭도 돌아온다", () => {
    const trashed = moveToTrash([tab("a", null), tab("b", "a")], "a", 1000);
    const restored = restoreFromTrash(trashed, "a");
    expect(restored.every((t) => t.deletedAt === null)).toBe(true);
  });

  it("먼저 따로 지운 하위 탭은 상위 탭을 복구해도 휴지통에 남는다", () => {
    let tabs = moveToTrash([tab("a", null), tab("b", "a")], "b", 1000);
    tabs = moveToTrash(tabs, "a", 2000);
    tabs = restoreFromTrash(tabs, "a");
    expect(tabs.find((t) => t.id === "a")?.deletedAt).toBeNull();
    expect(tabs.find((t) => t.id === "b")?.deletedAt).toBe(1000);
  });

  it("상위 탭이 휴지통에 있는 하위 탭을 복구하면 최상위로 옮긴다", () => {
    let tabs = moveToTrash([tab("a", null), tab("b", "a")], "b", 1000);
    tabs = moveToTrash(tabs, "a", 2000);
    tabs = restoreFromTrash(tabs, "b");
    expect(tabs.find((t) => t.id === "b")).toMatchObject({ deletedAt: null, parentId: null });
  });

  it("삭제 후 30일이 지나면 완전히 지우고, 그 전에는 남긴다", () => {
    const tabs = [tab("old", null, { deletedAt: 0 }), tab("new", null, { deletedAt: DAY })];
    expect(purgeExpired(tabs, 30 * DAY).map((t) => t.id)).toEqual(["new"]);
  });
});

describe("영구 삭제", () => {
  it("하위 탭 수와 캡처 탭 포함 여부를 알려 준다", () => {
    const tabs = [tab("a", null), tab("b", "a"), tab("c", "b", { template: "capture" }), tab("d", null)];
    expect(purgeSummary(tabs, "a")).toEqual({ descendants: 2, hasCapture: true });
    expect(purgeSummary(tabs, "d")).toEqual({ descendants: 0, hasCapture: false });
  });

  it("먼저 따로 지운 하위 탭도 함께 세고 함께 뺀다", () => {
    let tabs = moveToTrash([tab("a", null), tab("b", "a"), tab("c", null)], "b", 1000);
    tabs = moveToTrash(tabs, "a", 2000);
    expect(purgeSummary(tabs, "a").descendants).toBe(1);
    expect(ids(removeWithDescendants(tabs, "a"))).toEqual(["c"]);
  });
});
