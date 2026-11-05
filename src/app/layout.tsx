import type { Metadata } from "next";
import { Black_Han_Sans, Noto_Serif_KR } from "next/font/google";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-tiptap/styles.css";
import "./globals.css";

const display = Black_Han_Sans({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
  preload: false,
});

const noteSerif = Noto_Serif_KR({
  variable: "--font-note-serif",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "CAPS 기획부",
  description: "CAPS 기획부의 회의록과 일정을 함께 관리하는 공간",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${display.variable} ${noteSerif.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
