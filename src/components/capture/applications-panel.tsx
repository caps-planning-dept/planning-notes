"use client";

import { useMemo } from "react";
import type { Capture } from "@/hooks/use-capture";
import {
  formatRoundDate,
  groupApplicants,
  mergedActivities,
  mergedDates,
  summarizeApplications,
} from "@/lib/capture";

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const cell = "border-b px-3 py-2 align-top";
const heading = "border-b bg-secondary px-3 py-2 text-left font-medium whitespace-nowrap";

function CountTable({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="font-medium">{title}</h2>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={heading}>{title.replace("별 인원", "")}</th>
              <th scope="col" className={`${heading} w-20 text-right`}>인원</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className={cell}>{row.label}</td>
                <td className={`${cell} text-right tabular-nums`}>{row.count}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ApplicationsPanel({ capture }: { capture: Capture }) {
  const { applications, round } = capture;
  const summary = useMemo(() => (round ? summarizeApplications(applications, round) : null), [applications, round]);
  const applicants = useMemo(
    () =>
      groupApplicants(applications).sort((a, b) =>
        a.applications[0].createdAt.localeCompare(b.applications[0].createdAt),
      ),
    [applications],
  );

  if (!summary) return null;
  if (applications.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">아직 신청이 없습니다. 설정에서 신청을 열고 링크를 공유해 보세요.</p>;
  }

  const stats = [
    { label: "신청자", value: `${summary.people}명` },
    { label: "전체 신청", value: `${summary.applications}건` },
    { label: "여러 날 신청", value: `${summary.multiDayPeople}명` },
    { label: "중복 신청", value: `${summary.repeatPeople}명` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border p-4">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <CountTable title="날짜별 인원" rows={summary.byDate} />
        <CountTable title="활동별 인원" rows={summary.byActivity} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">신청자 명단</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-225 border-collapse text-sm">
            <thead>
              <tr>
                {["이름", "학번", "기수", "전공", "희망 날짜", "횟수", "음주", "희망 활동", "신청 시간"].map((label) => (
                  <th key={label} scope="col" className={heading}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applicants.map((applicant) => {
                const latest = applicant.applications[0];
                const { activities, others } = mergedActivities(applicant);
                return (
                  <tr key={applicant.studentId}>
                    <td className={`${cell} whitespace-nowrap`}>
                      {applicant.name}
                      {applicant.applications.length > 1 && (
                        <span className="ml-1 rounded-sm bg-muted px-1 text-xs">{applicant.applications.length}건</span>
                      )}
                    </td>
                    <td className={`${cell} tabular-nums`}>{applicant.studentId}</td>
                    <td className={`${cell} whitespace-nowrap`}>{latest.cohort}</td>
                    <td className={cell}>{latest.major}</td>
                    <td className={cell}>{mergedDates(applicant).map(formatRoundDate).join(", ")}</td>
                    <td className={`${cell} whitespace-nowrap`}>{latest.participation}</td>
                    <td className={`${cell} whitespace-nowrap`}>{latest.drinking}</td>
                    <td className={cell}>{[...activities, ...others].join(", ") || "-"}</td>
                    <td className={`${cell} whitespace-nowrap tabular-nums`}>
                      {timeFormat.format(new Date(latest.createdAt))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">중복 신청자의 날짜와 활동은 모든 신청을 합쳐 표시하고, 횟수와 음주 여부는 최신 신청을 표시합니다. 신청별 내용은 조 편성의 상세 정보에서 확인할 수 있습니다.</p>
      </section>
    </div>
  );
}
