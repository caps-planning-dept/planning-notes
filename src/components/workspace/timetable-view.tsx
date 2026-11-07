"use client";

import { ImageUp, Plus, Users } from "lucide-react";
import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTimetable } from "@/hooks/use-timetable";
import { readableTextOn } from "@/lib/color";
import { shrinkImage } from "@/lib/shrink-image";
import {
  busyPeople,
  type ClassDraft,
  commonFreeWindows,
  DAY_LABELS,
  formatShortTime,
  formatTime,
  parseTime,
  SLOT_MINUTES,
  type TimetableClass,
  type TimetablePerson,
  validateClass,
  validatePersonName,
  visibleRange,
} from "@/lib/timetable";
import { correctTimesFromImage, type Pixels } from "@/lib/timetable-image";
import { READABLE_IMAGE_TYPES } from "@/lib/timetable-read";
import { describeTypes, imageSourceFromHtml, NO_IMAGE_HELP } from "@/lib/paste-image";
import { cn } from "@/lib/utils";

type TimetableViewProps = {
  tabId: string;
  userId: string;
  isAdmin: boolean;
};

/** 한 시간의 높이(px) */
const HOUR_PX = 52;

/** 에브리타임처럼 수업마다 다른 부드러운 색을 준다. 같은 이름은 늘 같은 색이다. */
const CLASS_COLORS = ["#f28b82", "#f9b16e", "#e9c46a", "#a7d672", "#7fcfc5", "#8ab4f8", "#a8a4f0", "#d59ee8", "#f4a3c0", "#9fc5a8"];

function classColor(title: string): string {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CLASS_COLORS[hash % CLASS_COLORS.length];
}

/** 붙여넣거나 끌어다 놓은 것 가운데 첫 사진 파일 */
function imageFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  const fromFiles = [...data.files].find((file) => file.type.startsWith("image/"));
  if (fromFiles) return fromFiles;
  for (const item of [...data.items]) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

/**
 * 붙여넣거나 끌어다 놓은 것에서 사진을 얻는다. 사진 파일이 없으면 웹 문서 안의 사진 주소에서 받아 온다.
 * 사진을 얻지 못하면 이유를 적은 안내 문구를 돌려준다.
 * 붙여넣기 내용은 이벤트가 끝나면 읽을 수 없으므로, 필요한 것은 먼저 꺼내 둔다.
 */
function pastedImage(data: DataTransfer | null): Promise<File | string> {
  const file = imageFrom(data);
  if (file) return Promise.resolve(file);
  const types = data ? [...data.types] : [];
  const source = data ? imageSourceFromHtml(data.getData("text/html")) : null;
  return (async () => {
    if (!source) return `${NO_IMAGE_HELP} (받은 형식: ${describeTypes(types)})`;
    try {
      const blob = await (await fetch(source)).blob();
      if (!blob.type.startsWith("image/")) throw new Error("not an image");
      return new File([blob], "붙여넣은 사진", { type: blob.type });
    } catch {
      return "사진 주소는 찾았지만 그 사이트가 사진을 가져오지 못하게 막았습니다. 사진을 저장한 뒤 '사진 고르기'로 넣거나, 화면을 캡처해 붙여넣어 주세요.";
    }
  })();
}

/** BMP처럼 AI에 보낼 수 없는 사진은 PNG로 바꾼다. */
async function toReadableImage(file: File): Promise<File | null> {
  if (READABLE_IMAGE_TYPES.includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? new File([blob], "사진.png", { type: "image/png" }) : null;
  } catch {
    return null;
  }
}

type Editing = { personId: string; item: TimetableClass | null; draft: ClassDraft };
type Importing = { personId: string; file: File | null };
type Naming = { mode: "add" } | { mode: "rename"; person: TimetablePerson };

