import Image from "next/image";
import type { Ref } from "react";
import type { teamBoard } from "@/lib/capture";
import logo from "../../../assets/logo/caps-lockup-on-white.png";

type TeamBoardProps = {
  title: string;
  days: ReturnType<typeof teamBoard>;
  ref?: Ref<HTMLDivElement>;
};

/** 공지용 조 편성표. 이미지로 저장되므로 화면 너비와 상관없이 같은 모양을 유지한다. */
export function TeamBoard({ title, days, ref }: TeamBoardProps) {
  return (
    <div ref={ref} className="flex w-280 flex-col gap-7 bg-white p-8 text-[#2b2a27]">
      <header className="flex items-end justify-between gap-6 border-b-2 border-[#2b2a27] pb-4">
        <h3 className="font-display text-4xl leading-tight text-balance">{title || "캡처"} 조 편성표</h3>
        <Image src={logo} alt="CAPS" className="h-11 w-auto shrink-0" />
      </header>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-7">
        {days.map((day) => {
          const rowCount = Math.max(...day.teams.map((team) => team.members.length), 0);
          return (
            <section key={day.date} className="flex flex-col gap-2">
              <h4 className="text-lg font-bold tabular-nums">{day.label}</h4>
              <table className="border-separate border-spacing-x-1.5 border-spacing-y-0 text-[15px]">
                <thead>
                  <tr>
                    {day.teams.map((team) => (
                      <th key={team.id} scope="col" className="w-30 p-0 align-top font-normal">
                        <div className="chamfer flex h-21 flex-col justify-center bg-(--tab) px-3 py-2 text-left text-(--on-tab) [--chamfer:8px]">
                          <span className="text-lg leading-tight font-bold tabular-nums">{team.number}조</span>
                          <span className="text-xs leading-snug break-keep">{team.activity}</span>
                          {team.note && <span className="text-xs leading-snug font-semibold break-keep">{team.note}</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {day.teams.map((team) => (
                      <td key={team.id} className="p-0 pt-1.5">
                        <div className="flex min-h-9 flex-col justify-center bg-(--tab)/15 px-3 py-1 font-semibold">
                          {team.leader ? (
                            <>
                              <span className="text-[10px] leading-none font-medium">조장</span>
                              <span className="truncate leading-snug">{team.leader}</span>
                            </>
                          ) : (
                            <span className="text-xs font-normal text-[#5d5b54]">조장 미정</span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                  {Array.from({ length: rowCount }, (_, row) => (
                    <tr key={row}>
                      {day.teams.map((team) => (
                        <td key={team.id} className="border-b border-[#e5e3df] px-3 py-1.5 whitespace-nowrap">
                          {team.members[row] ?? " "}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
