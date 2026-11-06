"use client";

import { Check, RotateCcw, Send, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
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
import { useInquiries } from "@/hooks/use-inquiries";
import type { Member } from "@/hooks/use-workspace";
import { type Inquiry, INQUIRY_BODY_MAX, INQUIRY_TITLE_MAX, validateInquiry } from "@/lib/inquiry";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type InquiriesViewProps = { workspaceId: string; members: Member[]; isAdmin: boolean };

export function InquiriesView({ workspaceId, members, isAdmin }: InquiriesViewProps) {
  const { loaded, inquiries, error, submit, setStatus, remove } = useInquiries(workspaceId);
  const [deleting, setDeleting] = useState<Inquiry | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    setSent(false);
    const found = validateInquiry(title, body);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSending(true);
    const succeeded = await submit(title, body);
    setSending(false);
    if (succeeded) {
      setTitle("");
      setBody("");
      setSent(true);
    }
  }

  const authorName = (id: string | null) =>
    members.find((member) => member.userId === id)?.displayName ?? "이전 멤버";

  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-5 overflow-y-auto p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-4xl">문의</h1>
        <p className="text-sm text-muted-foreground">
          추가했으면 하는 기능을 남겨 주세요. 작성자와 관리자만 볼 수 있습니다.
        </p>
      </div>

      <form onSubmit={send} noValidate className="flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="inquiry-title">제목</Label>
          <Input
            id="inquiry-title"
            value={title}
            maxLength={INQUIRY_TITLE_MAX}
            aria-invalid={Boolean(errors.title)}
            onChange={(event) => setTitle(event.target.value)}
          />
          {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="inquiry-body">내용</Label>
          <Textarea
            id="inquiry-body"
            rows={4}
            value={body}
            maxLength={INQUIRY_BODY_MAX}
            aria-invalid={Boolean(errors.body)}
            onChange={(event) => setBody(event.target.value)}
          />
          {errors.body && <p className="text-sm text-destructive">{errors.body}</p>}
        </div>
        <div className="flex items-center justify-end gap-3">
          {sent && <p role="status" className="text-sm text-muted-foreground">문의를 보냈습니다.</p>}
          <Button type="submit" disabled={sending} className="chamfer rounded-none">
            <Send data-icon="inline-start" />
            {sending ? "보내는 중" : "보내기"}
          </Button>
        </div>
      </form>

      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{isAdmin ? "받은 문의" : "내 문의"}</h2>
        {!loaded && <p className="text-muted-foreground">불러오는 중입니다.</p>}
        {loaded && inquiries.length === 0 && (
          <p className="py-6 text-center text-muted-foreground">아직 문의가 없습니다.</p>
        )}
        {inquiries.map((inquiry) => (
          <article key={inquiry.id} className="flex flex-col gap-2 rounded-md border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 font-medium wrap-break-word">{inquiry.title}</h3>
              <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs">
                {inquiry.status === "done" ? "완료" : "접수"}
              </span>
            </div>
            <p className="text-sm wrap-break-word whitespace-pre-wrap">{inquiry.body}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {isAdmin && `${authorName(inquiry.authorId)} · `}
                {dateFormat.format(new Date(inquiry.createdAt))}
              </p>
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStatus(inquiry.id, inquiry.status === "done" ? "open" : "done")}
                  >
                    {inquiry.status === "done" ? <RotateCcw data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                    {inquiry.status === "done" ? "접수로 되돌리기" : "완료로 표시"}
                  </Button>
                  <Button variant="outline" onClick={() => setDeleting(inquiry)}>
                    <Trash2 data-icon="inline-start" />
                    삭제
                  </Button>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 문의를 삭제할까요?</DialogTitle>
            <DialogDescription>
              {deleting?.title} · 삭제하면 되돌릴 수 없고 작성자에게도 보이지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) remove(deleting.id);
                setDeleting(null);
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
