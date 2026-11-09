"use client";

import { Copy, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Capture } from "@/hooks/use-capture";
import type { Member } from "@/hooks/use-workspace";
import { datesBetween, formatRoundDate, MAX_DATE_RANGE } from "@/lib/capture";
import { CaptureNotice } from "./capture-notice";

type SettingsPanelProps = { capture: Capture; members: Member[]; userId: string };

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function SettingsPanel({ capture, members, userId }: SettingsPanelProps) {
  const round = capture.round;
  const [newDate, setNewDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [newPrize, setNewPrize] = useState("");
  // 글자마다 저장하면 늦게 온 응답이 입력 중인 글을 덮을 수 있어, 칸을 벗어날 때 저장한다.
  const [notice, setNotice] = useState<string | null>(null);
  const [prizeNote, setPrizeNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  if (!round) return null;

  const link = `${window.location.origin}/apply/${round.publicToken}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const pickedDates = datesBetween(newDate, newEndDate);
  const rangeTooLong = newDate !== "" && pickedDates.length === 0;

  function addDate() {
    const dates = new Set([...(round?.dates ?? []), ...pickedDates]);
    if (dates.size === round?.dates.length) return;
    capture.updateRound({ dates: [...dates].sort() });
    setNewDate("");
    setNewEndDate("");
  }

  function addActivity() {
    const value = newActivity.trim();
    if (!value || round?.activities.includes(value)) return;
    capture.updateRound({ activities: [...(round?.activities ?? []), value] });
    setNewActivity("");
  }

  function addPrize() {
    const value = newPrize.trim();
    if (!value || round?.prizes.includes(value)) return;
    capture.updateRound({ prizes: [...(round?.prizes ?? []), value] });
    setNewPrize("");
  }

  function saveNotice() {
    if (notice !== null && notice !== round?.notice) capture.updateRound({ notice });
    setNotice(null);
  }

  function savePrizeNote() {
    if (prizeNote !== null && prizeNote !== round?.prizeNote) capture.updateRound({ prizeNote });
    setPrizeNote(null);
  }

  return (
    <div className="flex max-w-180 flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-md border p-4">
        <h2 className="font-medium">신청 받기</h2>
        <label className="flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            className="size-4"
            checked={round.isOpen}
            onChange={(e) => capture.updateRound({ isOpen: e.target.checked })}
          />
          신청 열기
        </label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="capture-closes">마감 시간 (선택)</Label>
          <Input
            id="capture-closes"
            type="datetime-local"
            className="w-fit"
            value={toLocalInput(round.closesAt)}
            onChange={(e) =>
              capture.updateRound({ closesAt: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="capture-link">신청 링크</Label>
          <div className="flex items-center gap-2">
            <Input id="capture-link" readOnly value={link} className="min-w-0 flex-1 bg-secondary" />
            <Button variant="outline" onClick={copyLink}>
              <Copy data-icon="inline-start" />
              {copied ? "복사했습니다" : "복사"}
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-md border p-4">
        <h2 className="font-medium">공지</h2>
        <p className="text-sm text-muted-foreground">
          신청 폼 제목 아래에 보입니다. 줄바꿈은 그대로 보이고, **글자**처럼 감싸면 굵게 보입니다. 칸 밖을 누르면 저장됩니다.
        </p>
        <Textarea
          aria-label="공지"
          rows={10}
          maxLength={5000}
          placeholder="일시, 신청 기한, 장소, 이벤트 안내 등"
          value={notice ?? round.notice}
          onChange={(e) => setNotice(e.target.value)}
          onBlur={saveNotice}
        />
        {(notice ?? round.notice).trim() && (
          <details className="rounded-md bg-secondary p-3 text-sm">
            <summary className="cursor-pointer font-medium">신청 폼에서 보이는 모습</summary>
            <div className="mt-3">
              <CaptureNotice text={notice ?? round.notice} />
            </div>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-md border p-4">
        <h2 className="font-medium">활동 날짜</h2>
        <ul className="flex flex-wrap gap-1.5">
          {round.dates.map((date) => (
            <li key={date} className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-3 text-sm">
              {formatRoundDate(date)}
              <button
                aria-label={`${formatRoundDate(date)} 삭제`}
                className="focus-inset flex size-6 items-center justify-center rounded-full hover:bg-background"
                onClick={() => capture.updateRound({ dates: round.dates.filter((item) => item !== date) })}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" aria-label="추가할 첫 날짜" className="w-fit" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <span aria-hidden>~</span>
          <Input
            type="date"
            aria-label="추가할 마지막 날짜 (선택)"
            className="w-fit"
            min={newDate || undefined}
            value={newEndDate}
            onChange={(e) => setNewEndDate(e.target.value)}
          />
          <Button variant="outline" disabled={pickedDates.length === 0} onClick={addDate}>
            <Plus data-icon="inline-start" />
            {pickedDates.length > 1 ? `${pickedDates.length}일 추가` : "추가"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          {rangeTooLong
            ? `한 번에 ${MAX_DATE_RANGE}일까지 더할 수 있습니다.`
            : "하루만 더하려면 첫 날짜만 고르세요. 마지막 날짜도 고르면 그 사이 날짜를 모두 더합니다."}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-md border p-4">
        <h2 className="font-medium">활동 테마</h2>
        <p className="text-sm text-muted-foreground">신청자는 이 중에서 1순위와 2순위를 하나씩 고릅니다.</p>
        <ul className="flex flex-wrap gap-1.5">
          {round.activities.map((activity) => (
            <li key={activity} className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-3 text-sm">
              {activity}
              <button
                aria-label={`${activity} 삭제`}
                className="focus-inset flex size-6 items-center justify-center rounded-full hover:bg-background"
                onClick={() => capture.updateRound({ activities: round.activities.filter((item) => item !== activity) })}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addActivity();
          }}
        >
          <Input aria-label="추가할 활동" placeholder="야외/관람 (한강모임, 영화관)" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} />
          <Button type="submit" variant="outline">
            <Plus data-icon="inline-start" />
            추가
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-md border p-4">
        <h2 className="font-medium">이벤트 상품</h2>
        <p className="text-sm text-muted-foreground">
          상품을 하나 이상 넣으면 신청 폼에 상품 고르기(택1)가 보입니다. 목록 끝에 기타(직접 입력)가 함께 나옵니다.
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {round.prizes.map((prize) => (
            <li key={prize} className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-3 text-sm">
              {prize}
              <button
                aria-label={`${prize} 삭제`}
                className="focus-inset flex size-6 items-center justify-center rounded-full hover:bg-background"
                onClick={() => capture.updateRound({ prizes: round.prizes.filter((item) => item !== prize) })}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addPrize();
          }}
        >
          <Input aria-label="추가할 상품" maxLength={100} placeholder="컴포즈커피/메가커피 기프티콘" value={newPrize} onChange={(e) => setNewPrize(e.target.value)} />
          <Button type="submit" variant="outline">
            <Plus data-icon="inline-start" />
            추가
          </Button>
        </form>
        <div className="flex flex-col gap-2">
          <Label htmlFor="capture-prize-note">상품 안내 (선택)</Label>
          <Textarea
            id="capture-prize-note"
            rows={2}
            maxLength={500}
            placeholder="* 모든 경품은 1만원 상당의 기프티콘으로 제공됩니다!"
            value={prizeNote ?? round.prizeNote}
            onChange={(e) => setPrizeNote(e.target.value)}
            onBlur={savePrizeNote}
          />
        </div>
      </section>

      {capture.isAdmin && (
        <>
          <section className="flex flex-col gap-2 rounded-md border p-4">
            <h2 className="font-medium">열람자</h2>
            <p className="text-sm text-muted-foreground">체크한 멤버와 관리자만 이 탭과 신청 내용을 볼 수 있습니다.</p>
            {members
              .filter((member) => member.role !== "admin" && member.userId !== userId)
              .map((member) => (
                <label key={member.userId} className="flex min-h-9 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={capture.viewerIds.includes(member.userId)}
                    onChange={(e) => capture.setViewer(member.userId, e.target.checked)}
                  />
                  {member.displayName}
                </label>
              ))}
            {members.every((member) => member.role === "admin" || member.userId === userId) && (
              <p className="text-sm text-muted-foreground">지정할 수 있는 다른 멤버가 없습니다.</p>
            )}
          </section>

          <section className="flex flex-col gap-2 rounded-md border border-destructive/40 p-4">
            <h2 className="font-medium">회차 종료 후 정리</h2>
            <p className="text-sm text-muted-foreground">신청 폼 안내대로 회차 종료 후 1년 이내에 신청 내용을 지워 주세요.</p>
            <Button variant="destructive" className="w-fit" onClick={() => setConfirming(true)}>
              신청 내용 모두 삭제 ({capture.applications.length}건)
            </Button>
          </section>
        </>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신청 내용을 모두 삭제할까요?</DialogTitle>
            <DialogDescription>삭제하면 되돌릴 수 없습니다. 만든 조도 함께 삭제됩니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => {
                capture.deleteAllApplications();
                setConfirming(false);
              }}
            >
              모두 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
