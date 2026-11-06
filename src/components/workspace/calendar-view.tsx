"use client";

import { ChevronLeft, ChevronRight, Link2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/hooks/use-workspace";
import {
  type CalendarEvent,
  type EventSegment,
  monthCells,
  splitWeeks,
  toDateKey,
  weekSegments,
} from "@/lib/calendar";
import { readableTextOn } from "@/lib/color";
import { cn } from "@/lib/utils";
import type { Tab } from "@/lib/workspace";
import { EventDialog } from "./event-dialog";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type CalendarViewProps = { tab: Tab; color: string; workspace: Workspace };
type Editing = { event: CalendarEvent | null; date: string };

export function CalendarView({ tab, color, workspace }: CalendarViewProps) {
  const now = new Date();
  const today = toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const events = workspace.events.filter((event) => event.tabId === tab.id);

  function moveMonth(delta: number) {
    const next = new Date(month.year, month.month - 1 + delta, 1);
    setMonth({ year: next.getFullYear(), month: next.getMonth() + 1 });
  }

  return (
    <section className="flex flex-1 flex-col gap-3 px-3 pb-6 md:px-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="이전 달" onClick={() => moveMonth(-1)}>
            <ChevronLeft />
          </Button>
          <h2 className="min-w-32 text-center font-display text-2xl tabular-nums" aria-live="polite">
            {month.year}.{String(month.month).padStart(2, "0")}
          </h2>
          <Button variant="ghost" size="icon" aria-label="다음 달" onClick={() => moveMonth(1)}>
            <ChevronRight />
          </Button>
        </div>
        <Button
          className="chamfer rounded-none bg-(--tab) text-(--on-tab) hover:bg-(--tab)/85"
          onClick={() => setEditing({ event: null, date: today })}
        >
          <Plus data-icon="inline-start" />
          일정 추가
        </Button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-px overflow-hidden rounded-xl border border-border/80 bg-border/80 shadow-soft">
        {splitWeeks(monthCells(month.year, month.month)).map((week, weekIndex) => (
          <div key={weekIndex} className="relative min-h-22 flex-1">
            <div aria-hidden className="absolute inset-0 grid grid-cols-7 gap-px">
              {week.map((date, column) => (
                <div key={column} className={date ? "bg-background" : "bg-secondary/70"} />
              ))}
            </div>
            <div className="relative grid grid-cols-7 gap-x-px gap-y-1 pb-1">
              {week.map((date, column) =>
                date ? (
                  <button
                    key={date}
                    aria-label={`${date} 일정 추가`}
                    style={{ gridColumn: column + 1, gridRow: 1 }}
                    className={cn(
                      "focus-inset m-1 flex size-7 items-center justify-center rounded-md text-sm tabular-nums transition-colors duration-200 ease-soft hover:bg-muted",
                      date === today && "bg-(--tab) font-semibold text-(--on-tab) shadow-soft hover:bg-(--tab)",
                    )}
                    onClick={() => setEditing({ event: null, date })}
                  >
                    {Number(date.slice(8))}
                  </button>
                ) : null,
              )}
              {weekSegments(events, week).map((segment) => (
                <EventBar
                  key={segment.event.id}
                  segment={segment}
                  tabColor={color}
                  workspace={workspace}
                  onEdit={(event) => setEditing({ event, date: event.startDate })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EventDialog
          key={editing.event?.id ?? editing.date}
          tab={tab}
          tabColor={color}
          date={editing.date}
          event={editing.event}
          workspace={workspace}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

type EventBarProps = {
  segment: EventSegment;
  tabColor: string;
  workspace: Workspace;
  onEdit: (event: CalendarEvent) => void;
};

function EventBar({ segment, tabColor, workspace, onEdit }: EventBarProps) {
  const { event, lane, startColumn, span, continuesBefore, continuesAfter } = segment;
  const background = event.color ?? tabColor;
  const linkedTab = workspace.tabs.find(
    (item) => item.id === event.linkedTabId && item.deletedAt === null,
  );
  const label = `${event.time && `${event.time} `}${event.title}`;

  return (
    <div
      className={cn(
        "group relative flex min-w-0 items-center text-xs font-medium transition-[filter] duration-200 ease-soft hover:brightness-95",
        continuesBefore ? "ml-0" : "ml-1 rounded-l-sm",
        continuesAfter ? "mr-0" : "mr-1 rounded-r-sm",
      )}
      style={{
        gridColumn: `${startColumn + 1} / span ${span}`,
        gridRow: lane + 2,
        background,
        color: readableTextOn(background),
      }}
    >
      <button
        title={label}
        aria-label={linkedTab ? `${label}, ${linkedTab.title || "제목 없음"} 탭 열기` : `${label} 일정 수정`}
        className="focus-inset flex min-h-6 min-w-0 flex-1 items-center gap-1 px-1.5 text-left"
        onClick={() =>
          linkedTab ? workspace.setView({ type: "tab", id: linkedTab.id }) : onEdit(event)
        }
      >
        {linkedTab && <Link2 className="size-3 shrink-0" aria-hidden />}
        <span className="truncate">{label}</span>
      </button>
      {linkedTab && (
        <button
          aria-label={`${event.title} 일정 수정`}
          className="focus-inset flex size-6 shrink-0 items-center justify-center group-focus-within:opacity-100 group-hover:opacity-100 md:absolute md:inset-y-0 md:right-0 md:h-auto md:rounded-r-sm md:opacity-0"
          style={{ background }}
          onClick={() => onEdit(event)}
        >
          <Pencil className="size-3" aria-hidden />
        </button>
      )}
    </div>
  );
}
