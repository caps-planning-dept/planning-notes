import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/login-card";
import { safeRedirectPath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = safeRedirectPath(typeof next === "string" ? next : null);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(nextPath);

  return <LoginCard nextPath={nextPath} failed={error === "auth"} />;
}
