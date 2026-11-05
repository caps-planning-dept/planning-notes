import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-full items-center justify-center bg-secondary p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 bg-background p-8">
        <h1 className="font-display text-3xl">페이지를 찾을 수 없습니다</h1>
        <p className="text-muted-foreground">주소를 확인하거나 첫 화면으로 돌아가 주세요.</p>
        <Button nativeButton={false} render={<Link href="/" />} className="chamfer h-11 rounded-none">
          첫 화면으로
        </Button>
      </div>
    </main>
  );
}
