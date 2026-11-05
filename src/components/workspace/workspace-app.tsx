"use client";

import { Menu, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { InquiriesView } from "./inquiries-view";
import { MembersView } from "./members-view";
import { NewTabDialog } from "./new-tab-dialog";
import { Sidebar } from "./sidebar";
import { TabPage } from "./tab-page";
import { TrashView } from "./trash-view";

type WorkspaceAppProps = { workspaceId: string; userId: string; isAdmin: boolean };

export function WorkspaceApp({ workspaceId, userId, isAdmin }: WorkspaceAppProps) {
  const workspace = useWorkspace(workspaceId, userId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newTabParent, setNewTabParent] = useState<string | null | undefined>(undefined);
  const { view } = workspace;
  const activeTab =
    view.type === "tab" ? workspace.tabs.find((tab) => tab.id === view.id) : undefined;
  const showEmpty = workspace.loaded && !activeTab && (view.type === "tab" || view.type === "empty");

  return (
    <div className="flex h-full min-h-0">
      <Sidebar
        workspace={workspace}
        userId={userId}
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
        {workspace.syncError && (
          <p role="alert" className="bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {workspace.syncError}
          </p>
        )}
        {!workspace.loaded && <p className="m-auto text-muted-foreground">불러오는 중입니다.</p>}
        {workspace.loaded && view.type === "trash" && <TrashView workspace={workspace} />}
        {workspace.loaded && view.type === "members" && (
          <MembersView workspace={workspace} workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} />
        )}
        {workspace.loaded && view.type === "inquiries" && (
          <InquiriesView workspaceId={workspaceId} members={workspace.members} isAdmin={isAdmin} />
        )}
        {workspace.loaded && activeTab && (
          <TabPage
            key={activeTab.id}
            tab={activeTab}
            workspace={workspace}
            userId={userId}
            isAdmin={isAdmin}
            onNewTab={setNewTabParent}
          />
        )}
        {showEmpty && (
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
        isAdmin={isAdmin}
        onClose={() => setNewTabParent(undefined)}
        onCreate={workspace.createTab}
      />
    </div>
  );
}
