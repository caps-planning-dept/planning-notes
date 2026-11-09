import type { Metadata } from "next";
import { ApplyForm } from "@/components/capture/apply-form";
import { readQuestions } from "@/lib/capture";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "캡처 신청",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PublicForm = {
  title: string;
  notice?: string;
  dates: string[];
  activities: string[];
  prizes?: string[];
  questions?: unknown;
  closesAt: string | null;
  isOpen: boolean;
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

export default async function ApplyPage({ params }: PageProps<"/apply/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_capture_form", { token });
  const form = data as PublicForm | null;

  if (error) return <Notice title="신청 폼을 불러오지 못했습니다" body="잠시 뒤 다시 시도해 주세요." />;
  if (!form) return <Notice title="신청 링크를 찾을 수 없습니다" body="기획부에 올바른 링크를 문의해 주세요." />;
  if (!form.isOpen) return <Notice title="신청을 받고 있지 않습니다" body="신청 기간을 기획부에 문의해 주세요." />;

  return (
    <ApplyForm
      token={token}
      title={form.title}
      notice={form.notice ?? ""}
      dates={form.dates}
      activities={form.activities}
      prizes={form.prizes ?? []}
      questions={readQuestions(form.questions)}
    />
  );
}
