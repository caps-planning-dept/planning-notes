"use client";

import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
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
import type { FormTab } from "@/hooks/use-form";
import { type FormQuestion, formStatus, MAX_CAPACITY } from "@/lib/forms";
import { PublicForm } from "./public-form";
import { QuestionsBuilder } from "./questions-builder";

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const STATUS_TEXT = {
  닫힘: "신청이 닫혀 있어 지금 링크를 열면 \"신청을 받고 있지 않습니다\"가 보입니다. 열면 아래 모습이 보입니다.",
  "마감 시간 지남": "마감 시간이 지나 지금 링크를 열면 \"신청을 받고 있지 않습니다\"가 보입니다.",
  "정원 참": "정원이 다 차 지금 링크를 열면 \"정원이 다 찼습니다\"가 보입니다.",
} as const;

export function FormSettingsPanel({ form, title }: { form: FormTab; title: string }) {
  const settings = form.settings;
  // 글자마다 저장하면 늦게 온 응답이 입력 중인 글을 덮을 수 있어, 칸을 벗어날 때 저장한다.
  const [notice, setNotice] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState<FormQuestion[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // 마감 시간이 지났는지 알기 위한 지금 시각. 30초마다 새로 읽는다.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!settings) return null;

  const link = `${window.location.origin}/form/${settings.publicToken}`;
  const status = formStatus(settings, form.responses.length, now);
  const questions = questionDraft ?? settings.questions;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function saveNotice() {
    if (notice !== null && notice !== settings?.notice) form.updateSettings({ notice });
    setNotice(null);
  }

  function saveCapacity() {
    if (capacity === null) return;
    const number = Number.parseInt(capacity, 10);
    const next = Number.isFinite(number) && number > 0 ? Math.min(number, MAX_CAPACITY) : null;
    if (next !== settings?.capacity) form.updateSettings({ capacity: next });
    setCapacity(null);
  }

  function saveQuestions(next: FormQuestion[]) {
    setQuestionDraft(null);
    if (JSON.stringify(next) !== JSON.stringify(settings?.questions)) form.updateSettings({ questions: next });
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,45rem)_minmax(0,1fr)]">
      <div className="flex max-w-180 flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-md border p-4">
          <h2 className="font-medium">신청 받기</h2>
          <label className="flex min-h-9 items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={settings.isOpen}
              onChange={(e) => form.updateSettings({ isOpen: e.target.checked })}
            />
            신청 열기
          </label>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="form-closes">마감 시간 (선택)</Label>
              <Input
                id="form-closes"
                type="datetime-local"
                className="w-fit"
                value={toLocalInput(settings.closesAt)}
                onChange={(e) =>
                  form.updateSettings({ closesAt: e.target.value ? new Date(e.target.value).toISOString() : null })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="form-capacity">선착순 정원 (선택)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="form-capacity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_CAPACITY}
                  placeholder="제한 없음"
                  className="w-28"
                  value={capacity ?? settings.capacity ?? ""}
                  onChange={(e) => setCapacity(e.target.value)}
                  onBlur={saveCapacity}
                  onKeyDown={(e) => e.key === "Enter" && saveCapacity()}
                />
                <span className="text-sm">명</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            정원을 정하면 먼저 낸 순서대로 받고, 정원이 차면 링크에 &quot;정원이 다 찼습니다&quot;가 보입니다. 응답을
            지우면 자리가 다시 생깁니다.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="form-link">신청 링크</Label>
            <div className="flex items-center gap-2">
              <Input id="form-link" readOnly value={link} className="min-w-0 flex-1 bg-secondary" />
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
            신청 폼 제목 아래에 보입니다. 폼 제목은 탭 이름입니다. 줄바꿈은 그대로 보이고, **글자**처럼 감싸면 굵게
            보입니다. 칸 밖을 누르면 저장됩니다.
          </p>
          <Textarea
            aria-label="공지"
            rows={10}
            maxLength={5000}
            placeholder="일시, 장소, 신청 기한, 인원 제한 등"
            value={notice ?? settings.notice}
            onChange={(e) => setNotice(e.target.value)}
            onBlur={saveNotice}
          />
        </section>

        <QuestionsBuilder questions={questions} onDraft={setQuestionDraft} onSave={saveQuestions} />

        {form.isAdmin && (
          <section className="flex flex-col gap-2 rounded-md border border-destructive/40 p-4">
            <h2 className="font-medium">행사 종료 후 정리</h2>
            <p className="text-sm text-muted-foreground">신청 폼 안내대로 행사 종료 후 1년 이내에 응답을 지워 주세요.</p>
            <Button variant="destructive" className="w-fit" onClick={() => setConfirming(true)}>
              응답 모두 삭제 ({form.responses.length}건)
            </Button>
          </section>
        )}

        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>응답을 모두 삭제할까요?</DialogTitle>
              <DialogDescription>삭제하면 되돌릴 수 없습니다. 질문과 설정은 남습니다.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  form.deleteAllResponses();
                  setConfirming(false);
                }}
              >
                모두 삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 넓은 화면에서는 오른쪽에 붙어 따라오고, 좁은 화면에서는 설정 아래에 나온다. */}
      <section
        aria-labelledby="form-preview-title"
        className="flex flex-col gap-2 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
      >
        <h2 id="form-preview-title" className="font-medium">
          신청 폼 미리보기
        </h2>
        <p className="text-sm text-muted-foreground">
          {status.open
            ? "신청자가 보는 모습입니다. 입력과 제출 확인은 해 볼 수 있지만 실제로 신청되지는 않습니다."
            : STATUS_TEXT[status.reason]}
        </p>
        <PublicForm preview token={settings.publicToken} title={title} notice={notice ?? settings.notice} questions={questions} />
      </section>
    </div>
  );
}
