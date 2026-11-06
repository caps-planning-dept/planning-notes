"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Workspace } from "@/hooks/use-workspace";
import type { CalendarEvent } from "@/lib/calendar";
import type { Tab } from "@/lib/workspace";
import { ColorPicker } from "./color-picker";
import { TEMPLATE_LABELS } from "./tab-icon";

type EventDialogProps = {
  tab: Tab;
  tabColor: string;
  date: string;
  event: CalendarEvent | null;
  workspace: Workspace;
  onClose: () => void;
};

export function EventDialog({ tab, tabColor, date, event, workspace, onClose }: EventDialogProps) {
  const [draft, setDraft] = useState<CalendarEvent>(
    event ?? {
      id: crypto.randomUUID(),
      tabId: tab.id,
      title: "",
      startDate: date,
      endDate: date,
      time: "",
      assignee: "",
      memo: "",
      color: null,
      linkedTabId: null,
    },
  );
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // 노트뿐 아니라 캡처, 다른 달력 탭도 연결할 수 있다. 지금 보고 있는 달력 자신은 뺀다.
  const linkableTabs = workspace.tabs.filter((item) => item.id !== tab.id && item.deletedAt === null);
  const edit = (change: Partial<CalendarEvent>) => {
    setDraft({ ...draft, ...change });
    setError("");
  };

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!draft.title.trim()) return setError("일정 제목을 입력하세요.");
    if (draft.endDate < draft.startDate) return setError("종료 날짜는 시작 날짜와 같거나 이후여야 합니다.");
    workspace.saveEvent({ ...draft, title: draft.title.trim() });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{event ? "일정 수정" : "일정 추가"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-title">제목</Label>
            <Input id="event-title" value={draft.title} placeholder="기획부 회의" onChange={(e) => edit({ title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-start">시작 날짜</Label>
              <Input id="event-start" type="date" value={draft.startDate} required onChange={(e) => edit({ startDate: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-end">종료 날짜</Label>
              <Input id="event-end" type="date" value={draft.endDate} required onChange={(e) => edit({ endDate: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-time">시간 (선택)</Label>
              <Input id="event-time" type="time" value={draft.time} onChange={(e) => edit({ time: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-assignee">담당자</Label>
              <Input id="event-assignee" value={draft.assignee} onChange={(e) => edit({ assignee: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-memo">메모</Label>
            <Textarea id="event-memo" value={draft.memo} onChange={(e) => edit({ memo: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-link">탭 연결</Label>
            <div className="flex gap-2">
              <select
                id="event-link"
                className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                value={draft.linkedTabId ?? ""}
                onChange={(e) => edit({ linkedTabId: e.target.value || null })}
              >
                <option value="">연결 안 함</option>
                {linkableTabs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title || "제목 없음"} · {TEMPLATE_LABELS[item.template]}
                  </option>
                ))}
              </select>
              {draft.linkedTabId && linkableTabs.some((item) => item.id === draft.linkedTabId) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => workspace.setView({ type: "tab", id: draft.linkedTabId as string })}
                >
                  열기
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">일정 색상</span>
            <ColorPicker
              id="event-color"
              value={draft.color}
              fallback={tabColor}
              fallbackLabel="탭 색 따르기"
              onChange={(color) => edit({ color })}
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            {event && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => {
                  // 일정은 휴지통 없이 바로 지워지므로 한 번 더 눌러야 삭제한다.
                  if (!confirmingDelete) return setConfirmingDelete(true);
                  workspace.deleteEvent(event.id);
                  onClose();
                }}
              >
                {confirmingDelete ? "한 번 더 누르면 삭제" : "삭제"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" className="chamfer rounded-none">
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
