"use client";

import { CalendarDays, ClipboardList, FileText, Table2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewTabInput } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { DEFAULT_TAB_COLOR, type TabTemplate } from "@/lib/workspace";
import { ColorPicker } from "./color-picker";

const TEMPLATES: { value: TabTemplate; label: string; hint: string; icon: typeof FileText }[] = [
  { value: "note", label: "일반 노트", hint: "회의록과 메모", icon: FileText },
  { value: "calendar", label: "달력", hint: "날짜별 일정", icon: CalendarDays },
  { value: "timetable", label: "시간표", hint: "모두 비는 시간 찾기", icon: Table2 },
  { value: "capture", label: "캡처", hint: "신청과 조 편성", icon: ClipboardList },
];

type NewTabDialogProps = {
  parentId: string | null | undefined;
  isAdmin: boolean;
  onClose: () => void;
  onCreate: (input: NewTabInput) => void;
};

export function NewTabDialog({ parentId, isAdmin, onClose, onCreate }: NewTabDialogProps) {
  return (
    <Dialog open={parentId !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {parentId !== undefined && (
          <NewTabForm parentId={parentId} isAdmin={isAdmin} onClose={onClose} onCreate={onCreate} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type NewTabFormProps = Omit<NewTabDialogProps, "parentId"> & { parentId: string | null };

function NewTabForm({ parentId, isAdmin, onClose, onCreate }: NewTabFormProps) {
  // 캡처 탭은 개인정보를 다루므로 관리자만 만든다.
  const templates = TEMPLATES.filter((item) => item.value !== "capture" || isAdmin);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<TabTemplate>("note");
  const [color, setColor] = useState<string | null>(parentId ? null : "#1971c2");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("탭 이름을 입력하세요.");
      return;
    }
    onCreate({ parentId, title: title.trim(), template, color });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{parentId ? "하위 탭 만들기" : "새 탭 만들기"}</DialogTitle>
        <DialogDescription>탭 이름과 템플릿, 색을 고르세요.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-tab-title">탭 이름</Label>
        <Input
          id="new-tab-title"
          value={title}
          placeholder="11월 회의록"
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setTitle(event.target.value);
            setError("");
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">템플릿</legend>
        <div className="grid grid-cols-2 gap-2">
          {templates.map(({ value, label, hint, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-md border p-3 has-focus-visible:ring-2 has-focus-visible:ring-ring",
                template === value && "border-foreground bg-muted",
              )}
            >
              <input
                type="radio"
                name="template"
                className="sr-only"
                checked={template === value}
                onChange={() => setTemplate(value)}
              />
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4" aria-hidden />
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">탭 색상</span>
        <ColorPicker
          id="new-tab-color"
          value={color}
          fallback={DEFAULT_TAB_COLOR}
          fallbackLabel={parentId ? "상위 탭 색 따르기" : undefined}
          onChange={setColor}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" className="chamfer rounded-none">
          만들기
        </Button>
      </DialogFooter>
    </form>
  );
}
