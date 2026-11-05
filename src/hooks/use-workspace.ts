import type { JSONContent } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";
import { moveToTrash, restoreFromTrash, type Tab, type TabTemplate, visibleChildren } from "@/lib/workspace";

export type View =
  | { type: "tab"; id: string }
  | { type: "trash" }
  | { type: "members" }
  | { type: "inquiries" }
  | { type: "empty" };

export type NewTabInput = {
  parentId: string | null;
  title: string;
  template: TabTemplate;
  color: string | null;
};

export type Member = {
  userId: string;
  role: "admin" | "member";
  email: string;
  displayName: string;
  avatarUrl: string | null;
  lastSignInAt: string | null;
  lastActiveAt: string | null;
};

type TabRow = {
  id: string;
  parent_id: string | null;
  title: string;
  template: TabTemplate;
  color: string | null;
  deleted_at: string | null;
  created_at: string;
  pinned_at: string | null;
};

type EventRow = {
  id: string;
  tab_id: string;
  title: string;
  start_date: string;
  end_date: string;
  event_time: string | null;
  assignee: string;
  memo: string;
  color: string | null;
  linked_tab_id: string | null;
};

const ACTIVITY_INTERVAL_MS = 5 * 60 * 1000;
const NOTE_SAVE_DELAY_MS = 800;

function toTab(row: TabRow): Tab {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    template: row.template,
    color: row.color,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    pinnedAt: row.pinned_at ? new Date(row.pinned_at).getTime() : null,
  };
}

function toEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    tabId: row.tab_id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    time: row.event_time?.slice(0, 5) ?? "",
    assignee: row.assignee,
    memo: row.memo,
    color: row.color,
    linkedTabId: row.linked_tab_id,
  };
}

function fromEvent(event: CalendarEvent) {
  return {
    id: event.id,
    tab_id: event.tabId,
    title: event.title,
    start_date: event.startDate,
    end_date: event.endDate,
    event_time: event.time || null,
    assignee: event.assignee,
    memo: event.memo,
    color: event.color,
    linked_tab_id: event.linkedTabId,
  };
}

