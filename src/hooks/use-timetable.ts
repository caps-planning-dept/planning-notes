import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClassDraft, TimetableClass, TimetablePerson } from "@/lib/timetable";

type PersonRow = { id: string; name: string; created_by: string | null };

type EntryRow = {
  id: string;
  person_id: string;
  day: number;
  start_minute: number;
  end_minute: number;
  title: string;
  place: string;
};

const ENTRY_COLUMNS = "id, person_id, day, start_minute, end_minute, title, place";

function toClass(row: EntryRow): TimetableClass {
  return {
    id: row.id,
    personId: row.person_id,
    day: row.day,
    start: row.start_minute,
    end: row.end_minute,
    title: row.title,
    place: row.place,
  };
}

function toRow(draft: ClassDraft) {
  return {
    day: draft.day,
    start_minute: draft.start,
    end_minute: draft.end,
    title: draft.title.trim(),
    place: draft.place.trim(),
  };
}

/** 시간표 탭의 사람과 수업. 고칠 수 있는 범위(더한 사람, 관리자)는 DB 권한이 정한다. */
export function useTimetable(tabId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [people, setPeople] = useState<TimetablePerson[]>([]);
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    const [peopleResult, entryResult] = await Promise.all([
      supabase.from("timetable_people").select("id, name, created_by").eq("tab_id", tabId).order("created_at"),
      supabase
        .from("timetable_entries")
        .select(ENTRY_COLUMNS)
        .eq("tab_id", tabId)
        .order("day")
        .order("start_minute"),
    ]);
    if (peopleResult.error || entryResult.error) {
      setError("시간표를 불러오지 못했습니다. 새로고침해 주세요.");
    } else {
      setPeople((peopleResult.data as PersonRow[]).map((row) => ({ id: row.id, name: row.name, createdBy: row.created_by })));
      setClasses((entryResult.data as EntryRow[]).map(toClass));
      setError("");
    }
    setLoaded(true);
  }, [supabase, tabId]);

  useEffect(() => {
    Promise.resolve().then(fetchAll);
    // 다른 사람이 이름이나 수업을 넣거나 고치면 바로 다시 받는다.
    const filter = `tab_id=eq.${tabId}`;
    const channel = supabase
      .channel(`timetable:${tabId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "timetable_people", filter }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "timetable_entries", filter }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tabId, fetchAll]);

  /** 성공하면 새 사람의 id를, 실패하면 안내 문구를 돌려준다. */
  async function addPerson(name: string): Promise<{ id: string } | { error: string }> {
    const { data, error: insertError } = await supabase
      .from("timetable_people")
      .insert({ tab_id: tabId, name: name.trim() })
      .select("id")
      .single();
    if (insertError || !data) {
      return { error: insertError?.code === "23505" ? "같은 이름이 이미 있습니다." : "이름을 더하지 못했습니다. 다시 시도해 주세요." };
    }
    await fetchAll();
    return { id: data.id };
  }

  async function renamePerson(id: string, name: string): Promise<string | null> {
    const { data, error: updateError } = await supabase
      .from("timetable_people")
      .update({ name: name.trim() })
      .eq("id", id)
      .select("id");
    if (updateError?.code === "23505") return "같은 이름이 이미 있습니다.";
    if (updateError || data.length === 0) return "이름을 바꾸지 못했습니다. 다시 시도해 주세요.";
    await fetchAll();
    return null;
  }

  /** 사람을 지우면 그 사람의 수업도 함께 지워진다. */
  async function removePerson(id: string): Promise<string | null> {
    const { data, error: deleteError } = await supabase.from("timetable_people").delete().eq("id", id).select("id");
    if (deleteError || data.length === 0) return "지우지 못했습니다. 다시 시도해 주세요.";
    await fetchAll();
    return null;
  }

  async function add(personId: string, draft: ClassDraft): Promise<string | null> {
    const { error: insertError } = await supabase
      .from("timetable_entries")
      .insert({ tab_id: tabId, person_id: personId, ...toRow(draft) });
    if (insertError) return "수업을 저장하지 못했습니다. 다시 시도해 주세요.";
    await fetchAll();
    return null;
  }

  async function update(id: string, draft: ClassDraft): Promise<string | null> {
    const { data, error: updateError } = await supabase
      .from("timetable_entries")
      .update(toRow(draft))
      .eq("id", id)
      .select("id");
    if (updateError || data.length === 0) return "수업을 고치지 못했습니다. 다시 시도해 주세요.";
    await fetchAll();
    return null;
  }

  async function remove(id: string): Promise<string | null> {
    const { data, error: deleteError } = await supabase.from("timetable_entries").delete().eq("id", id).select("id");
    if (deleteError || data.length === 0) return "수업을 지우지 못했습니다. 다시 시도해 주세요.";
    await fetchAll();
    return null;
  }

  /**
   * 한 사람의 시간표를 통째로 바꾼다(사진으로 채우기).
   * 새 수업을 먼저 넣고 성공하면 예전 수업을 지운다. 중간에 실패해도 시간표가 비지 않는다.
   */
  async function replaceForPerson(personId: string, drafts: ClassDraft[]): Promise<string | null> {
    const oldIds = classes.filter((item) => item.personId === personId).map((item) => item.id);
    if (drafts.length > 0) {
      const { error: insertError } = await supabase
        .from("timetable_entries")
        .insert(drafts.map((draft) => ({ tab_id: tabId, person_id: personId, ...toRow(draft) })));
      if (insertError) return "시간표를 저장하지 못했습니다. 다시 시도해 주세요.";
    }
    if (oldIds.length > 0) {
      const { error: deleteError } = await supabase.from("timetable_entries").delete().in("id", oldIds);
      if (deleteError) {
        await fetchAll();
        return "새 시간표는 저장했지만 예전 수업을 지우지 못했습니다. 겹친 수업을 직접 지워 주세요.";
      }
    }
    await fetchAll();
    return null;
  }

  return { loaded, people, classes, error, addPerson, renamePerson, removePerson, add, update, remove, replaceForPerson };
}
