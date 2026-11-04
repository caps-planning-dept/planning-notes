import type { Metadata } from "next";
import { Black_Han_Sans } from "next/font/google";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

const display = Black_Han_Sans({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "CAPS 기획부",
  description: "CAPS 기획부의 회의록과 일정을 함께 관리하는 공간",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${display.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
