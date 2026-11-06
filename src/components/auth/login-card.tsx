"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { isBlockedInAppBrowser } from "@/lib/in-app-browser";
import { createClient } from "@/lib/supabase/client";
import logo from "../../../assets/logo/caps-lockup-on-white.png";

const noSubscribe = () => () => {};

type LoginCardProps = { nextPath: string; failed: boolean };

export function LoginCard({ nextPath, failed }: LoginCardProps) {
  const [error, setError] = useState(failed ? "로그인하지 못했습니다. 다시 시도해 주세요." : "");
  const [copied, setCopied] = useState(false);
  const blocked = useSyncExternalStore(
    noSubscribe,
    () => isBlockedInAppBrowser(navigator.userAgent),
    () => false,
  );

  async function signIn() {
    setError("");
    const { error: signInError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    if (signInError) setError("Google 로그인을 시작하지 못했습니다. 다시 시도해 주세요.");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setError("주소를 복사하지 못했습니다. 주소창의 링크를 직접 복사해 주세요.");
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-secondary bg-[radial-gradient(80%_60%_at_50%_0%,#ffffff_0%,transparent_70%)] p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-background p-8 shadow-float ring-1 ring-foreground/5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 motion-safe:ease-soft">
        <Image src={logo} alt="CAPS" priority className="h-12 w-auto self-start mix-blend-multiply" />
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl">CAPS 기획부</h1>
          <p className="text-sm text-muted-foreground">초대받은 멤버만 이용할 수 있습니다.</p>
        </div>
        {blocked ? (
          <div className="flex flex-col gap-3">
            <p className="leading-relaxed">
              카카오톡 같은 앱 안에서는 Google 로그인이 막힐 수 있습니다. 링크를 복사해 Chrome이나 Safari에서 열어 주세요.
            </p>
            <Button className="chamfer h-11 rounded-none" onClick={copyLink}>
              {copied ? "복사했습니다" : "링크 복사"}
            </Button>
          </div>
        ) : (
          <Button className="chamfer h-11 rounded-none" onClick={signIn}>
            Google로 로그인
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <a className="self-start text-xs text-muted-foreground underline underline-offset-4 transition-colors duration-200 ease-soft hover:text-foreground" href="/privacy">
          개인정보처리방침
        </a>
      </div>
    </main>
  );
}
