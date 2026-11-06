"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { purgeSummary, type Tab, TRASH_RETENTION_MS, trashedRoots } from "@/lib/workspace";

const DAY = 24 * 60 * 60 * 1000;

type TrashViewProps = { workspace: Workspace; isAdmin: boolean };

export function TrashView({ workspace, isAdmin }: TrashViewProps) {
  const items = trashedRoots(workspace.tabs);
  const [now] = useState(() => Date.now());
  const [purging, setPurging] = useState<Tab | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const summary = purging ? purgeSummary(workspace.tabs, purging.id) : null;

  async function purge() {
    if (!purging) return;
    setBusy(true);
    setError("");
    const succeeded = await workspace.purgeTab(purging.id);
    setBusy(false);
    setPurging(null);
    if (!succeeded) setError("영구 삭제하지 못했습니다. 새로고침 후 다시 시도해 주세요.");
  }

  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-4 overflow-y-auto p-6">
      <h1 className="font-display text-4xl">휴지통</h1>
      <p className="text-muted-foreground">삭제한 탭은 30일 동안 보관한 뒤 자동으로 지워집니다.</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {items.length === 0 && <p className="py-8 text-center text-muted-foreground">휴지통이 비어 있습니다.</p>}
      <ul className="flex flex-col divide-y border-y">
        {items.map((tab) => {
          const left = Math.ceil(((tab.deletedAt ?? 0) + TRASH_RETENTION_MS - now) / DAY);
          return (
            <li key={tab.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{tab.title || "제목 없음"}</p>
                <p className="text-sm text-muted-foreground">{left}일 후 삭제</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => workspace.restoreTab(tab.id)}>
                  <RotateCcw data-icon="inline-start" />
                  복구
                </Button>
                {isAdmin && (
                  <Button variant="outline" onClick={() => setPurging(tab)}>
                    <Trash2 data-icon="inline-start" />
                    영구 삭제
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={purging !== null} onOpenChange={(open) => !open && !busy && setPurging(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 탭을 영구 삭제할까요?</DialogTitle>
            <DialogDescription>
              {purging?.title || "제목 없음"} · 삭제하면 되돌릴 수 없습니다.
              {summary && summary.descendants > 0 && ` 하위 탭 ${summary.descendants}개도 함께 지워집니다.`}
              {summary?.hasCapture && " 신청 내용도 함께 지워집니다."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setPurging(null)}>
              취소
            </Button>
            <Button variant="destructive" disabled={busy} onClick={purge}>
              영구 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
