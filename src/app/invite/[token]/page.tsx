import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata = { referrer: "no-referrer" as const };

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { failed } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  async function accept() {
    "use server";
    const client = await createClient();
    const { error } = await client.rpc("accept_invitation", { raw_token: token });
    redirect(error ? `/invite/${token}?failed=1` : "/");
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-secondary p-4">
      <form action={accept} className="flex w-full max-w-sm flex-col gap-4 bg-background p-8">
        <h1 className="font-display text-3xl">CAPS 기획부 초대</h1>
        <p className="text-muted-foreground">참여하면 탭과 일정을 함께 보고 수정할 수 있습니다.</p>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            초대 링크가 만료되었거나 취소되었습니다. 관리자에게 새 링크를 요청해 주세요.
          </p>
        )}
        <Button type="submit" className="chamfer h-11 rounded-none">
          참여하기
        </Button>
      </form>
    </main>
  );
}
