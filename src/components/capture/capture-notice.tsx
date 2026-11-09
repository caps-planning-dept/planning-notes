import { noticeSegments } from "@/lib/capture";

/** 신청 폼 제목 아래의 공지. 줄바꿈을 살리고 **굵게**만 꾸민다. */
export function CaptureNotice({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="flex flex-col gap-1 leading-relaxed">
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