export function TimetableView({ tabId, userId, isAdmin }: TimetableViewProps) {
  const timetable = useTimetable(tabId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [importing, setImporting] = useState<Importing | null>(null);
  const [naming, setNaming] = useState<Naming | null>(null);
  const [removing, setRemoving] = useState<TimetablePerson | null>(null);

  const people = timetable.people;
  // 다른 사람이 지운 사람을 보고 있었다면 겹쳐 보기로 돌아간다.
  const selected = people.find((person) => person.id === selectedId) ?? null;
  const nameOf = (id: string) => people.find((person) => person.id === id)?.name ?? "지운 사람";
  const canEdit = (person: TimetablePerson) => person.createdBy === userId || isAdmin;
  const range = visibleRange(timetable.classes);
  const shownClasses = selected ? timetable.classes.filter((item) => item.personId === selected.id) : [];
  const dialogOpen = Boolean(editing || importing || naming || removing);
  const [pasteNotice, setPasteNotice] = useState("");
  // 붙여넣은 사진을 받을 사람. 겹쳐 보기에서는 없고(""), 고칠 수 없는 사람이면 null이다.
  const pasteTarget = dialogOpen ? null : !selected ? "" : canEdit(selected) ? selected.id : null;

  // 사람 시간표를 보는 중에 사진을 붙여넣으면(Ctrl+V) 바로 사진 읽기를 시작한다.
  useEffect(() => {
    if (pasteTarget === null) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      event.preventDefault();
      if (!pasteTarget) {
        setPasteNotice("위에서 사람 이름을 먼저 누른 뒤 붙여넣어 주세요. 이름이 없으면 사람 추가를 누르세요.");
        return;
      }
      pastedImage(event.clipboardData).then((result) => {
        if (typeof result === "string") setPasteNotice(result);
        else {
          setPasteNotice("");
          setImporting({ personId: pasteTarget, file: result });
        }
      });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteTarget]);

  useEffect(() => {
    if (!pasteNotice) return;
    const timer = setTimeout(() => setPasteNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [pasteNotice]);

  function openNew(personId: string, day = 0, start = 540) {
    setEditing({ personId, item: null, draft: { day, start, end: start + 90, title: "", place: "" } });
  }

  if (!timetable.loaded) return <p className="px-6 text-muted-foreground md:px-10">시간표를 불러오는 중입니다.</p>;

  return (
    <div className="flex flex-col gap-4 px-4 pb-12 md:px-10">
      {timetable.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {timetable.error}
        </p>
      )}
      {pasteNotice && (
        <p role="status" className="rounded-md bg-muted p-3 text-sm">
          {pasteNotice}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <div role="tablist" aria-label="누구의 시간표를 볼지" className="contents">
          <PersonChip
            active={!selected}
            onClick={() => setSelectedId(null)}
            label={
              <>
                <Users className="size-4" aria-hidden /> 모두 겹쳐 보기
              </>
            }
          />
          {people.map((person) => (
            <PersonChip
              key={person.id}
              active={selected?.id === person.id}
              muted={!timetable.classes.some((item) => item.personId === person.id)}
              onClick={() => setSelectedId(person.id)}
              label={person.name}
            />
          ))}
        </div>
        <button
          type="button"
          className="focus-inset inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setNaming({ mode: "add" })}
        >
          <Plus className="size-4" aria-hidden />
          사람 추가
        </button>
      </div>

      {!selected ? (
        <Overview
          classes={timetable.classes}
          people={people}
          range={range}
          nameOf={nameOf}
          onAddPerson={() => setNaming({ mode: "add" })}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-medium">
              {selected.name} 시간표
              {shownClasses.length === 0 && <span className="ml-2 text-sm text-muted-foreground">아직 수업 없음</span>}
            </h2>
            {canEdit(selected) && (
              <>
                <Button variant="ghost" onClick={() => setNaming({ mode: "rename", person: selected })}>
                  이름 바꾸기
                </Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRemoving(selected)}>
                  지우기
                </Button>
                <Button variant="outline" onClick={() => setImporting({ personId: selected.id, file: null })}>
                  <ImageUp data-icon="inline-start" />
                  사진으로 채우기
                </Button>
                <Button onClick={() => openNew(selected.id)}>
                  <Plus data-icon="inline-start" />
                  수업 추가
                </Button>
              </>
            )}
          </div>
          <WeekGrid
            range={range}
            renderDay={(day) =>
              shownClasses
                .filter((item) => item.day === day)
                .map((item) => (
                  <ClassBlock
                    key={item.id}
                    item={item}
                    startHour={range.startHour}
                    onClick={canEdit(selected) ? () => setEditing({ personId: selected.id, item, draft: item }) : undefined}
                  />
                ))
            }
            onEmptyClick={canEdit(selected) ? (day, minute) => openNew(selected.id, day, minute) : undefined}
          />
          <p className="text-sm text-muted-foreground">
            {canEdit(selected)
              ? "빈 칸을 누르면 그 시간에 수업을 넣고, 수업을 누르면 고칩니다. 시간표 캡처를 복사해 Ctrl+V로 붙여넣어도 됩니다."
              : "이 시간표는 이름을 더한 사람과 관리자만 고칠 수 있습니다."}
          </p>
        </>
      )}

      {editing && (
        <ClassDialog
          editing={editing}
          ownerName={nameOf(editing.personId)}
          onClose={() => setEditing(null)}
          onSave={(draft) =>
            editing.item ? timetable.update(editing.item.id, draft) : timetable.add(editing.personId, draft)
          }
          onDelete={editing.item ? () => timetable.remove(editing.item!.id) : undefined}
        />
      )}
      {importing && (
        <ImportDialog
          tabId={tabId}
          ownerName={nameOf(importing.personId)}
          initialFile={importing.file}
          existingCount={timetable.classes.filter((item) => item.personId === importing.personId).length}
          onClose={() => setImporting(null)}
          onSave={(drafts) => timetable.replaceForPerson(importing.personId, drafts)}
        />
      )}
      {naming && (
        <PersonDialog
          naming={naming}
          others={people
            .filter((person) => naming.mode === "add" || person.id !== naming.person.id)
            .map((person) => person.name)}
          onClose={() => setNaming(null)}
          onSave={async (name) => {
            if (naming.mode === "rename") return timetable.renamePerson(naming.person.id, name);
            const result = await timetable.addPerson(name);
            if ("error" in result) return result.error;
            setSelectedId(result.id);
            return null;
          }}
        />
      )}
      {removing && (
        <RemovePersonDialog
          person={removing}
          classCount={timetable.classes.filter((item) => item.personId === removing.id).length}
          onClose={() => setRemoving(null)}
          onRemove={async () => {
            const problem = await timetable.removePerson(removing.id);
            if (!problem) setSelectedId(null);
            return problem;
          }}
        />
      )}
    </div>
  );
}

type PersonDialogProps = {
  naming: Naming;
  others: string[];
  onClose: () => void;
  onSave: (name: string) => Promise<string | null>;
};

function PersonDialog({ naming, others, onClose, onSave }: PersonDialogProps) {
  const [name, setName] = useState(naming.mode === "rename" ? naming.person.name : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validatePersonName(name, others);
    if (problem) return setError(problem);
    setBusy(true);
    const saveProblem = await onSave(name.trim());
    setBusy(false);
    if (saveProblem) setError(saveProblem);
    else onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{naming.mode === "add" ? "사람 추가" : "이름 바꾸기"}</DialogTitle>
            <DialogDescription>
              {naming.mode === "add"
                ? "이름을 넣으면 그 사람의 시간표가 생깁니다. 앱에 가입하지 않은 부원도 넣을 수 있습니다."
                : "모든 멤버에게 바뀐 이름으로 보입니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="person-name">이름</Label>
            <Input
              id="person-name"
              value={name}
              placeholder="홍길동"
              maxLength={40}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "저장 중" : naming.mode === "add" ? "추가" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type RemovePersonDialogProps = {
  person: TimetablePerson;
  classCount: number;
  onClose: () => void;
  onRemove: () => Promise<string | null>;
};

function RemovePersonDialog({ person, classCount, onClose, onRemove }: RemovePersonDialogProps) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{person.name} 시간표를 지울까요?</DialogTitle>
          <DialogDescription>
            {classCount > 0 ? `수업 ${classCount}개도 함께 지워집니다. ` : ""}휴지통에 남지 않고 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const problem = await onRemove();
              setBusy(false);
              if (problem) setError(problem);
              else onClose();
            }}
          >
            지우기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonChip({
  active,
  muted,
  label,
  onClick,
}: {
  active: boolean;
  muted?: boolean;
  label: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "focus-inset inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
        active ? "border-transparent bg-(--tab) text-(--on-tab)" : "border-border/70 bg-background hover:bg-muted",
        muted && !active && "text-muted-foreground",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

type Range = ReturnType<typeof visibleRange>;

type WeekGridProps = {
  range: Range;
  renderDay: (day: number) => React.ReactNode;
  onEmptyClick?: (day: number, minute: number) => void;
};

/** 요일 열과 시간 눈금. 각 요일 칸 안에 수업이나 겹쳐 보기 칸을 위치로 놓는다. */
function WeekGrid({ range, renderDay, onEmptyClick }: WeekGridProps) {
  const hours = Array.from({ length: range.endHour - range.startHour }, (_, index) => range.startHour + index);
  const height = hours.length * HOUR_PX;
  const columns = { gridTemplateColumns: `2.25rem repeat(${range.days.length}, minmax(0, 1fr))` };

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-soft">
      <div className="grid border-b border-border/70 text-center text-sm" style={columns}>
        <span />
        {range.days.map((day) => (
          <span key={day} className="border-l border-border/70 py-1.5 font-medium">
            {DAY_LABELS[day]}
          </span>
        ))}
      </div>
      <div className="grid" style={columns}>
        <div className="relative text-right text-xs text-muted-foreground" style={{ height }}>
          {hours.map((hour, index) => (
            <span key={hour} className="absolute right-1.5" style={{ top: index * HOUR_PX + 2 }}>
              {hour}
            </span>
          ))}
        </div>
        {range.days.map((day) => (
          <div
            key={day}
            className={cn("relative border-l border-border/70", onEmptyClick && "cursor-pointer")}
            style={{
              height,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px ${HOUR_PX}px)`,
            }}
            onClick={(event) => {
              if (!onEmptyClick || event.target !== event.currentTarget) return;
              const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
              // 누른 곳을 30분 단위로 맞춘다.
              const minute = range.startHour * 60 + Math.floor(y / (HOUR_PX / 2)) * 30;
              onEmptyClick(day, minute);
            }}
          >
            {renderDay(day)}
          </div>
        ))}
      </div>
    </div>
  );
}

function position(start: number, end: number, startHour: number): CSSProperties {
  return {
    top: ((start - startHour * 60) / 60) * HOUR_PX,
    height: Math.max(((end - start) / 60) * HOUR_PX, 18),
  };
}

function ClassBlock({ item, startHour, onClick }: { item: TimetableClass; startHour: number; onClick?: () => void }) {
  const color = classColor(item.title);
  const content = (
    <>
      <span className="block font-semibold leading-tight">{item.title}</span>
      {item.place && <span className="block leading-tight opacity-85">{item.place}</span>}
    </>
  );
  const style = { ...position(item.start, item.end, startHour), background: color, color: readableTextOn(color) };
  const className =
    "absolute inset-x-0.5 flex flex-col items-start justify-start overflow-hidden rounded-md p-1 text-left text-[0.7rem] sm:text-xs";
  const label = `${DAY_LABELS[item.day]} ${formatShortTime(item.start)}~${formatShortTime(item.end)} ${item.title}`;
  if (!onClick) {
    return (
      <div className={className} style={style} title={label}>
        {content}
      </div>
    );
  }
  return (
    <button type="button" className={cn(className, "focus-inset hover:brightness-95")} style={style} title={label} aria-label={`${label} 고치기`} onClick={onClick}>
      {content}
    </button>
  );
}

type OverviewProps = {
  classes: TimetableClass[];
  people: TimetablePerson[];
  range: Range;
  nameOf: (id: string) => string;
  onAddPerson: () => void;
};

/** 모두의 시간표를 겹쳐, 칸마다 수업 있는 사람 수를 진하기로 보여 준다. */
function Overview({ classes, people, range, nameOf, onAddPerson }: OverviewProps) {
  const [slot, setSlot] = useState<{ day: number; start: number } | null>(null);
  // 수업을 하나라도 넣은 사람만 센다. 이름만 있고 수업이 없으면 비는 시간 계산에서 뺀다.
  const entered = new Set(classes.map((item) => item.personId));
  const total = entered.size;
  const free = commonFreeWindows(classes, range.days, range.startHour, range.endHour);
  const slots = Array.from(
    { length: ((range.endHour - range.startHour) * 60) / SLOT_MINUTES },
    (_, index) => range.startHour * 60 + index * SLOT_MINUTES,
  );
  const missing = people.filter((person) => !entered.has(person.id));

  if (total === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6">
        <p>
          {people.length === 0
            ? "아직 아무도 없습니다. 사람 추가를 눌러 이름을 넣으면 그 사람의 시간표가 생깁니다."
            : "아직 수업을 넣은 사람이 없습니다. 위에서 이름을 눌러 시간표를 넣으면 여기서 모두 비는 시간을 볼 수 있습니다."}
        </p>
        <Button onClick={onAddPerson}>
          <Plus data-icon="inline-start" />
          사람 추가
        </Button>
      </div>
    );
  }

  const busy = slot ? busyPeople(classes, slot.day, slot.start) : new Set<string>();
  const slotClasses = slot
    ? classes.filter((item) => item.day === slot.day && item.start < slot.start + SLOT_MINUTES && item.end > slot.start)
    : [];

  return (
    <>
      <section aria-label="모두 비는 시간" className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background p-4 shadow-soft">
        <h2 className="font-medium">
          모두 비는 시간 <span className="text-sm font-normal text-muted-foreground">시간표를 넣은 {total}명 기준, 1시간 이상</span>
        </h2>
        {free.length === 0 ? (
          <p className="text-sm text-muted-foreground">평일 {range.startHour}시~{range.endHour}시에 모두 비는 1시간이 없습니다.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {free.map((window) => (
              <li key={`${window.day}-${window.start}`} className="rounded-full bg-(--tab) px-3 py-1 text-sm text-(--on-tab)">
                {DAY_LABELS[window.day]} {formatShortTime(window.start)}~{formatShortTime(window.end)}
              </li>
            ))}
          </ul>
        )}
        {missing.length > 0 && (
          <p className="text-sm text-muted-foreground">
            아직 수업을 넣지 않은 사람: {missing.map((person) => person.name).join(", ")}
          </p>
        )}
      </section>

      <WeekGrid
        range={range}
        renderDay={(day) =>
          slots.map((start) => {
            const count = busyPeople(classes, day, start).size;
            const active = slot?.day === day && slot.start === start;
            return (
              <button
                key={start}
                type="button"
                aria-label={`${DAY_LABELS[day]} ${formatShortTime(start)} 수업 있는 사람 ${count}명`}
                aria-pressed={active}
                className={cn(
                  "focus-inset absolute inset-x-0 flex items-center justify-center text-[0.7rem]",
                  active && "ring-2 ring-foreground ring-inset",
                )}
                style={{
                  ...position(start, start + SLOT_MINUTES, range.startHour),
                  // 수업 있는 사람이 많을수록 진하다. 모두 비면 투명하다.
                  background: count > 0 ? `color-mix(in oklab, var(--tab) ${Math.round((count / total) * 85)}%, transparent)` : undefined,
                  color: count / total > 0.5 ? "var(--on-tab)" : undefined,
                }}
                onClick={() => setSlot(active ? null : { day, start })}
              >
                {count > 0 ? count : ""}
              </button>
            );
          })
        }
      />
      <p className="text-sm text-muted-foreground">칸의 숫자는 수업 있는 사람 수입니다. 칸을 누르면 누가 수업이 있는지 보입니다.</p>

      {slot && (
        <section aria-live="polite" className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background p-4 shadow-soft">
          <h2 className="font-medium">
            {DAY_LABELS[slot.day]} {formatShortTime(slot.start)}~{formatShortTime(slot.start + SLOT_MINUTES)}
          </h2>
          <p className="text-sm">
            <span className="font-medium">수업 있음 {busy.size}명</span>
            {slotClasses.length > 0 && ": "}
            {slotClasses.map((item) => `${nameOf(item.personId)}(${item.title})`).join(", ")}
          </p>
          <p className="text-sm">
            <span className="font-medium">비어 있음 {total - busy.size}명</span>
            {total - busy.size > 0 && ": "}
            {[...entered].filter((id) => !busy.has(id)).map(nameOf).join(", ")}
          </p>
        </section>
      )}
    </>
  );
}

type ClassDialogProps = {
  editing: Editing;
  ownerName: string;
  onClose: () => void;
  onSave: (draft: ClassDraft) => Promise<string | null>;
  onDelete?: () => Promise<string | null>;
};

function ClassDialog({ editing, ownerName, onClose, onSave, onDelete }: ClassDialogProps) {
  const [draft, setDraft] = useState<ClassDraft>(editing.draft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    const problem = await action();
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validateClass(draft);
    if (problem) return setError(problem);
    run(() => onSave(draft));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editing.item ? "수업 고치기" : "수업 추가"}</DialogTitle>
            <DialogDescription>{ownerName}님 시간표</DialogDescription>
          </DialogHeader>
          <ClassFields draft={draft} idPrefix="class" onChange={(next) => { setDraft(next); setError(""); }} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => (confirmingDelete ? run(onDelete) : setConfirmingDelete(true))}
              >
                {confirmingDelete ? "정말 지우기" : "수업 지우기"}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "저장 중" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassFields({ draft, idPrefix, onChange }: { draft: ClassDraft; idPrefix: string; onChange: (draft: ClassDraft) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-title`}>수업 이름</Label>
        <Input id={`${idPrefix}-title`} value={draft.title} placeholder="재무관리" onChange={(e) => onChange({ ...draft, title: e.target.value })} />
      </div>
      <div role="radiogroup" aria-label="요일" className="col-span-2 flex flex-col gap-2">
        <span className="text-sm font-medium leading-none">요일</span>
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label, day) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={draft.day === day}
              className={cn(
                "focus-inset h-9 rounded-md border text-sm",
                // 대화 상자는 탭 바깥에 그려져 탭 색을 쓸 수 없다.
                draft.day === day ? "border-transparent bg-foreground text-background" : "border-border bg-background hover:bg-muted",
              )}
              onClick={() => onChange({ ...draft, day })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-start`}>시작</Label>
        <Input
          id={`${idPrefix}-start`}
          type="time"
          step={300}
          value={formatTime(draft.start)}
          onChange={(e) => onChange({ ...draft, start: parseTime(e.target.value) ?? draft.start })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-end`}>끝</Label>
        <Input
          id={`${idPrefix}-end`}
          type="time"
          step={300}
          value={formatTime(draft.end)}
          onChange={(e) => onChange({ ...draft, end: parseTime(e.target.value) ?? draft.end })}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-place`}>강의실 (선택)</Label>
        <Input id={`${idPrefix}-place`} value={draft.place} placeholder="L304" onChange={(e) => onChange({ ...draft, place: e.target.value })} />
      </div>
    </div>
  );
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** 그림의 픽셀을 읽는다. 시간 재기는 브라우저 안에서만 하고 어디에도 보내지 않는다. */
async function readPixels(file: File): Promise<Pixels | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

type ImportDialogProps = {
  tabId: string;
  ownerName: string;
  /** 붙여넣기로 연 경우 바로 읽을 사진 */
  initialFile: File | null;
  existingCount: number;
  onClose: () => void;
  onSave: (drafts: ClassDraft[]) => Promise<string | null>;
};

/** 시간표 사진을 AI로 읽고, 사람이 확인·수정한 뒤 저장한다. 고르기, 붙여넣기, 끌어다 놓기 모두 된다. */
function ImportDialog({ tabId, ownerName, initialFile, existingCount, onClose, onSave }: ImportDialogProps) {
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"pick" | "reading" | "review">(initialFile ? "reading" : "pick");
  const [dragging, setDragging] = useState(false);
  const [drafts, setDrafts] = useState<ClassDraft[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [measuredNote, setMeasuredNote] = useState("");

  async function read(file: File) {
    setError("");
    setStep("reading");
    try {
      const readable = await toReadableImage(file);
      if (!readable) throw new Error("이 사진 형식은 읽을 수 없습니다. 화면을 캡처해 붙여넣거나 PNG, JPG 사진을 골라 주세요.");
      const image = await shrinkImage(readable);
      const response = await fetch("/api/timetable/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId, image: await readAsBase64(image), mimeType: image.type }),
      });
      const body = (await response.json().catch(() => ({}))) as { classes?: ClassDraft[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "사진을 읽지 못했습니다. 다시 시도해 주세요.");
      const classes = body.classes ?? [];
      if (classes.length === 0) throw new Error("사진에서 수업을 찾지 못했습니다. 시간표가 잘 보이는 캡처인지 확인해 주세요.");
      // AI는 칸의 위·아래 끝으로 시간을 정하는 일을 자주 틀려서, 칸 위치를 그림에서 직접 재어 고친다.
      const pixels = await readPixels(image);
      const measured = pixels ? correctTimesFromImage(classes, pixels) : null;
      setDrafts(measured?.drafts ?? classes);
      setMeasuredNote(
        measured?.measured
          ? measured.fixed > 0
            ? `AI가 읽은 시간 가운데 ${measured.fixed}개를 사진의 칸 위치로 고쳤습니다.`
            : "사진의 칸 위치로 시간을 확인했습니다."
          : "사진에서 칸 위치를 재지 못해 AI가 읽은 시간을 그대로 보여 줍니다. 시간을 꼭 확인해 주세요.",
      );
      setStep("review");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "사진을 읽지 못했습니다.");
      setStep("pick");
    }
  }

  // 붙여넣기로 열었으면 그 사진을 바로 읽는다. 첫 화면에서 한 번만 한다.
  const started = useRef(false);
  useEffect(() => {
    if (!initialFile || started.current) return;
    started.current = true;
    Promise.resolve().then(() => read(initialFile));
  });

  // 대화 상자가 열려 있는 동안 Ctrl+V로 붙여넣은 사진을 읽는다.
  useEffect(() => {
    if (step !== "pick") return;
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      pastedImage(event.clipboardData).then((result) => (typeof result === "string" ? setError(result) : read(result)));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  async function save() {
    for (const [index, draft] of drafts.entries()) {
      const problem = validateClass(draft);
      if (problem) return setError(`${index + 1}번째 수업: ${problem}`);
    }
    setSaving(true);
    const problem = await onSave(drafts);
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>사진으로 시간표 채우기</DialogTitle>
          <DialogDescription>
            {step === "review"
              ? "AI가 읽은 내용입니다. 틀린 곳을 고친 뒤 저장하세요. 특히 시간을 확인해 주세요."
              : `${ownerName}님의 에브리타임 시간표 캡처를 넣으면 AI가 수업을 읽어 옵니다.`}
          </DialogDescription>
        </DialogHeader>

        {step === "reading" && (
          <p role="status" className="rounded-lg border border-border/70 p-6 text-center text-sm">
            사진을 읽는 중입니다 (10~30초)
          </p>
        )}

        {step === "pick" && (
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors",
                dragging ? "border-foreground bg-muted" : "border-border",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                pastedImage(event.dataTransfer).then((result) =>
                  typeof result === "string" ? setError(result) : read(result),
                );
              }}
            >
              <p>
                캡처를 복사한 뒤 <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-xs">Ctrl</kbd>+
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-xs">V</kbd>로 붙여넣거나, 사진을 여기로
                끌어다 놓으세요.
              </p>
              <Button onClick={() => input.current?.click()}>
                <ImageUp data-icon="inline-start" />
                사진 고르기
              </Button>
            </div>
            {/* 휴대폰에는 Ctrl+V가 없으므로, 글 칸을 길게 눌러 나오는 붙여넣기를 쓴다. */}
            <textarea
              aria-label="휴대폰에서 붙여넣기"
              rows={1}
              value=""
              placeholder="휴대폰: 여기를 길게 눌러 붙여넣기"
              className="resize-none rounded-md border bg-background px-3 py-2 text-center text-sm placeholder:text-muted-foreground md:hidden"
              onChange={() => {}}
              onPaste={(event) => {
                event.preventDefault();
                pastedImage(event.clipboardData).then((result) =>
                  typeof result === "string" ? setError(result) : read(result),
                );
              }}
            />
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              tabIndex={-1}
              aria-hidden
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) read(file);
              }}
            />
            <p className="text-xs text-muted-foreground">사진은 읽는 데만 쓰고 저장하지 않습니다. 사진은 Google Gemini로 보내집니다.</p>
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-3">
            {measuredNote && <p className="rounded-md bg-muted p-2 text-sm">{measuredNote}</p>}
            {drafts.map((draft, index) => (
              <div key={index} className="relative rounded-lg border border-border/70 p-3 pr-12">
                <ClassFields
                  draft={draft}
                  idPrefix={`import-${index}`}
                  onChange={(next) => {
                    setDrafts(drafts.map((item, other) => (other === index ? next : item)));
                    setError("");
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${index + 1}번째 수업 빼기`}
                  title="빼기"
                  className="absolute top-2 right-2 text-muted-foreground"
                  onClick={() => setDrafts(drafts.filter((_, other) => other !== index))}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="self-start"
              onClick={() => setDrafts([...drafts, { day: 0, start: 540, end: 630, title: "", place: "" }])}
            >
              <Plus data-icon="inline-start" />
              수업 더하기
            </Button>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {step === "review" && (
          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {existingCount > 0 ? `지금 있는 수업 ${existingCount}개를 지우고 이 ${drafts.length}개로 바꿉니다.` : `수업 ${drafts.length}개를 저장합니다.`}
            </p>
            <Button disabled={saving || drafts.length === 0} onClick={save}>
              {saving ? "저장 중" : "저장"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
