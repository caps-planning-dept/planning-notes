import type { JSONContent } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";
import type { TabViewer } from "@/lib/tab-access";
import {
  moveTab,
  moveToTrash,
  removeWithDescendants,
  restoreFromTrash,
  type Tab,
  type TabTemplate,
  visibleChildren,
} from "@/lib/workspace";

export type View =
  | { type: "tab"; id: string }
  | { type: "trash" }
  | { type: "members" }
  | { type: "inquiries" }
  | { type: "home" };

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
  viewers_only: boolean;
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
    viewersOnly: row.viewers_only,
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
  const [tabViewers, setTabViewers] = useState<TabViewer[]>([]);
  const dataChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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
      .select("id, parent_id, title, template, color, deleted_at, created_at, pinned_at, viewers_only")
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

  // RLS가 볼 수 있는 탭의 열람자만 돌려준다.
  const fetchViewers = useCallback(async () => {
    const { data, error } = await supabase.from("tab_viewers").select("tab_id, user_id, can_manage");
    if (error) return report(error);
    setTabViewers(data.map((row) => ({ tabId: row.tab_id, userId: row.user_id, canManage: row.can_manage })));
  }, [supabase, report]);

  // 열람 권한이 바뀌면 탭 목록도 바뀐다. 볼 수 없게 된 사람은 탭 변경 알림을 받지 못하므로
  // 바꾼 사람이 따로 알리고(broadcast), 받은 사람은 둘 다 다시 조회한다.
  const fetchAccess = useCallback(async () => {
    await Promise.all([fetchTabs(), fetchViewers()]);
  }, [fetchTabs, fetchViewers]);

  const fetchMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("user_id, role, profiles(email, display_name, avatar_url, last_sign_in_at, last_active_at)")
      .eq("workspace_id", workspaceId);
    if (error) return report(error);
    // 내보내진 사람의 열린 화면을 초대 안내로 보낸다. 데이터 권한은 DB가 이미 막고 있다.
    if (!data.some((row) => row.user_id === userId)) {
      window.location.replace("/");
      return;
    }
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
  }, [supabase, workspaceId, userId, report]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => Promise.all([fetchTabs(), fetchViewers(), fetchEvents(), fetchNotes(), fetchMembers()]))
      .then(() => {
        if (!cancelled) setLoaded(true);
      });

    const dataChannel = supabase
      .channel(`workspace-data:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tabs" }, fetchTabs)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, fetchEvents)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members" }, fetchMembers)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchMembers)
      .on("postgres_changes", { event: "*", schema: "public", table: "tab_viewers" }, fetchAccess)
      .on("broadcast", { event: "access-changed" }, fetchAccess)
      .subscribe();
    dataChannelRef.current = dataChannel;

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
      dataChannelRef.current = null;
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [supabase, workspaceId, userId, fetchTabs, fetchViewers, fetchAccess, fetchEvents, fetchNotes, fetchMembers, report]);

  // 보던 탭을 다른 사람이 지우면 첫 화면으로 돌아간다.
  const selectedTabGone =
    loaded && selectedView?.type === "tab" && !tabs.some((tab) => tab.id === selectedView.id && tab.deletedAt === null);
  const view: View = selectedView && !selectedTabGone ? selectedView : { type: "home" };

  /** 열람 권한을 바꾼 뒤 DB에서 다시 받아 오고, 다른 멤버에게도 다시 받으라고 알린다. */
  async function afterAccessChange(error: { message: string } | null) {
    report(error);
    await fetchAccess();
    dataChannelRef.current?.send({ type: "broadcast", event: "access-changed", payload: {} });
    return !error;
  }

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
    tabViewers,
    onlineIds,
    view,
    setView,
    syncError,
    createTab(input: NewTabInput) {
      const id = crypto.randomUUID();
      const viewersOnly = input.template === "capture";
      setTabs((current) => [...current, { ...input, id, deletedAt: null, createdAt: Date.now(), pinnedAt: null, viewersOnly }]);
      // DB도 새 탭을 만든 사람을 열람자로 넣는다. 캡처 탭이 아니면 설정 가능자로 넣는다.
      setTabViewers((current) => [...current, { tabId: id, userId, canManage: !viewersOnly }]);
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
    /** 탭을 다른 상위 탭 아래나 최상위(parentId = null)로 옮긴다. 하위 탭도 함께 따라간다. */
    moveTab(id: string, parentId: string | null) {
      const before = tabs.find((tab) => tab.id === id);
      const moved = moveTab(tabs, id, parentId).find((tab) => tab.id === id);
      if (!before || !moved || moved === before) return;
      setTabs((current) => moveTab(current, id, parentId));
      supabase
        .from("tabs")
        .update({
          parent_id: moved.parentId,
          pinned_at: moved.pinnedAt === null ? null : new Date(moved.pinnedAt).toISOString(),
        })
        .eq("id", id)
        .then(({ error }) => {
          if (!error) return;
          setTabs((current) =>
            current.map((tab) => (tab.id === id ? { ...tab, parentId: before.parentId, pinnedAt: before.pinnedAt } : tab)),
          );
          report(error);
        });
    },
    /** true면 지정한 멤버만, false면 모든 멤버가 본다. */
    async setTabViewersOnly(id: string, viewersOnly: boolean) {
      setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, viewersOnly } : tab)));
      // DB는 "지정한 멤버만"으로 바꾼 사람을 열람자로 넣는다. 바꾸자마자 탭이 사라지지 않게 미리 반영한다.
      if (viewersOnly && !tabViewers.some((item) => item.tabId === id && item.userId === userId)) {
        setTabViewers((current) => [...current, { tabId: id, userId, canManage: false }]);
      }
      const { error } = await supabase.rpc("set_tab_viewers_only", { target_tab: id, restricted: viewersOnly });
      return afterAccessChange(error);
    },
    /** 열람자로 넣거나 뺀다. 빼면 설정 권한도 함께 사라진다. */
    async setTabViewer(tabId: string, memberId: string, allowed: boolean) {
      setTabViewers((current) =>
        allowed
          ? [...current, { tabId, userId: memberId, canManage: false }]
          : current.filter((item) => !(item.tabId === tabId && item.userId === memberId)),
      );
      const table = supabase.from("tab_viewers");
      const { error } = allowed
        ? await table.insert({ tab_id: tabId, user_id: memberId })
        : await table.delete().eq("tab_id", tabId).eq("user_id", memberId);
      return afterAccessChange(error);
    },
    /** 설정 권한을 주거나 거둔다. 열람자가 아니면 열람자로도 넣는다. */
    async setTabManager(tabId: string, memberId: string, canManage: boolean) {
      const exists = tabViewers.some((item) => item.tabId === tabId && item.userId === memberId);
      setTabViewers((current) =>
        exists
          ? current.map((item) => (item.tabId === tabId && item.userId === memberId ? { ...item, canManage } : item))
          : [...current, { tabId, userId: memberId, canManage }],
      );
      const table = supabase.from("tab_viewers");
      const { error } = exists
        ? await table.update({ can_manage: canManage }).eq("tab_id", tabId).eq("user_id", memberId)
        : await table.insert({ tab_id: tabId, user_id: memberId, can_manage: canManage });
      return afterAccessChange(error);
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
      setView(target ? { type: "tab", id: target.id } : { type: "home" });
    },
    restoreTab(id: string) {
      applyTabs(restoreFromTrash(tabs, id));
    },
    /** 관리자만 휴지통의 탭을 영구 삭제할 수 있다. 지운 행이 없으면 실패로 본다. */
    async purgeTab(id: string): Promise<boolean> {
      const { data, error } = await supabase.from("tabs").delete().eq("id", id).select("id");
      if (error || data.length === 0) return false;
      setTabs((current) => removeWithDescendants(current, id));
      // 지운 달력 탭의 일정은 사라지고, 다른 일정의 탭 연결은 끊긴다.
      await fetchEvents();
      return true;
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
