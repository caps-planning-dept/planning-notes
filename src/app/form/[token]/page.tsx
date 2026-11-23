import type { Metadata } from "next";
import { PublicForm } from "@/components/form/public-form";
import { readFormQuestions } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "신청",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PublicFormData = {
  title: string;
  notice: string;
  questions: unknown;
  closesAt: string | null;
  isOpen: boolean;
  isFull: boolean;
};

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-secondary p-4">
      <div className="flex w-full max-w-md flex-col gap-3 bg-background p-8">
        <h1 className="font-display text-3xl">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}

export default async function FormPage({ params }: PageProps<"/form/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_form", { token });
  const form = data as PublicFormData | null;

  if (error) return <Notice title="신청 폼을 불러오지 못했습니다" body="잠시 뒤 다시 시도해 주세요." />;
  if (!form) return <Notice title="신청 링크를 찾을 수 없습니다" body="기획부에 올바른 링크를 문의해 주세요." />;
  if (!form.isOpen) return <Notice title="신청을 받고 있지 않습니다" body="마감되었거나 아직 신청 기간이 아닙니다. 기획부에 문의해 주세요." />;
  if (form.isFull) return <Notice title="정원이 다 찼습니다" body="선착순 신청이 마감되었습니다." />;

  return (
    <PublicForm token={token} title={form.title} notice={form.notice} questions={readFormQuestions(form.questions)} />
  );
}
