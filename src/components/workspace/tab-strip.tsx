"use client";

import { Plus } from "lucide-react";
import type { Workspace } from "@/hooks/use-workspace";
import { readableTextOn } from "@/lib/color";
import { resolveTabColor, type Tab, tabFamily } from "@/lib/workspace";
import { TabIcon } from "./tab-icon";

type TabStripProps = {
  tab: Tab;
  workspace: Workspace;
  onNewTab: (parentId: string) => void;
};

export function TabStrip({ tab, workspace, onNewTab }: TabStripProps) {
  const { owner, members } = tabFamily(workspace.tabs, tab.id);
  const divided = members.length > 1;

  return (
    <nav
      aria-label={`${owner.title || "제목 없음"}의 세부 탭`}
      className="mx-3 mb-4 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/70 pb-1.5 md:mx-4"
    >
      {divided &&
        members.map((member) => {
          const active = member.id === tab.id;
          const color = resolveTabColor(workspace.tabs, member.id);
          return (
            <button
              key={member.id}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "chamfer flex min-h-9 max-w-52 shrink-0 items-center gap-2 px-3 text-sm font-medium shadow-soft"
                  : "focus-inset flex min-h-9 max-w-52 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors duration-200 ease-soft hover:bg-secondary hover:text-foreground"
              }
              style={active ? { background: color, color: readableTextOn(color) } : undefined}
              onClick={() => workspace.setView({ type: "tab", id: member.id })}
            >
              <TabIcon template={member.template} className="size-4 shrink-0" style={active ? undefined : { color }} aria-hidden />
              <span className="truncate">{member.title || "제목 없음"}</span>
            </button>
          );
        })}
      <button
        className="focus-inset flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors duration-200 ease-soft hover:bg-secondary hover:text-foreground"
        onClick={() => onNewTab(owner.id)}
      >
        <Plus className="size-4" aria-hidden />
        {divided ? "탭 추가" : "탭 나누기"}
      </button>
    </nav>
  );
}
