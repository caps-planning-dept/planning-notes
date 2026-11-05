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
import type { Capture } from "@/hooks/use-capture";
import type { Member } from "@/hooks/use-workspace";
import { formatRoundDate } from "@/lib/capture";

type SettingsPanelProps = { capture: Capture; members: Member[]; userId: string };

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function SettingsPanel({ capture, members, userId }: SettingsPanelProps) {
  const round = capture.round;
  const [newDate, setNewDate] = useState("");
  const [newActivity, setNewActivity] = useState("");
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

  function addDate() {
    if (!newDate || round?.dates.includes(newDate)) return;
    capture.updateRound({ dates: [...(round?.dates ?? []), newDate].sort() });
    setNewDate("");
  }

  function addActivity() {
    const value = newActivity.trim();
    if (!value || round?.activities.includes(value)) return;
    capture.updateRound({ activities: [...(round?.activities ?? []), value] });
    setNewActivity("");
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
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="추가할 날짜" className="w-fit" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <Button variant="outline" onClick={addDate}>
            <Plus data-icon="inline-start" />
            추가
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-md border p-4">
        <h2 className="font-medium">활동 목록</h2>
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
          <Input aria-label="추가할 활동" placeholder="축제 (9/29, 9/30, 10/1)" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} />
          <Button type="submit" variant="outline">
            <Plus data-icon="inline-start" />
            추가
          </Button>
        </form>
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
            <p className="text-sm text-muted-foreground">신청 폼 안내대로 회차가 끝나면 신청 내용을 지워 주세요.</p>
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
