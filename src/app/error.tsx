"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-secondary p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 bg-background p-8">
        <h1 className="font-display text-3xl">문제가 생겼습니다</h1>
        <p className="text-muted-foreground">잠시 뒤 다시 시도해 주세요. 계속되면 기획부 관리자에게 알려 주세요.</p>
        <Button className="chamfer h-11 rounded-none" onClick={() => retry()}>
          다시 시도
        </Button>
      </div>
    </main>
  );
}