export function useWorkspace(workspaceId: string, userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [notes, setNotes] = useState<Record<string, JSONContent>>({});
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [selectedView, setView] = useState<View | null>(null);
  const [syncError, setSyncError] = useState("");
  const noteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const report = useCallback((error: { message: string } | null) => {
    if (error) setSyncError("저장하지 못한 변경이 있습니다. 새로고침 후 다시 시도해 주세요.");
  }, []);

  const fetchTabs = useCallback(async () => {
    const { data, error } = await supabase
      .from("tabs")
      .select("id, parent_id, title, template, color, deleted_at, created_at, pinned_at")
      .eq("workspace_id", workspaceId)
      .order("created_at");
    if (error) return report(error);
    setTabs((data as TabRow[]).map(toTab));
  }, [supabase, workspaceId, report]);

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("id, tab_id, title, start_date, end_date, event_time, assignee, memo, color, linked_tab_id")
      .order("start_date");
    if (error) return report(error);
    setEvents((data as EventRow[]).map(toEvent));
  }, [supabase, report]);

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase.from("notes").select("tab_id, content");
    if (error) return report(error);
    setNotes(Object.fromEntries(data.map((row) => [row.tab_id, row.content as JSONContent])));
  }, [supabase, report]);

  const fetchMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("user_id, role, profiles(email, display_name, avatar_url, last_sign_in_at, last_active_at)")
      .eq("workspace_id", workspaceId);
    if (error) return report(error);
    setMembers(
      data.flatMap((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        if (!profile) return [];
        return [
          {
            userId: row.user_id,
            role: row.role as Member["role"],
            email: profile.email,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            lastSignInAt: profile.last_sign_in_at,
            lastActiveAt: profile.last_active_at,
          },
        ];
      }),
    );
  }, [supabase, workspaceId, report]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => Promise.all([fetchTabs(), fetchEvents(), fetchNotes(), fetchMembers()]))
      .then(() => {
        if (!cancelled) setLoaded(true);
      });

    const dataChannel = supabase
      .channel(`workspace-data:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tabs" }, fetchTabs)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, fetchEvents)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members" }, fetchMembers)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchMembers)
      .subscribe();

    const presenceChannel = supabase.channel(`workspace-presence:${workspaceId}`, {
      config: { presence: { key: userId } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(Object.keys(presenceChannel.presenceState()));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") presenceChannel.track({ onlineAt: new Date().toISOString() });
      });

    const touchActivity = () => {
      if (document.visibilityState !== "visible") return;
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", userId)
        .then(({ error }) => report(error));
    };
    touchActivity();
    const activityTimer = setInterval(touchActivity, ACTIVITY_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(activityTimer);
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [supabase, workspaceId, userId, fetchTabs, fetchEvents, fetchNotes, fetchMembers, report]);

  const fallbackRoot = visibleChildren(tabs, null)[0];
  // 처음 연 탭을 고정한다. 그러지 않으면 다른 사람이 새 탭을 만들 때 보던 화면이 그 탭으로 넘어간다.
  // 보던 탭을 다른 사람이 지운 경우에도 남아 있는 첫 탭으로 옮긴다.
  const selectedTabGone =
    selectedView?.type === "tab" && !tabs.some((tab) => tab.id === selectedView.id && tab.deletedAt === null);
  if (loaded && fallbackRoot && (!selectedView || selectedTabGone)) setView({ type: "tab", id: fallbackRoot.id });
  const view: View =
    selectedView ?? (fallbackRoot ? { type: "tab", id: fallbackRoot.id } : { type: "empty" });

  function applyTabs(next: Tab[]) {
    const changed = next.filter((tab) => {
      const before = tabs.find((item) => item.id === tab.id);
      return before?.deletedAt !== tab.deletedAt || before?.parentId !== tab.parentId;
    });
    setTabs(next);
    changed.forEach((tab) => {
      supabase
        .from("tabs")
        .update({
          parent_id: tab.parentId,
          deleted_at: tab.deletedAt === null ? null : new Date(tab.deletedAt).toISOString(),
        })
        .eq("id", tab.id)
        .then(({ error }) => report(error));
    });
  }

  return {
    loaded,
    tabs,
    notes,
    events,
    members,
    onlineIds,
    view,
    setView,
    syncError,
    createTab(input: NewTabInput) {
      const id = crypto.randomUUID();
      setTabs((current) => [...current, { ...input, id, deletedAt: null, createdAt: Date.now(), pinnedAt: null }]);
      supabase
        .from("tabs")
        .insert({
          id,
          workspace_id: workspaceId,
          parent_id: input.parentId,
          title: input.title,
          template: input.template,
          color: input.color,
        })
        .then(({ error }) => {
          if (error) {
            setTabs((current) => current.filter((tab) => tab.id !== id));
            return report(error);
          }
          // 노트 입장 권한은 DB의 탭을 확인하므로, 저장이 끝난 뒤에 탭을 연다.
          setView({ type: "tab", id });
        });
    },
    updateTab(id: string, change: Partial<Pick<Tab, "title" | "color">>) {
      setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...change } : tab)));
      supabase
        .from("tabs")
        .update(change)
        .eq("id", id)
        .then(({ error }) => report(error));
    },
    setTabPinned(id: string, pinned: boolean) {
      const now = Date.now();
      setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, pinnedAt: pinned ? now : null } : tab)));
      supabase
        .from("tabs")
        .update({ pinned_at: pinned ? new Date(now).toISOString() : null })
        .eq("id", id)
        .then(({ error }) => report(error));
    },
    updateDisplayName(name: string) {
      // 노트는 이름이 바뀌면 다시 입장해 DB의 이름을 받으므로, 저장이 끝난 뒤에 화면을 바꾼다.
      supabase
        .from("profiles")
        .update({ display_name: name })
        .eq("id", userId)
        .then(({ error }) => {
          if (error) return report(error);
          setMembers((current) =>
            current.map((member) => (member.userId === userId ? { ...member, displayName: name } : member)),
          );
        });
    },
    trashTab(id: string) {
      const next = moveToTrash(tabs, id, Date.now());
      applyTabs(next);
      const parentId = tabs.find((tab) => tab.id === id)?.parentId;
      const target = next.find((tab) => tab.id === parentId) ?? visibleChildren(next, null)[0];
      setView(target ? { type: "tab", id: target.id } : { type: "empty" });
    },
    restoreTab(id: string) {
      applyTabs(restoreFromTrash(tabs, id));
    },
    saveNote(id: string, content: JSONContent) {
      setNotes((current) => ({ ...current, [id]: content }));
      const timers = noteTimers.current;
      const pending = timers.get(id);
      if (pending) clearTimeout(pending);
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          supabase
            .from("notes")
            .upsert({ tab_id: id, content, updated_at: new Date().toISOString() })
            .then(({ error }) => report(error));
        }, NOTE_SAVE_DELAY_MS),
      );
    },
    saveEvent(event: CalendarEvent) {
      setEvents((current) =>
        current.some((item) => item.id === event.id)
          ? current.map((item) => (item.id === event.id ? event : item))
          : [...current, event],
      );
      supabase
        .from("calendar_events")
        .upsert(fromEvent(event))
        .then(({ error }) => report(error));
    },
    deleteEvent(id: string) {
      setEvents((current) => current.filter((event) => event.id !== id));
      supabase
        .from("calendar_events")
        .delete()
        .eq("id", id)
        .then(({ error }) => report(error));
    },
    removeMember(memberId: string) {
      setMembers((current) => current.filter((member) => member.userId !== memberId));
      supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", memberId)
        .then(({ error }) => report(error));
    },
    async createInvitation(): Promise<string | null> {
      const { data, error } = await supabase.rpc("create_invitation", {
        target_workspace: workspaceId,
      });
      report(error);
      return error ? null : (data as string);
    },
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
