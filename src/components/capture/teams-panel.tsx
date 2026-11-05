"use client";

import { toPng } from "html-to-image";
import { Check, Crown, Download, Info, Trash2, UserPlus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Capture } from "@/hooks/use-capture";
import {
  type Applicant,
  assignedDatesByStudent,
  type CaptureApplication,
  type CaptureFilter,
  DRINKING_OPTIONS,
  EMPTY_FILTER,
  filterApplicants,
  formatRoundDate,
  groupApplicants,
  numberTeams,
  OTHER_ACTIVITY,
  PARTICIPATION_OPTIONS,
  removeTeamMember,
  teamBoard,
} from "@/lib/capture";
import { cn } from "@/lib/utils";
import { TeamBoard } from "./team-board";

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type ChipGroupProps = {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
};

function ChipGroup({ label, options, selected, onChange }: ChipGroupProps) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="float-left mr-2 w-12 text-sm font-medium">{label}</legend>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(
              "focus-inset min-h-8 rounded-full border px-3 text-sm",
              active ? "border-(--tab) bg-(--tab) text-(--on-tab)" : "hover:bg-muted",
            )}
            onClick={() =>
              onChange(active ? selected.filter((value) => value !== option.value) : [...selected, option.value])
            }
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}

const plain = (values: string[]) => values.map((value) => ({ value, label: value }));

