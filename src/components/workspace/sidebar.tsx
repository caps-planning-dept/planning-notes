"use client";

import { MessageSquareText, Pin, PinOff, Plus, Trash2, UserPen, Users, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/hooks/use-workspace";
import { readableTextOn } from "@/lib/color";
import { cn } from "@/lib/utils";
import { resolveTabColor, type Tab, trashedRoots, visibleChildren } from "@/lib/workspace";
import logo from "../../../assets/logo/caps-lockup-on-white.png";
import { NameDialog } from "./name-dialog";
import { usePreloadNote } from "./note-connection";
import { TabIcon } from "./tab-icon";

// 아래쪽 메뉴는 탭 목록보다 한 단계 연하게 두어 시선이 탭에 먼저 가게 한다.
const NAV_ITEM = "justify-start font-normal text-muted-foreground hover:text-foreground";
const NAV_ACTIVE = "bg-muted font-medium text-foreground";

type SidebarProps = {
  workspace: Workspace;
  userId: string;
  open: boolean;
  onClose: () => void;
  onNewTab: (parentId: string | null) => void;
};

export function Sidebar({ workspace, userId, open, onClose, onNewTab }: SidebarProps) {
  const [nameOpen, setNameOpen] = useState(false);
  const trashCount = trashedRoots(workspace.tabs).length;
  const trashActive = workspace.view.type === "trash";
  const membersActive = workspace.view.type === "members";
  const inquiriesActive = workspace.view.type === "inquiries";
  const myName = workspace.members.find((member) => member.userId === userId)?.displayName ?? "";

  return (
    <>
      {open && (
        <button
          aria-label="탭 목록 닫기"
          className="fixed inset-0 z-30 bg-[#2b2a27]/25 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col gap-3 bg-sidebar p-3 shadow-float transition-transform duration-300 ease-soft motion-reduce:transition-none md:static md:translate-x-0 md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-1 pt-1">
          <button
            aria-label="첫 화면으로 가기"
            aria-current={workspace.view.type === "home" ? "page" : undefined}
            className="focus-inset rounded-md"
            onClick={() => {
              workspace.setView({ type: "home" });
              onClose();
            }}
          >
            <Image src={logo} alt="" priority className="h-9 w-auto mix-blend-multiply" />
          </button>
          <Button variant="ghost" size="icon" aria-label="탭 목록 닫기" className="md:hidden" onClick={onClose}>
            <X />
          </Button>
        </div>
        <Button variant="outline" className="chamfer justify-start rounded-none border-0 bg-background text-foreground shadow-soft hover:bg-background hover:text-foreground hover:shadow-float" onClick={() => onNewTab(null)}>
          <Plus data-icon="inline-start" />새 탭
        </Button>
        <p aria-hidden className="mt-1 px-2 text-xs font-medium text-muted-foreground">탭</p>
        <nav aria-label="탭 목록" className="-mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          <TabBranch parentId={null} depth={0} workspace={workspace} onNewTab={onNewTab} onPicked={onClose} />
        </nav>
        <div aria-hidden className="mx-2 h-px bg-border" />
        <div className="flex flex-col gap-0.5">
        <Button
          variant="ghost"
          aria-current={membersActive ? "page" : undefined}
          className={cn(NAV_ITEM, membersActive && NAV_ACTIVE)}
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
          className={cn(NAV_ITEM, trashActive && NAV_ACTIVE)}
          onClick={() => {
            workspace.setView({ type: "trash" });
            onClose();
          }}
        >
          <Trash2 data-icon="inline-start" />
          휴지통{trashCount > 0 && ` (${trashCount})`}
        </Button>
        <Button
          variant="ghost"
          aria-current={inquiriesActive ? "page" : undefined}
          className={cn(NAV_ITEM, inquiriesActive && NAV_ACTIVE)}
          onClick={() => {
            workspace.setView({ type: "inquiries" });
            onClose();
          }}
        >
          <MessageSquareText data-icon="inline-start" />
          문의
        </Button>
        <Button
          variant="ghost"
          aria-label={`이름 설정, 현재 이름 ${myName}`}
          className={NAV_ITEM}
          onClick={() => setNameOpen(true)}
        >
          <UserPen data-icon="inline-start" />
          <span className="truncate">{myName || "이름 설정"}</span>
        </Button>
        <SignOutButton />
        </div>
      </aside>
      <NameDialog
        open={nameOpen}
        name={myName}
        onClose={() => setNameOpen(false)}
        onSave={workspace.updateDisplayName}
      />
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
  const pinned = tab.pinnedAt !== null;
  const preloadNote = usePreloadNote();
  // 노트는 누르기 전에 미리 연결해 두어 빨리 열리게 한다.
  const preload = tab.template === "note" && !active ? () => preloadNote(tab.id) : undefined;

  return (
    <div
      className={cn(
        "group flex items-center transition-colors duration-200 ease-soft",
        active ? "chamfer shadow-soft" : "rounded-md hover:bg-muted",
      )}
      style={{
        marginLeft: depth * 14,
        ...(active ? { background: color, color: readableTextOn(color) } : {}),
      }}
    >
      <button
        aria-current={active ? "page" : undefined}
        className={cn("focus-inset flex min-h-9 min-w-0 flex-1 items-center gap-2.5 px-2 text-left text-sm", active && "font-medium")}
        onPointerEnter={preload}
        onFocus={preload}
        onClick={() => {
          workspace.setView({ type: "tab", id: tab.id });
          onPicked();
        }}
      >
        <TabIcon template={tab.template} className="size-4 shrink-0" style={active ? undefined : { color }} aria-hidden />
        <span className="truncate">{tab.title || "제목 없음"}</span>
        {pinned && <Pin className="size-3 shrink-0 group-focus-within:hidden group-hover:hidden" aria-label="고정됨" />}
      </button>
      {depth === 0 && (
        <button
          aria-label={`${tab.title || "제목 없음"} ${pinned ? "고정 해제" : "맨 위에 고정"}`}
          aria-pressed={pinned}
          title={pinned ? "고정 해제" : "맨 위에 고정"}
          className="focus-inset flex size-9 shrink-0 items-center justify-center opacity-70 transition-opacity duration-200 ease-soft group-focus-within:opacity-100 group-hover:opacity-100 hover:opacity-100 md:opacity-0"
          onClick={() => workspace.setTabPinned(tab.id, !pinned)}
        >
          {pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
        </button>
      )}
      <button
        aria-label={`${tab.title || "제목 없음"} 안에 하위 탭 만들기`}
        className="focus-inset flex size-9 shrink-0 items-center justify-center opacity-70 transition-opacity duration-200 ease-soft group-focus-within:opacity-100 group-hover:opacity-100 hover:opacity-100 md:opacity-0"
        onClick={() => onNewTab(tab.id)}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
