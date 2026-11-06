"use client";

import { FolderInput, Palette, Trash2 } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { CaptureView } from "@/components/capture/capture-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Workspace } from "@/hooks/use-workspace";
import { readableTextOn } from "@/lib/color";
import { DEFAULT_TAB_COLOR, resolveTabColor, type Tab } from "@/lib/workspace";
import { CalendarView } from "./calendar-view";
import { ColorPicker } from "./color-picker";
import { MoveTabDialog } from "./move-tab-dialog";
import { NoteEditor } from "./note-editor";
import { TEMPLATE_LABELS } from "./tab-icon";
import { TabStrip } from "./tab-strip";

type TabPageProps = {
  tab: Tab;
  workspace: Workspace;
  userId: string;
  isAdmin: boolean;
  onNewTab: (parentId: string) => void;
};

export function TabPage({ tab, workspace, userId, isAdmin, onNewTab }: TabPageProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const color = resolveTabColor(workspace.tabs, tab.id);
  const onColor = readableTextOn(color);
  const tabStyle = { "--tab": color, "--on-tab": onColor } as CSSProperties;
  const inherited = tab.parentId ? resolveTabColor(workspace.tabs, tab.parentId) : DEFAULT_TAB_COLOR;

  return (
    <div style={tabStyle} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="chamfer-lg m-3 flex shrink-0 flex-col gap-4 bg-(--tab) px-6 py-5 text-(--on-tab) md:m-4 md:px-10 md:py-7">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>{TEMPLATE_LABELS[tab.template]}</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="탭 색상 바꾸기"
              className="text-inherit hover:bg-white/20 hover:text-inherit"
              onClick={() => setColorOpen(true)}
            >
              <Palette />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="탭 위치 옮기기"
              title="탭 위치 옮기기"
              className="text-inherit hover:bg-white/20 hover:text-inherit"
              onClick={() => setMoveOpen(true)}
            >
              <FolderInput />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="탭을 휴지통으로 옮기기"
              className="text-inherit hover:bg-white/20 hover:text-inherit"
              onClick={() => workspace.trashTab(tab.id)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
        <input
          aria-label="탭 이름"
          value={tab.title}
          placeholder="제목 없음"
          className="w-full bg-transparent font-display text-4xl leading-tight underline-offset-8 outline-none focus-visible:underline placeholder:text-current placeholder:opacity-60 md:text-5xl"
          onChange={(event) => workspace.updateTab(tab.id, { title: event.target.value })}
        />
      </header>

      <TabStrip tab={tab} workspace={workspace} onNewTab={onNewTab} />

      {tab.template === "note" && (
        <NoteEditor
          tabId={tab.id}
          userId={userId}
          content={workspace.notes[tab.id]}
          members={workspace.members}
          tabs={workspace.tabs}
          onChange={(content) => workspace.saveNote(tab.id, content)}
          onOpenTab={(id) => {
            if (!workspace.tabs.some((item) => item.id === id && item.deletedAt === null)) return false;
            workspace.setView({ type: "tab", id });
            return true;
          }}
        />
      )}
      {tab.template === "calendar" && <CalendarView tab={tab} color={color} workspace={workspace} />}
      {tab.template === "capture" && (
        <CaptureView tabId={tab.id} title={tab.title} members={workspace.members} userId={userId} isAdmin={isAdmin} />
      )}

      <MoveTabDialog tab={tab} workspace={workspace} open={moveOpen} onClose={() => setMoveOpen(false)} />

      <Dialog open={colorOpen} onOpenChange={setColorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>탭 색상</DialogTitle>
            <DialogDescription>모든 멤버에게 같은 색으로 보입니다.</DialogDescription>
          </DialogHeader>
          <ColorPicker
            id="tab-color"
            value={tab.color}
            fallback={inherited}
            fallbackLabel={tab.parentId ? "상위 탭 색 따르기" : undefined}
            onChange={(next) => workspace.updateTab(tab.id, { color: next })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
