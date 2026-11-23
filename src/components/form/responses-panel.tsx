"use client";

import { Download, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FormTab } from "@/hooks/use-form";
import { countChoices, formatAnswer, type FormResponse, questionTitle, responsesToCsv } from "@/lib/forms";

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const formatTime = (iso: string) => timeFormat.format(new Date(iso));

const cell = "border-b px-3 py-2 align-top";
const heading = "border-b bg-secondary px-3 py-2 text-left font-medium whitespace-nowrap";

export function ResponsesPanel({ form, title }: { form: FormTab; title: string }) {
  const { settings, responses } = form;
  const [removing, setRemoving] = useState<{ response: FormResponse; order: number } | null>(null);
  const choices = useMemo(() => (settings ? countChoices(settings.questions, responses) : []), [settings, responses]);
  if (!settings) return null;
  const { questions, capacity } = settings;
  const firstQuestion = questions[0];

  function download() {
    const csv = responsesToCsv(questions, responses, formatTime);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title || "신청"} 응답.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-lg font-medium tabular-nums">
          {capacity !== null ? `${responses.length} / ${capacity}명` : `${responses.length}명`} 신청
        </p>
        {capacity !== null && responses.length >= capacity && (
          <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs text-background">정원 마감</span>
        )}
        <span className="flex-1" />
        <Button variant="outline" disabled={responses.length === 0} onClick={download}>
          <Download data-icon="inline-start" />
          엑셀용 CSV 내려받기
        </Button>
      </div>

      {responses.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">아직 신청이 없습니다. 폼 설정에서 신청을 열고 링크를 공유해 보세요.</p>
      ) : (
        <>
          {choices.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {choices.map(({ question, rows }) => (
                <section key={question.id} className="flex min-w-0 flex-col gap-2">
                  <h2 className="font-medium">{questionTitle(question, questions.indexOf(question))}</h2>
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full border-collapse text-sm">
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.label}>
                            <td className={cell}>{row.label}</td>
                            <td className={`${cell} w-20 text-right tabular-nums`}>{row.count}명</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="font-medium">응답 목록</h2>
            <p className="text-sm text-muted-foreground">먼저 낸 순서입니다. 신청을 취소한 사람은 지우면 자리가 다시 생깁니다.</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={`${heading} w-12 text-right`}>순번</th>
                    {questions.map((question, index) => (
                      <th key={question.id} scope="col" className={heading}>
                        {questionTitle(question, index)}
                      </th>
                    ))}
                    <th scope="col" className={heading}>신청 시간</th>
                    <th scope="col" className={`${heading} w-12`}>
                      <span className="sr-only">삭제</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response, order) => (
                    <tr key={response.id}>
                      <td className={`${cell} text-right tabular-nums text-muted-foreground`}>{order + 1}</td>
                      {questions.map((question) => (
                        <td key={question.id} className={`${cell} max-w-80 wrap-break-word whitespace-pre-line`}>
                          {formatAnswer(response.answers[question.id])}
                        </td>
                      ))}
                      <td className={`${cell} whitespace-nowrap tabular-nums text-muted-foreground`}>
                        {formatTime(response.createdAt)}
                      </td>
                      <td className={`${cell} py-1`}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${order + 1}번 응답 삭제`}
                          onClick={() => setRemoving({ response, order: order + 1 })}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{removing?.order}번 응답을 삭제할까요?</DialogTitle>
            <DialogDescription>
              {removing && firstQuestion
                ? `${questionTitle(firstQuestion, 0)}: ${formatAnswer(removing.response.answers[firstQuestion.id]) || "(빈칸)"}. `
                : ""}
              삭제하면 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) form.deleteResponse(removing.response.id);
                setRemoving(null);
              }}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
