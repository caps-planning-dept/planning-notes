import { noticeSegments } from "@/lib/capture";
import { cn } from "@/lib/utils";

/** 신청 폼의 공지와 질문 설명. 줄바꿈을 살리고 **굵게**만 꾸민다. */
export function CaptureNotice({ text, className, id }: { text: string; className?: string; id?: string }) {
  if (!text.trim()) return null;
  return (
    <div id={id} className={cn("flex flex-col gap-1 leading-relaxed", className)}>
      {text.split("\n").map((line, index) =>
        line.trim() === "" ? (
          <div key={index} className="h-3" aria-hidden />
        ) : (
          <p key={index} className="wrap-break-word">
            {noticeSegments(line).map((segment, part) =>
              segment.bold ? <strong key={part}>{segment.text}</strong> : segment.text,
            )}
          </p>
        ),
      )}
    </div>
  );
}
