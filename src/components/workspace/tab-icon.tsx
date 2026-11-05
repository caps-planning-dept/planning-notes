import { CalendarDays, ClipboardList, FileText, type LucideProps } from "lucide-react";
import type { TabTemplate } from "@/lib/workspace";

export function TabIcon({ template, ...props }: LucideProps & { template: TabTemplate }) {
  if (template === "calendar") return <CalendarDays {...props} />;
  if (template === "capture") return <ClipboardList {...props} />;
  return <FileText {...props} />;
}

export const TEMPLATE_LABELS: Record<TabTemplate, string> = {
  note: "일반 노트",
  calendar: "달력",
  capture: "캡처",
};
