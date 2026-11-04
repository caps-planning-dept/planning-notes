"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/hooks/use-workspace";
import { TRASH_RETENTION_MS, trashedRoots } from "@/lib/workspace";

const DAY = 24 * 60 * 60 * 1000;

export function TrashView({ workspace }: { workspace: Workspace }) {
  const items = trashedRoots(workspace.tabs);
  const [now] = useState(() => Date.now());

  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-4 overflow-y-auto p-6">
      <h1 className="font-display text-4xl">휴지통</h1>
      <p className="text-muted-foreground">삭제한 탭은 30일 동안 보관한 뒤 자동으로 지워집니다.</p>
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
              <Button variant="outline" onClick={() => workspace.restoreTab(tab.id)}>
                <RotateCcw data-icon="inline-start" />
                복구
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
