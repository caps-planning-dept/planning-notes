"use client";

import { Plus, Trash2, Users, X } from "lucide-react";
import Image from "next/image";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/hooks/use-workspace";
import { readableTextOn } from "@/lib/color";
import { cn } from "@/lib/utils";
import { resolveTabColor, type Tab, trashedRoots, visibleChildren } from "@/lib/workspace";
import logo from "../../../assets/logo/caps-lockup-on-white.png";
import { TabIcon } from "./tab-icon";

type SidebarProps = {
  workspace: Workspace;
  open: boolean;
  onClose: () => void;
  onNewTab: (parentId: string | null) => void;
};

export function Sidebar({ workspace, open, onClose, onNewTab }: SidebarProps) {
  const trashCount = trashedRoots(workspace.tabs).length;
  const trashActive = workspace.view.type === "trash";
  const membersActive = workspace.view.type === "members";

  return (
    <>
      {open && (
        <button
          aria-label="탭 목록 닫기"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col gap-3 border-r bg-sidebar p-3 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Image src={logo} alt="CAPS" priority className="h-10 w-auto mix-blend-multiply" />
          <Button variant="ghost" size="icon" aria-label="탭 목록 닫기" className="md:hidden" onClick={onClose}>
            <X />
          </Button>
        </div>
        <Button variant="outline" className="chamfer justify-start rounded-none border-0 bg-muted" onClick={() => onNewTab(null)}>
          <Plus data-icon="inline-start" />새 탭
        </Button>
        <nav aria-label="탭 목록" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <TabBranch parentId={null} depth={0} workspace={workspace} onNewTab={onNewTab} onPicked={onClose} />
        </nav>
        <Button
          variant="ghost"
          aria-current={membersActive ? "page" : undefined}
          className={cn("justify-start", membersActive && "bg-muted")}
          onClick={() => {
            workspace.setView({ type: "members" });
            onClose();
          }}
        >
          <Users data-icon="inline-start" />
          멤버 ({workspace.members.length})
        </Button>
        <Button
          variant="ghost"
          aria-current={trashActive ? "page" : undefined}
          className={cn("justify-start", trashActive && "bg-muted")}
          onClick={() => {
            workspace.setView({ type: "trash" });
            onClose();
          }}
        >
          <Trash2 data-icon="inline-start" />
          휴지통{trashCount > 0 && ` (${trashCount})`}
        </Button>
        <SignOutButton />
      </aside>
    </>
  );
}

type TabBranchProps = {
  parentId: string | null;
  depth: number;
  workspace: Workspace;
  onNewTab: (parentId: string) => void;
  onPicked: () => void;
};

function TabBranch({ parentId, depth, workspace, onNewTab, onPicked }: TabBranchProps) {
  return visibleChildren(workspace.tabs, parentId).map((tab) => (
    <div key={tab.id} className="flex flex-col gap-1">
      <TabRow tab={tab} depth={depth} workspace={workspace} onNewTab={onNewTab} onPicked={onPicked} />
      <TabBranch parentId={tab.id} depth={depth + 1} workspace={workspace} onNewTab={onNewTab} onPicked={onPicked} />
    </div>
  ));
}

type TabRowProps = Omit<TabBranchProps, "parentId"> & { tab: Tab };

function TabRow({ tab, depth, workspace, onNewTab, onPicked }: TabRowProps) {
  const { view } = workspace;
  const active = view.type === "tab" && view.id === tab.id;
  const color = resolveTabColor(workspace.tabs, tab.id);

  return (
    <div
      className={cn("group flex items-center", active ? "chamfer" : "rounded-md hover:bg-muted")}
      style={{
        marginLeft: depth * 14,
        ...(active ? { background: color, color: readableTextOn(color) } : {}),
      }}
    >
      <button
        aria-current={active ? "page" : undefined}
        className="focus-inset flex min-h-9 min-w-0 flex-1 items-center gap-2 px-2 text-left text-sm"
        onClick={() => {
          workspace.setView({ type: "tab", id: tab.id });
          onPicked();
        }}
      >
        <TabIcon template={tab.template} className="size-4 shrink-0" style={active ? undefined : { color }} aria-hidden />
        <span className="truncate">{tab.title || "제목 없음"}</span>
      </button>
      <button
        aria-label={`${tab.title || "제목 없음"} 안에 하위 탭 만들기`}
        className="focus-inset flex size-9 shrink-0 items-center justify-center opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 md:opacity-0"
        onClick={() => onNewTab(tab.id)}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