export function TeamsPanel({ capture, title }: { capture: Capture; title: string }) {
  const round = capture.round;
  const dates = useMemo(() => round?.dates ?? [], [round]);
  const [filter, setFilter] = useState<CaptureFilter>(EMPTY_FILTER);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [chosenDate, setChosenDate] = useState("");
  const [activity, setActivity] = useState("");
  const [note, setNote] = useState("");
  const [opened, setOpened] = useState<Applicant | null>(null);
  const [imageError, setImageError] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  const allApplicants = useMemo(() => groupApplicants(capture.applications), [capture.applications]);
  const filtered = useMemo(() => filterApplicants(allApplicants, filter), [allApplicants, filter]);
  const assigned = useMemo(() => assignedDatesByStudent(capture.teams, capture.applications), [capture.teams, capture.applications]);

  // 날짜 필터를 하나만 골랐다면 그 날짜를, 직접 고른 날짜가 있으면 그 날짜를 쓴다.
  const eventDate = dates.includes(chosenDate) ? chosenDate : (filter.dates[0] ?? dates[0] ?? "");
  const teamActivity = activity || filter.activities.find((item) => item !== OTHER_ACTIVITY) || "";

  const byApplicationId = useMemo(() => {
    const map = new Map<string, CaptureApplication>();
    capture.applications.forEach((item) => map.set(item.id, item));
    return map;
  }, [capture.applications]);
  const selectedPeople = selectedIds.flatMap((id) => byApplicationId.get(id) ?? []);
  const notApplied = selectedPeople.filter((person) => {
    const submissions = allApplicants.find((item) => item.studentId === person.studentId)?.applications ?? [];
    return !submissions.some((item) => item.dates.includes(eventDate));
  });

  const board = teamBoard(capture.teams, capture.applications);
  const nameOf = (id: string) => byApplicationId.get(id)?.name ?? "삭제된 신청";
  const dateTeams = numberTeams(capture.teams).filter((team) => team.eventDate === eventDate);

  function togglePerson(applicationId: string) {
    setSelectedIds((current) =>
      current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [...current, applicationId],
    );
  }

  function createTeam() {
    capture.addTeam(eventDate, teamActivity.trim(), selectedIds, note.trim());
    setSelectedIds([]);
    setNote("");
  }

  async function saveImage() {
    if (!tableRef.current) return;
    setImageError("");
    try {
      const dataUrl = await toPng(tableRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "캡처-조-편성표.png";
      link.click();
    } catch {
      setImageError("이미지를 만들지 못했습니다. 다시 시도해 주세요.");
    }
  }

  if (dates.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">설정에서 활동 날짜를 먼저 추가해 주세요.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-md border p-4">
        <ChipGroup
          label="날짜"
          options={dates.map((date) => ({ value: date, label: formatRoundDate(date) }))}
          selected={filter.dates}
          onChange={(values) => setFilter({ ...filter, dates: values })}
        />
        <ChipGroup
          label="활동"
          options={plain([...(round?.activities ?? []), OTHER_ACTIVITY])}
          selected={filter.activities}
          onChange={(values) => setFilter({ ...filter, activities: values })}
        />
        <ChipGroup
          label="횟수"
          options={plain(PARTICIPATION_OPTIONS)}
          selected={filter.participation}
          onChange={(values) => setFilter({ ...filter, participation: values })}
        />
        <ChipGroup
          label="음주"
          options={plain(DRINKING_OPTIONS)}
          selected={filter.drinking}
          onChange={(values) => setFilter({ ...filter, drinking: values })}
        />
      </div>

      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {allApplicants.length}명 중 {filtered.length}명 표시. 이름을 눌러 조에 넣을 사람을 고르세요.
        </p>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">조건에 맞는 신청자가 없습니다.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.map((applicant) => {
              const latest = applicant.applications[0];
              const isSelected = selectedIds.includes(latest.id);
              const assignedDates = assigned.get(applicant.studentId) ?? [];
              return (
                <li
                  key={applicant.studentId}
                  className={cn(
                    "flex items-stretch overflow-hidden rounded-md border",
                    isSelected && "border-(--tab) bg-(--tab) text-(--on-tab)",
                  )}
                >
                  <button
                    aria-pressed={isSelected}
                    className={cn("focus-inset flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3 text-left", !isSelected && "hover:bg-muted")}
                    onClick={() => togglePerson(latest.id)}
                  >
                    {isSelected && <Check className="size-4 shrink-0" aria-hidden />}
                    <span className="min-w-0">
                      <span className="block truncate">{applicant.name}</span>
                      {assignedDates.length > 0 && (
                        <span className="block text-xs opacity-80">{assignedDates.map(formatRoundDate).join(", ")} 배정</span>
                      )}
                    </span>
                    {applicant.applications.length > 1 && (
                      <span className="ml-auto shrink-0 text-xs opacity-80">{applicant.applications.length}건</span>
                    )}
                  </button>
                  <button
                    aria-label={`${applicant.name} 상세 정보`}
                    className={cn("focus-inset flex w-9 shrink-0 items-center justify-center", !isSelected && "hover:bg-muted")}
                    onClick={() => setOpened(applicant)}
                  >
                    <Info className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="조 만들기" className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-md border bg-background p-4">
        <div className="flex flex-wrap items-end gap-3">
          <p className="min-w-16 self-center font-medium" role="status">{selectedIds.length}명 선택</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            날짜
            <select className="h-9 rounded-md border bg-background px-2 font-normal" value={eventDate} onChange={(e) => setChosenDate(e.target.value)}>
              {dates.map((item) => (
                <option key={item} value={item}>{formatRoundDate(item)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            활동
            <input
              list="capture-activities"
              placeholder="예: 보드게임"
              className="h-9 rounded-md border bg-background px-2 font-normal placeholder:text-muted-foreground/70"
              value={teamActivity}
              onChange={(e) => setActivity(e.target.value)}
            />
            <datalist id="capture-activities">
              {round?.activities.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            메모 (선택)
            <input
              maxLength={50}
              placeholder="예: 음주 X"
              className="h-9 w-32 rounded-md border bg-background px-2 font-normal placeholder:text-muted-foreground/70"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <Button
            className="chamfer rounded-none"
            disabled={selectedIds.length === 0 || !teamActivity.trim()}
            onClick={createTeam}
          >
            <UserPlus data-icon="inline-start" />
            조 편성하기
          </Button>
          {selectedIds.length > 0 && (
            <Button variant="ghost" onClick={() => setSelectedIds([])}>선택 해제</Button>
          )}
        </div>
        {selectedPeople.length > 0 && (
          <p className="text-sm text-muted-foreground">처음 고른 {selectedPeople[0].name} 님이 조장이 됩니다. 만든 뒤 바꿀 수 있습니다.</p>
        )}
        {notApplied.length > 0 && (
          <p className="text-sm text-destructive">
            {notApplied.map((person) => person.name).join(", ")} 님은 {formatRoundDate(eventDate)}에 신청하지 않았습니다.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{formatRoundDate(eventDate)} 조</h2>
        {dateTeams.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">이 날짜에 만든 조가 없습니다.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {dateTeams.map((team) => (
              <article key={team.id} className="flex flex-col gap-3 rounded-md border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">
                    {team.number}조 · {team.activity}
                    {team.note && ` · ${team.note}`} · {team.applicationIds.length}명
                  </h3>
                  <Button variant="ghost" size="icon" aria-label={`${team.activity} 조 삭제`} onClick={() => capture.deleteTeam(team.id)}>
                    <Trash2 />
                  </Button>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {team.applicationIds.map((id) => {
                    const isLeader = team.leaderId === id;
                    return (
                      <li
                        key={id}
                        className={cn(
                          "flex items-center rounded-full py-0.5 pr-1 pl-1 text-sm",
                          isLeader ? "bg-(--tab) text-(--on-tab)" : "bg-muted",
                        )}
                      >
                        <button
                          aria-pressed={isLeader}
                          aria-label={isLeader ? `${nameOf(id)}, 현재 조장` : `${nameOf(id)}을 조장으로 지정`}
                          title={isLeader ? "현재 조장" : "눌러서 조장으로 지정"}
                          className="focus-inset flex min-h-6 items-center gap-1 rounded-full px-2"
                          onClick={() => capture.setTeamMembers(team.id, team.applicationIds, id)}
                        >
                          {isLeader && <Crown className="size-3" aria-hidden />}
                          {nameOf(id)}
                        </button>
                        <button
                          aria-label={`${nameOf(id)} 빼기`}
                          className="focus-inset flex size-6 items-center justify-center rounded-full hover:bg-background/30"
                          onClick={() => {
                            const next = removeTeamMember(team, id);
                            capture.setTeamMembers(team.id, next.applicationIds, next.leaderId);
                          }}
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {selectedIds.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-fit"
                    onClick={() => {
                      const applicationIds = [...new Set([...team.applicationIds, ...selectedIds])];
                      capture.setTeamMembers(team.id, applicationIds, team.leaderId ?? applicationIds[0] ?? null);
                      setSelectedIds([]);
                    }}
                  >
                    <UserPlus data-icon="inline-start" />
                    선택한 {selectedIds.length}명 넣기
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {board.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">공지용 표</h2>
            <Button variant="outline" onClick={saveImage}>
              <Download data-icon="inline-start" />
              이미지로 저장
            </Button>
          </div>
          {imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}
          <div className="overflow-x-auto rounded-md border">
            <TeamBoard ref={tableRef} title={title} days={board} />
          </div>
        </section>
      )}

      <Dialog open={opened !== null} onOpenChange={(open) => !open && setOpened(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {opened && (
            <>
              <DialogHeader>
                <DialogTitle>{opened.name}</DialogTitle>
                <DialogDescription>학번 {opened.studentId}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-5">
                {opened.applications.map((item, index) => (
                  <ApplicationDetail
                    key={item.id}
                    application={item}
                    label={opened.applications.length > 1 ? (index === 0 ? "최신 신청" : `이전 신청 ${index}`) : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationDetail({ application, label }: { application: CaptureApplication; label?: string }) {
  const details: [string, string][] = [
    ["신청 시간", timeFormat.format(new Date(application.createdAt))],
    ["기수", application.cohort],
    ["전공", application.major],
    ["함께 조", application.preferredTeammate || "없음"],
    ["희망 날짜", application.dates.map(formatRoundDate).join(", ")],
    ["희망 횟수", application.participation],
    ["음주 여부", application.drinking],
    ["희망 활동", application.activities.join(", ") || "없음"],
    ["기타", application.otherActivity || "없음"],
  ];
  return (
    <section className="flex flex-col gap-2">
      {label && <h3 className="text-sm font-medium">{label}</h3>}
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
