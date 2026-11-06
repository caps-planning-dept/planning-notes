"use client";

import { CornerLeftUp } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Workspace } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { moveTargets, resolveTabColor, type Tab } from "@/lib/workspace";
import { TabIcon } from "./tab-icon";

type MoveTabDialogProps = {
  tab: Tab;
  workspace: Workspace;
  open: boolean;
  onClose: () => void;
};

export function MoveTabDialog({ tab, workspace, open, onClose }: MoveTabDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>{open && <MoveTabForm tab={tab} workspace={workspace} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

const ROOT = "root";

function MoveTabForm({ tab, workspace, onClose }: Omit<MoveTabDialogProps, "open">) {
  const current = tab.parentId ?? ROOT;
  const [picked, setPicked] = useState(current);
  const targets = moveTargets(workspace.tabs, tab.id);
  const title = tab.title || "제목 없음";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (picked !== current) workspace.moveTab(tab.id, picked === ROOT ? null : picked);
    onClose();
  }

  const option = (value: string, label: string, icon: ReactNode, depth: number) => (
    <label
      key={value}
      style={{ paddingLeft: 8 + depth * 16 }}
      className={cn(
        "flex min-h-10 cursor-pointer items-center gap-2 rounded-md pr-2 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring",
        picked === value ? "bg-muted font-medium" : "hover:bg-muted/60",
      )}
    >
      <input
        type="radio"
        name="move-target"
        className="sr-only"
        checked={picked === value}
        onChange={() => setPicked(value)}
      />
      {icon}
      <span className="truncate">{label}</span>
      {value === current && <span className="ml-auto shrink-0 text-xs text-muted-foreground">지금 위치</span>}
    </label>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>탭 옮기기</DialogTitle>
        <DialogDescription>
          {title} 탭을 어디로 옮길지 고르세요. 안에 있는 하위 탭도 함께 옮겨집니다.
        </DialogDescription>
      </DialogHeader>
      <fieldset className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
        <legend className="sr-only">옮길 위치</legend>
        {option(ROOT, "최상위 탭으로", <CornerLeftUp className="size-4 shrink-0" aria-hidden />, 0)}
        {targets.map(({ tab: target, depth }) =>
          option(
            target.id,
            `${target.title || "제목 없음"} 안으로`,
            <TabIcon
              template={target.template}
              className="size-4 shrink-0"
              style={{ color: resolveTabColor(workspace.tabs, target.id) }}
              aria-hidden
            />,
            depth + 1,
          ),
        )}
      </fieldset>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" className="chamfer rounded-none" disabled={picked === current}>
          옮기기
        </Button>
      </DialogFooter>
    </form>
  );
}
