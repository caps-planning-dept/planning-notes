"use client";

import { useState } from "react";
import { type Capture, useCapture } from "@/hooks/use-capture";
import type { Member } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { ApplicationsPanel } from "./applications-panel";
import { SettingsPanel } from "./settings-panel";
import { TeamsPanel } from "./teams-panel";

const PANELS = [
  { id: "applications", label: "신청 현황" },
  { id: "teams", label: "조 편성" },
  { id: "settings", label: "설정" },
] as const;

type CaptureViewProps = { tabId: string; title: string; members: Member[]; userId: string; isAdmin: boolean };

export function CaptureView({ tabId, title, members, userId, isAdmin }: CaptureViewProps) {
  const capture = useCapture(tabId, isAdmin);
  if (!capture.loaded) return <p className="px-6 text-muted-foreground">불러오는 중입니다.</p>;
  if (!capture.round) return <p className="px-6 text-muted-foreground">회차를 준비하는 중입니다. 잠시 후 새로고침해 주세요.</p>;
  return <CapturePanels capture={capture} title={title} members={members} userId={userId} />;
}

type CapturePanelsProps = { capture: Capture; title: string; members: Member[]; userId: string };

export function CapturePanels({ capture, title, members, userId }: CapturePanelsProps) {
  const [panel, setPanel] = useState<(typeof PANELS)[number]["id"]>("applications");

  return (
    <section className="flex flex-1 flex-col gap-4 px-3 pb-8 md:px-4">
      <nav aria-label="캡처 메뉴" className="flex gap-1">
        {PANELS.map((item) => (
          <button
            key={item.id}
            aria-current={panel === item.id ? "page" : undefined}
            className={cn(
              "focus-inset min-h-9 rounded-md px-3 text-sm",
              panel === item.id ? "bg-foreground font-medium text-background" : "hover:bg-muted",
            )}
            onClick={() => setPanel(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {capture.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {capture.error}
        </p>
      )}
      {panel === "applications" && <ApplicationsPanel capture={capture} />}
      {panel === "teams" && <TeamsPanel capture={capture} title={title} />}
      {panel === "settings" && <SettingsPanel capture={capture} title={title} members={members} userId={userId} />}
    </section>
  );
}
