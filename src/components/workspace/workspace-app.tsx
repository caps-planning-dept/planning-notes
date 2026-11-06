"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { HomeView } from "./home-view";
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
    view.type === "tab" ? workspace.tabs.find((tab) => tab.id === view.id && tab.deletedAt === null) : undefined;

  return (
    <div className="flex h-full min-h-0">
      <a
        href="#main"
        className="sr-only z-50 bg-background p-3 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2"
      >
        본문으로 건너뛰기
      </a>
      <Sidebar
        workspace={workspace}
        userId={userId}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNewTab={setNewTabParent}
      />
      <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
        <div className="flex items-center gap-2 border-b p-2 md:hidden">
          <Button variant="ghost" size="icon" aria-label="탭 목록 열기" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <button className="focus-inset min-h-11 font-medium" onClick={() => workspace.setView({ type: "home" })}>
            CAPS 기획부
          </button>
        </div>
        {workspace.syncError && (
          <p role="alert" className="bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {workspace.syncError}
          </p>
        )}
        {!workspace.loaded && <p className="m-auto text-muted-foreground">불러오는 중입니다.</p>}
        {workspace.loaded && view.type === "trash" && <TrashView workspace={workspace} isAdmin={isAdmin} />}
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
        {workspace.loaded && view.type === "home" && (
          <HomeView workspace={workspace} userId={userId} onNewTab={setNewTabParent} />
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
