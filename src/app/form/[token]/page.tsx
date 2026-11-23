import type { Metadata } from "next";
import { cache } from "react";
import { PublicForm } from "@/components/form/public-form";
import { readFormQuestions } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

type PublicFormData = {
  title: string;
  notice: string;
  questions: unknown;
  closesAt: string | null;
  isOpen: boolean;
  isFull: boolean;
};

// 미리보기 정보와 화면이 같은 요청에서 폼을 한 번만 읽게 한다.
const loadForm = cache(async (token: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_form", { token });
  return { form: data as PublicFormData | null, error };
});

/** 카카오톡 등에 링크를 보내면 폼 제목이 미리보기로 나오게 한다. */
export async function generateMetadata({ params }: PageProps<"/form/[token]">): Promise<Metadata> {
  const { token } = await params;
  const { form } = await loadForm(token);
  const title = form?.title || "신청";
  // 공지는 길어 미리보기가 어지러우므로 짧은 문구만 둔다.
  const description = "CAPS 기획부 신청 폼";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "CAPS 기획부" },
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

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
  const { form, error } = await loadForm(token);

  if (error) return <Notice title="신청 폼을 불러오지 못했습니다" body="잠시 뒤 다시 시도해 주세요." />;
  if (!form) return <Notice title="신청 링크를 찾을 수 없습니다" body="기획부에 올바른 링크를 문의해 주세요." />;
  if (!form.isOpen) return <Notice title="신청을 받고 있지 않습니다" body="마감되었거나 아직 신청 기간이 아닙니다. 기획부에 문의해 주세요." />;
  if (form.isFull) return <Notice title="정원이 다 찼습니다" body="선착순 신청이 마감되었습니다." />;

  return (
    <PublicForm token={token} title={form.title} notice={form.notice} questions={readFormQuestions(form.questions)} />
  );
}
