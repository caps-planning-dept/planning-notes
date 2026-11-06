"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/hooks/use-workspace";
import { type CalendarEvent, dayCountLabel, toDateKey, upcomingEvents } from "@/lib/calendar";
import { resolveTabColor, visibleChildren } from "@/lib/workspace";
import symbol from "../../../assets/logo/caps-symbol-on-black.png";
import { TabIcon } from "./tab-icon";

const TAB_LIMIT = 6;
const EVENT_LIMIT = 5;

const fullDate = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" });
const shortDate = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" });

function dateText(event: CalendarEvent) {
  const date = shortDate.format(new Date(`${event.startDate}T00:00:00`));
  return event.time ? `${date} ${event.time}` : date;
}

type HomeViewProps = {
  workspace: Workspace;
  userId: string;
  onNewTab: (parentId: string | null) => void;
};

export function HomeView({ workspace, userId, onNewTab }: HomeViewProps) {
  const [now] = useState(() => new Date());
  const today = toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const myName = workspace.members.find((member) => member.userId === userId)?.displayName;

  const rootTabs = visibleChildren(workspace.tabs, null);
  const liveTabIds = new Set(workspace.tabs.filter((tab) => tab.deletedAt === null).map((tab) => tab.id));
  const events = upcomingEvents(
    workspace.events.filter((event) => liveTabIds.has(event.tabId)),
    today,
  );
  const nextEvent = events[0];
  const openTab = (id: string) => workspace.setView({ type: "tab", id });

  return (
    <div className="@container flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="chamfer-lg sheen relative m-3 flex shrink-0 flex-col gap-5 overflow-hidden bg-foreground px-6 py-7 text-background motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] md:m-4 md:px-10 md:py-9">
        {/* 로고 파일의 검은 배경을 밝게 섞어 지우고, 심볼은 글자를 방해하지 않게 은은하게 둔다. */}
        <Image
          src={symbol}
          alt=""
          priority
          sizes="(min-width: 768px) 288px, 112px"
          className="pointer-events-none absolute -top-4 -right-8 h-28 w-auto opacity-30 mix-blend-screen @3xl:top-1/2 @3xl:right-6 @3xl:h-64 @3xl:-translate-y-1/2 @3xl:opacity-45"
        />
        <div className="relative flex flex-col gap-2">
          <h1 className="font-display text-4xl leading-tight md:text-5xl">CAPS 기획부</h1>
          <p className="opacity-75 md:text-lg">
            {myName ? `${myName} 님, ` : ""}오늘은 {fullDate.format(now)}입니다.
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-3">
          {nextEvent ? (
            <button
              className="focus-inset flex min-h-11 min-w-0 items-center gap-3 rounded-lg bg-white/10 px-4 py-2 text-left ring-1 ring-white/10 ring-inset transition duration-300 ease-soft hover:bg-white/15 active:scale-[0.98]"
              onClick={() => openTab(nextEvent.tabId)}
            >
              <span className="shrink-0 font-semibold">{dayCountLabel(nextEvent.startDate, today)}</span>
              <span className="min-w-0 text-sm opacity-90">
                {nextEvent.title || "제목 없는 일정"} · {dateText(nextEvent)}
              </span>
            </button>
          ) : (
            <p className="rounded-lg bg-white/10 px-4 py-2.5 text-sm ring-1 ring-white/10 ring-inset">다가오는 일정이 없습니다.</p>
          )}
          <Button
            className="chamfer h-11 rounded-none bg-background px-4 text-foreground transition duration-300 ease-soft hover:bg-muted active:scale-[0.98]"
            onClick={() => onNewTab(null)}
          >
            <Plus data-icon="inline-start" />새 탭 만들기
          </Button>
        </div>
      </header>

      <div className="grid w-full max-w-5xl gap-10 px-4 pt-6 pb-16 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-700 motion-safe:ease-soft md:grid-cols-2 md:gap-14 md:px-12">
        <section aria-labelledby="home-tabs" className="flex min-w-0 flex-col gap-2">
          <h2 id="home-tabs" className="border-b border-border/70 px-2 pb-2 text-sm font-medium text-muted-foreground">
            바로가기
          </h2>
          {rootTabs.length === 0 && (
            <p className="rounded-xl bg-secondary px-4 py-6 text-sm text-muted-foreground">아직 탭이 없습니다. 회의록이나 달력으로 시작해 보세요.</p>
          )}
          <ul className="flex flex-col">
            {rootTabs.slice(0, TAB_LIMIT).map((tab) => (
              <li key={tab.id}>
                <button
                  className="focus-inset flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors duration-200 ease-soft hover:bg-secondary"
                  onClick={() => openTab(tab.id)}
                >
                  <TabIcon
                    template={tab.template}
                    className="size-5 shrink-0"
                    style={{ color: resolveTabColor(workspace.tabs, tab.id) }}
                    aria-hidden
                  />
                  <span className="truncate">{tab.title || "제목 없음"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-events" className="flex min-w-0 flex-col gap-2">
          <h2 id="home-events" className="border-b border-border/70 px-2 pb-2 text-sm font-medium text-muted-foreground">
            다가오는 일정
          </h2>
          {events.length === 0 && (
            <p className="rounded-xl bg-secondary px-4 py-6 text-sm text-muted-foreground">
              등록된 일정이 없습니다. 달력 탭에서 일정을 추가하면 여기에 모입니다.
            </p>
          )}
          <ul className="flex flex-col">
            {events.slice(0, EVENT_LIMIT).map((event) => (
              <li key={event.id}>
                <button
                  className="focus-inset flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors duration-200 ease-soft hover:bg-secondary"
                  onClick={() => openTab(event.tabId)}
                >
                  <span className="w-12 shrink-0 font-medium tabular-nums">{dayCountLabel(event.startDate, today)}</span>
                  <span className="min-w-0 flex-1 truncate">{event.title || "제목 없는 일정"}</span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{dateText(event)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
