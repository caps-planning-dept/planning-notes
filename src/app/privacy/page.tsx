import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | CAPS 기획부",
  // Google 앱 심사와 신청자가 볼 수 있도록 검색 차단 없이 공개한다.
  robots: { index: true, follow: true },
};

const CONTACT_EMAIL = "pyc060210@gmail.com";
const EFFECTIVE_DATE = "2026년 11월 6일";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="h-full overflow-y-auto bg-secondary p-4">
      <article className="mx-auto flex max-w-180 flex-col gap-8 bg-background p-6 leading-relaxed md:p-10">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl">개인정보처리방침</h1>
          <p>
            코딩 동아리 CAPS 기획부는 회의록과 일정 관리 앱(이하 앱), 캡처 신청 폼을 운영하며 아래와 같이 개인정보를
            처리합니다.
          </p>
        </header>

        <Section title="수집하는 정보와 목적">
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">대상</th>
                  <th className="py-2 pr-4 font-medium">항목</th>
                  <th className="py-2 font-medium">목적</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-b">
                  <td className="py-2 pr-4 whitespace-nowrap">앱 멤버</td>
                  <td className="py-2 pr-4">
                    Google 계정의 이메일, 이름, 프로필 사진 주소, 최근 로그인과 활동 시간, 앱에 작성한 회의록, 일정,
                    답글, 문의
                  </td>
                  <td className="py-2">멤버 확인, 함께 편집, 멤버 관리</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 whitespace-nowrap">캡처 신청자</td>
                  <td className="py-2 pr-4">
                    이름, 학번, 기수, 전공, 함께 조를 하고 싶은 사람, 희망 날짜, 희망 횟수, 음주 여부, 희망 활동
                  </td>
                  <td className="py-2">캡처 조 편성과 안내</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="보관 기간">
          <ul className="list-disc pl-5">
            <li>캡처 신청 정보는 해당 회차 종료 후 1년 이내에 삭제합니다.</li>
            <li>삭제한 탭은 복구를 위해 휴지통에 30일간 보관한 뒤 삭제합니다.</li>
            <li>멤버 정보는 멤버로 활동하는 동안 보관하며, 요청하면 지체 없이 삭제합니다.</li>
            <li>
              복구를 위해 탭, 회의록, 일정, 답글, 문의, 멤버의 표시 이름을 비공개 저장소에 매일 백업하고 30일간
              보관합니다. 캡처 신청 정보와 이메일은 백업하지 않습니다.
            </li>
          </ul>
        </Section>

        <Section title="열람 범위">
          <p>
            캡처 신청 정보는 관리자와 지정된 기획부 담당자만 볼 수 있습니다. 조 편성표를 공유할 때는 이름, 날짜, 활동,
            조, 메모만 포함합니다.
          </p>
        </Section>

        <Section title="처리를 맡기는 서비스">
          <p>수집한 정보를 판매하지 않으며, 앱 운영을 위해 아래 서비스를 이용합니다.</p>
          <ul className="list-disc pl-5">
            <li>Supabase: 데이터 저장과 로그인 처리 (데이터베이스 지역: 서울)</li>
            <li>Vercel: 앱 호스팅</li>
            <li>Liveblocks: 회의록 동시 편집과 답글 저장</li>
            <li>Google: Google 계정 로그인</li>
            <li>GitHub: 백업 보관</li>
          </ul>
          <p>일부 서비스는 해외 서버에서 정보를 처리할 수 있습니다.</p>
        </Section>

        <Section title="쿠키">
          <p>로그인 상태를 유지하는 데 필요한 쿠키만 사용합니다. 광고나 방문 분석 도구는 사용하지 않습니다.</p>
        </Section>

        <Section title="정보 주체의 권리">
          <p>
            자신의 정보를 열람, 정정, 삭제하거나 처리 중단을 요청할 수 있습니다. 아래 연락처로 요청해 주세요.
          </p>
        </Section>

        <Section title="담당자">
          <p>
            CAPS 기획부 개인정보 담당자:{" "}
            <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        <p className="text-sm text-muted-foreground">시행일: {EFFECTIVE_DATE}</p>
      </article>
    </main>
  );
}
