"use client";

import { useState } from "react";
import { useForm } from "@/hooks/use-form";
import { cn } from "@/lib/utils";
import { FormSettingsPanel } from "./form-settings-panel";
import { ResponsesPanel } from "./responses-panel";

const PANELS = [
  { id: "responses", label: "응답" },
  { id: "settings", label: "폼 설정" },
] as const;

type FormViewProps = { tabId: string; title: string; isAdmin: boolean };

export function FormView({ tabId, title, isAdmin }: FormViewProps) {
  const form = useForm(tabId, isAdmin);
  const [panel, setPanel] = useState<(typeof PANELS)[number]["id"]>("responses");
  if (!form.loaded) return <p className="px-6 text-muted-foreground">불러오는 중입니다.</p>;
  if (!form.settings) return <p className="px-6 text-muted-foreground">신청폼을 준비하는 중입니다. 잠시 후 새로고침해 주세요.</p>;

  return (
    <section className="flex flex-1 flex-col gap-4 px-3 pb-8 md:px-4">
      <nav aria-label="신청폼 메뉴" className="flex gap-1">
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
      {form.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {form.error}
        </p>
      )}
      {panel === "responses" && <ResponsesPanel form={form} title={title} />}
      {panel === "settings" && <FormSettingsPanel form={form} title={title} />}
    </section>
  );
}
