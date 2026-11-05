import { mkdtemp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BACKUP_TABLES, expiredFolders, runBackup } from "./backup.mjs";

function fakeSupabase(tables, failing) {
  return {
    from: (table) => ({
      select: () => ({
        order: () => ({
          range: async (from, to) =>
            table === failing
              ? { data: null, error: { message: "거부됨" } }
              : { data: (tables[table] ?? []).slice(from, to + 1), error: null },
        }),
      }),
    }),
  };
}

const fakeLiveblocks = (threadsByRoom) => ({
  async *iterRooms() {
    for (const id of Object.keys(threadsByRoom)) yield { id };
  },
  getThreads: async ({ roomId }) => ({ data: threadsByRoom[roomId] }),
});

describe("expiredFolders", () => {
  it("보관 기간이 지난 날짜 폴더만 고른다", () => {
    const names = ["2026-10-06", "2026-10-07", "2026-11-06", ".git", "notes"];
    expect(expiredFolders(names, "2026-11-06", 30)).toEqual(["2026-10-06"]);
  });
});

describe("백업 대상", () => {
  it("캡처 표와 초대 표를 포함하지 않는다", () => {
    const tables = BACKUP_TABLES.map((source) => source.table);
    expect(tables.filter((table) => table.startsWith("capture") || table === "invitations")).toEqual([]);
  });

  it("이메일 칸을 읽지 않는다", () => {
    const profiles = BACKUP_TABLES.find((source) => source.table === "profiles");
    expect(profiles.columns).toBe("id, display_name");
  });
});

describe("runBackup", () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "backup-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("1000건이 넘는 표도 모두 저장하고 답글이 있는 방만 저장한다", async () => {
    const tabs = Array.from({ length: 1001 }, (_, index) => ({ id: String(index) }));
    const counts = await runBackup({
      supabase: fakeSupabase({ tabs }),
      liveblocks: fakeLiveblocks({ "note:a": [{ id: "th" }], "note:b": [] }),
      dir,
      today: "2026-11-06",
    });

    expect(counts.tabs).toBe(1001);
    expect(counts.note_threads).toBe(1);
    const threads = JSON.parse(await readFile(join(dir, "2026-11-06", "note_threads.json"), "utf8"));
    expect(Object.keys(threads)).toEqual(["note:a"]);
  });

  it("실패하면 오류를 내고 그날의 기존 백업을 남긴다", async () => {
    await mkdir(join(dir, "2026-11-06"));
    await expect(
      runBackup({
        supabase: fakeSupabase({}, "notes"),
        liveblocks: fakeLiveblocks({}),
        dir,
        today: "2026-11-06",
      }),
    ).rejects.toThrow("notes 표를 읽지 못했습니다");
    expect(await readdir(dir)).toEqual(["2026-11-06"]);
  });

  it("오래된 백업을 지운다", async () => {
    await mkdir(join(dir, "2026-09-01"));
    await runBackup({ supabase: fakeSupabase({}), liveblocks: fakeLiveblocks({}), dir, today: "2026-11-06" });
    expect(await readdir(dir)).toEqual(["2026-11-06"]);
  });
});
