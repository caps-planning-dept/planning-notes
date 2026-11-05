import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { WorkspaceApp } from "@/components/workspace/workspace-app";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <main className="flex min-h-full items-center justify-center bg-secondary p-4">
        <div className="flex w-full max-w-sm flex-col gap-4 bg-background p-8">
          <h1 className="font-display text-3xl">초대가 필요합니다</h1>
          <p className="leading-relaxed text-muted-foreground">
            관리자에게 초대 링크를 받아 열어 주세요. 다른 계정으로 로그인했다면 로그아웃 후 다시 시도할 수 있습니다.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  }

  return (
    <WorkspaceApp
      workspaceId={membership.workspace_id}
      userId={userId}
      isAdmin={membership.role === "admin"}
    />
  );
}
