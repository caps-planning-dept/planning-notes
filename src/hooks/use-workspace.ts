import type { JSONContent } from "@tiptap/react";
import { useEffect, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import {
  moveToTrash,
  purgeExpired,
  restoreFromTrash,
  type Tab,
  type TabTemplate,
  visibleChildren,
} from "@/lib/workspace";

const STORAGE_KEY = "caps-planning:workspace:v1";

export type View = { type: "tab"; id: string } | { type: "trash" } | { type: "empty" };

type WorkspaceData = {
  tabs: Tab[];
  notes: Record<string, JSONContent>;
  events: CalendarEvent[];
};

export type NewTabInput = {
  parentId: string | null;
  title: string;
  template: TabTemplate;
  color: string | null;
};

function initialData(): WorkspaceData {
  return {
    tabs: [
      {
        id: "first-note",
        parentId: null,
        title: "첫 회의록",
        template: "note",
        color: "#5645d4",
        deletedAt: null,
      },
      {
        id: "first-calendar",
        parentId: null,
        title: "동아리 일정",
        template: "calendar",
        color: "#0f8a6a",
        deletedAt: null,
      },
    ],
    notes: {},
    events: [],
  };
}

function loadData(): WorkspaceData {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialData();
    const data = JSON.parse(saved) as WorkspaceData;
    const tabs = purgeExpired(data.tabs, Date.now());
    const kept = new Set(tabs.map((tab) => tab.id));
    return {
      tabs,
      notes: Object.fromEntries(Object.entries(data.notes).filter(([id]) => kept.has(id))),
      events: data.events.filter((event) => kept.has(event.tabId)),
    };
  } catch {
    return initialData();
  }
}

export function useWorkspace() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState<View>(() => {
    const first = visibleChildren(data.tabs, null)[0];
    return first ? { type: "tab", id: first.id } : { type: "empty" };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 저장 공간을 쓸 수 없어도 화면은 계속 동작한다.
    }
  }, [data]);

  return {
    ...data,
    view,
    setView,
    createTab(input: NewTabInput) {
      const id = crypto.randomUUID();
      setData((current) => ({
        ...current,
        tabs: [...current.tabs, { ...input, id, deletedAt: null }],
      }));
      setView({ type: "tab", id });
    },
    updateTab(id: string, change: Partial<Pick<Tab, "title" | "color">>) {
      setData((current) => ({
        ...current,
        tabs: current.tabs.map((tab) => (tab.id === id ? { ...tab, ...change } : tab)),
      }));
    },
    trashTab(id: string) {
      const tabs = moveToTrash(data.tabs, id, Date.now());
      setData({ ...data, tabs });
      const parentId = data.tabs.find((tab) => tab.id === id)?.parentId;
      const next = tabs.find((tab) => tab.id === parentId) ?? visibleChildren(tabs, null)[0];
      setView(next ? { type: "tab", id: next.id } : { type: "empty" });
    },
    restoreTab(id: string) {
      setData((current) => ({ ...current, tabs: restoreFromTrash(current.tabs, id) }));
    },
    saveNote(id: string, content: JSONContent) {
      setData((current) => ({ ...current, notes: { ...current.notes, [id]: content } }));
    },
    saveEvent(event: CalendarEvent) {
      setData((current) => ({
        ...current,
        events: current.events.some((item) => item.id === event.id)
          ? current.events.map((item) => (item.id === event.id ? event : item))
          : [...current.events, event],
      }));
    },
    deleteEvent(id: string) {
      setData((current) => ({
        ...current,
        events: current.events.filter((event) => event.id !== id),
      }));
    },
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
