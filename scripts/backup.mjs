// 매일 실행되어 회의록, 일정, 시간표, 문의, 답글을 JSON 파일로 저장한다. docs/backup.md 참고.
// 캡처 신청 정보는 학번 등을 여러 곳에 남기지 않도록 일부러 포함하지 않는다.
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const RETENTION_DAYS = 30;

export const BACKUP_TABLES = [
  { table: "workspaces", columns: "*", order: "id" },
  { table: "workspace_members", columns: "workspace_id, user_id, role, joined_at", order: "user_id" },
  { table: "profiles", columns: "id, display_name", order: "id" },
  { table: "tabs", columns: "*", order: "id" },
  { table: "tab_viewers", columns: "*", order: "tab_id" },
  { table: "notes", columns: "*", order: "tab_id" },
  { table: "calendar_events", columns: "*", order: "id" },
  { table: "inquiries", columns: "*", order: "id" },
  { table: "timetable_people", columns: "*", order: "id" },
  { table: "timetable_entries", columns: "*", order: "id" },
];

const PAGE_SIZE = 1000;
const DATE_FOLDER = /^\d{4}-\d{2}-\d{2}$/;

/** 보관 기간이 지난 날짜 폴더 이름을 돌려준다. 날짜 형식이 아닌 폴더는 건드리지 않는다. */
export function expiredFolders(names, today, days = RETENTION_DAYS) {
  const limit = Date.parse(`${today}T00:00:00Z`) - days * 86_400_000;
  return names.filter((name) => DATE_FOLDER.test(name) && Date.parse(`${name}T00:00:00Z`) < limit);
}

async function readTable(supabase, { table, columns, order }) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table} 표를 읽지 못했습니다: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function readThreads(liveblocks) {
  const threads = {};
  for await (const room of liveblocks.iterRooms({})) {
    const { data } = await liveblocks.getThreads({ roomId: room.id });
    if (data.length > 0) threads[room.id] = data;
  }
  return threads;
}

/** 백업을 임시 폴더에 모두 쓴 뒤 옮겨, 실패해도 기존 백업이 망가지지 않게 한다. */
export async function runBackup({ supabase, liveblocks, dir, today }) {
  const temporary = join(dir, `.incomplete-${today}`);
  const target = join(dir, today);
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });

  const counts = {};
  const save = (name, value) => writeFile(join(temporary, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);

  try {
    for (const source of BACKUP_TABLES) {
      const rows = await readTable(supabase, source);
      counts[source.table] = rows.length;
      await save(source.table, rows);
    }
    const threads = await readThreads(liveblocks);
    counts.note_threads = Object.values(threads).reduce((sum, list) => sum + list.length, 0);
    await save("note_threads", threads);
    await save("manifest", { date: today, counts });

    await rm(target, { recursive: true, force: true });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }

  const folders = (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  for (const name of expiredFolders(folders.map((entry) => entry.name), today)) {
    await rm(join(dir, name), { recursive: true, force: true });
  }
  return counts;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`환경 변수 ${name}이(가) 없습니다.`);
  return value;
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { Liveblocks } = await import("@liveblocks/node");
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false },
  });
  const liveblocks = new Liveblocks({ secret: requireEnv("LIVEBLOCKS_SECRET_KEY") });
  // 폴더 이름을 한국 날짜로 쓴다. sv 형식이 YYYY-MM-DD이다.
  const today = new Date().toLocaleDateString("sv", { timeZone: "Asia/Seoul" });
  const counts = await runBackup({ supabase, liveblocks, dir: requireEnv("BACKUP_DIR"), today });
  // 내용이 아닌 개수만 기록한다.
  console.log(`${today} 백업 완료`, counts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
