"use client";

import { Menu, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { NewTabDialog } from "./new-tab-dialog";
import { Sidebar } from "./sidebar";
import { TabPage } from "./tab-page";
import { TrashView } from "./trash-view";

export function WorkspaceApp() {
  const workspace = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newTabParent, setNewTabParent] = useState<string | null | undefined>(undefined);
  const { view } = workspace;
  const activeTab =
    view.type === "tab" ? workspace.tabs.find((tab) => tab.id === view.id) : undefined;

  return (
    <div className="flex h-full min-h-0">
      <Sidebar
        workspace={workspace}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNewTab={setNewTabParent}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b p-2 md:hidden">
          <Button variant="ghost" size="icon" aria-label="탭 목록 열기" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <span className="font-medium">CAPS 기획부</span>
        </div>
        {view.type === "trash" && <TrashView workspace={workspace} />}
        {activeTab && (
          <TabPage key={activeTab.id} tab={activeTab} workspace={workspace} onNewTab={setNewTabParent} />
        )}
        {!activeTab && view.type !== "trash" && (
          <div className="m-auto flex flex-col items-center gap-3 p-6 text-center">
            <h1 className="font-display text-3xl">첫 탭을 만들어 보세요</h1>
            <p className="text-muted-foreground">회의록이나 달력으로 시작할 수 있습니다.</p>
            <Button className="chamfer rounded-none" onClick={() => setNewTabParent(null)}>
              <Plus data-icon="inline-start" />새 탭 만들기
            </Button>
          </div>
        )}
      </main>
      <NewTabDialog
        parentId={newTabParent}
        onClose={() => setNewTabParent(undefined)}
        onCreate={workspace.createTab}
      />
    </div>
  );
}
