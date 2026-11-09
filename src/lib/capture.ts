export const PARTICIPATION_OPTIONS = ["1회", "2회", "3회 이상"];
export const DRINKING_OPTIONS = ["음주", "비음주", "상관없음"];
export const OTHER_ACTIVITY = "기타";
export const OTHER_PRIZE = "기타";
export const OTHER_PRIZE_PREFIX = "기타: ";

export type CaptureRound = {
  tabId: string;
  publicToken: string;
  isOpen: boolean;
  closesAt: string | null;
  dates: string[];
  activities: string[];
  notice: string;
  prizes: string[];
  prizeNote: string;
};

export type CaptureApplication = {
  id: string;
  name: string;
  studentId: string;
  cohort: string;
  major: string;
  preferredTeammate: string;
  dates: string[];
  participation: string;
  drinking: string;
  activities: string[];
  otherActivity: string;
  firstChoice: string;
  secondChoice: string;
  prize: string;
  createdAt: string;
};

export type CaptureTeam = {
  id: string;
  eventDate: string;
  activity: string;
  applicationIds: string[];
  leaderId: string | null;
  note: string;
  createdAt: string;
};

export type CaptureFilter = {
  dates: string[];
  activities: string[];
  participation: string[];
  drinking: string[];
  /** 켜면 활동을 1순위로 고른 사람만 찾는다. */
  firstOnly: boolean;
};

export const EMPTY_FILTER: CaptureFilter = {
  dates: [],
  activities: [],
  participation: [],
  drinking: [],
  firstOnly: false,
};

export type Applicant = {
  studentId: string;
  name: string;
  applications: CaptureApplication[];
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 2026-09-27을 9/27 (일) 형태로 바꾼다. */
export function formatRoundDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${month}/${day} (${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]})`;
}

/** 활동 날짜를 한 번에 더할 수 있는 최대 일수. 잘못 고른 연도로 수백 개가 생기는 것을 막는다. */
export const MAX_DATE_RANGE = 62;

/**
 * 시작일부터 끝일까지 하루씩 날짜를 돌려준다. 끝일이 없으면 시작일 하나만,
 * 끝일이 시작일보다 앞이면 둘을 바꿔서 센다. 너무 길면 빈 배열을 돌려준다.
 */
export function datesBetween(start: string, end: string): string[] {
  if (!start) return [];
  const [from, to] = end && end < start ? [end, start] : [start, end || start];
  const toTime = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const days = Math.round((toTime(to) - toTime(from)) / 86400000) + 1;
  if (days > MAX_DATE_RANGE) return [];
  return Array.from({ length: days }, (_, index) =>
    new Date(toTime(from) + index * 86400000).toISOString().slice(0, 10),
  );
}

function matches(selected: string[], values: string[]): boolean {
  return selected.length === 0 || selected.some((value) => values.includes(value));
}

/** 나중 신청은 앞 신청에 더해지므로 모든 신청의 날짜를 합친다. */
export function mergedDates(applicant: Applicant): string[] {
  return [...new Set(applicant.applications.flatMap((item) => item.dates))].sort();
}

/** 모든 신청의 활동과 기타 입력을 합친다. */
export function mergedActivities(applicant: Applicant): { activities: string[]; others: string[] } {
  return {
    activities: [...new Set(applicant.applications.flatMap((item) => item.activities))],
    others: [...new Set(applicant.applications.map((item) => item.otherActivity.trim()).filter(Boolean))],
  };
}

/**
 * 항목 안에서는 하나라도 해당하면, 항목 사이에서는 모두 해당해야 통과한다.
 * 날짜와 활동은 모든 신청을 합쳐 보고, 횟수와 음주 여부는 최신 신청을 기준으로 한다.
 * 1순위만 보기를 켜면 활동은 어느 신청에서든 1순위로 고른 테마만 본다.
 */
export function filterApplicants(applicants: Applicant[], filter: CaptureFilter): Applicant[] {
  return applicants.filter((applicant) => {
    const latest = applicant.applications[0];
    const { activities, others } = mergedActivities(applicant);
    const firstChoices = applicant.applications.map((item) => item.firstChoice).filter(Boolean);
    return (
      matches(filter.dates, mergedDates(applicant)) &&
      matches(
        filter.activities,
        filter.firstOnly ? firstChoices : others.length > 0 ? [...activities, OTHER_ACTIVITY] : activities,
      ) &&
      matches(filter.participation, [latest.participation]) &&
      matches(filter.drinking, [latest.drinking])
    );
  });
}

/** 중복 신청을 학번별로 묶고, 각 사람의 신청은 최신순으로, 사람은 이름순으로 정렬한다. */
export function groupApplicants(applications: CaptureApplication[]): Applicant[] {
  const byStudent = new Map<string, CaptureApplication[]>();
  for (const application of applications) {
    byStudent.set(application.studentId, [...(byStudent.get(application.studentId) ?? []), application]);
  }
  return [...byStudent.entries()]
    .map(([studentId, items]) => {
      const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { studentId, name: sorted[0].name, applications: sorted };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 앞 날짜일수록 앞번호, 같은 날짜는 만든 순서대로 회차 전체에서 겹치지 않는 번호를 매긴다. */
export function numberTeams(teams: CaptureTeam[]): (CaptureTeam & { number: number })[] {
  return [...teams]
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.createdAt.localeCompare(b.createdAt))
    .map((team, index) => ({ ...team, number: index + 1 }));
}

/** 조에서 사람을 뺀 뒤의 구성을 돌려준다. 조장이 빠지면 다음 사람이 조장이 된다. */
export function removeTeamMember(team: CaptureTeam, applicationId: string) {
  const applicationIds = team.applicationIds.filter((id) => id !== applicationId);
  return {
    applicationIds,
    leaderId: team.leaderId === applicationId ? (applicationIds[0] ?? null) : team.leaderId,
  };
}

/**
 * 고른 신청을 조에 더한다. 같은 사람은 신청이 여러 건이어도 한 번만 들어가고,
 * 조장이 없으면 첫 사람이 조장이 된다.
 */
export function addTeamMembers(team: CaptureTeam, selectedIds: string[], applications: CaptureApplication[]) {
  const studentOf = new Map(applications.map((item) => [item.id, item.studentId]));
  const seen = new Set(team.applicationIds.map((id) => studentOf.get(id) ?? id));
  const applicationIds = [...team.applicationIds];
  for (const id of selectedIds) {
    const student = studentOf.get(id) ?? id;
    if (seen.has(student)) continue;
    seen.add(student);
    applicationIds.push(id);
  }
  return { applicationIds, leaderId: team.leaderId ?? applicationIds[0] ?? null };
}

/** 공지용 표를 날짜별로 묶는다. 이름만 포함하고, 조장을 맨 위에 둔다. */
export function teamBoard(teams: CaptureTeam[], applications: CaptureApplication[]) {
  const names = new Map(applications.map((application) => [application.id, application.name]));
  const days: {
    date: string;
    label: string;
    teams: { id: string; number: number; activity: string; note: string; leader: string | null; members: string[] }[];
  }[] = [];

  for (const team of numberTeams(teams)) {
    let day = days.find((item) => item.date === team.eventDate);
    if (!day) {
      day = { date: team.eventDate, label: formatRoundDate(team.eventDate), teams: [] };
      days.push(day);
    }
    const leaderId = team.leaderId && team.applicationIds.includes(team.leaderId) ? team.leaderId : null;
    day.teams.push({
      id: team.id,
      number: team.number,
      activity: team.activity,
      note: team.note,
      leader: leaderId ? (names.get(leaderId) ?? null) : null,
      members: team.applicationIds.filter((id) => id !== leaderId).flatMap((id) => names.get(id) ?? []),
    });
  }
  return days;
}

/** 신청 현황의 요약 수치를 만든다. 한 사람의 여러 신청은 한 명으로 센다. */
export function summarizeApplications(applications: CaptureApplication[], round: CaptureRound) {
  const applicants = groupApplicants(applications);
  const peopleWith = (test: (application: CaptureApplication) => boolean) =>
    applicants.filter((applicant) => applicant.applications.some(test)).length;
  return {
    people: applicants.length,
    applications: applications.length,
    repeatPeople: applicants.filter((applicant) => applicant.applications.length > 1).length,
    multiDayPeople: applicants.filter(
      (applicant) => new Set(applicant.applications.flatMap((item) => item.dates)).size > 1,
    ).length,
    byDate: round.dates.map((date) => ({
      label: formatRoundDate(date),
      count: peopleWith((item) => item.dates.includes(date)),
    })),
    byActivity: [
      ...round.activities.map((activity) => ({
        label: activity,
        count: peopleWith((item) => item.activities.includes(activity)),
      })),
      { label: OTHER_ACTIVITY, count: peopleWith((item) => item.otherActivity.trim() !== "") },
    ].filter((row) => row.label !== OTHER_ACTIVITY || row.count > 0),
    // 순위와 상품은 한 사람에 한 값이므로 최신 신청을 기준으로 센다.
    byFirstChoice: round.activities.map((activity) => ({
      label: activity,
      count: applicants.filter((applicant) => applicant.applications[0].firstChoice === activity).length,
    })),
    byPrize: [
      ...round.prizes.map((prize) => ({
        label: prize,
        count: applicants.filter((applicant) => applicant.applications[0].prize === prize).length,
      })),
      {
        label: OTHER_PRIZE,
        count: applicants.filter((applicant) => applicant.applications[0].prize.startsWith(OTHER_PRIZE_PREFIX)).length,
      },
      { label: "고르지 않음", count: applicants.filter((applicant) => applicant.applications[0].prize === "").length },
    ],
  };
}

/** 학번별로 이미 배정된 날짜를 돌려준다. 같은 사람의 어느 신청으로 배정해도 함께 센다. */
export function assignedDatesByStudent(
  teams: CaptureTeam[],
  applications: CaptureApplication[],
): Map<string, string[]> {
  const studentOf = new Map(applications.map((item) => [item.id, item.studentId]));
  const assigned = new Map<string, string[]>();
  for (const team of teams) {
    for (const id of team.applicationIds) {
      const studentId = studentOf.get(id);
      if (studentId) assigned.set(studentId, [...(assigned.get(studentId) ?? []), team.eventDate]);
    }
  }
  return assigned;
}

export type ApplicationDraft = {
  name: string;
  studentId: string;
  cohort: string;
  major: string;
  dates: string[];
  firstChoice: string;
  secondChoice: string;
  /** 회차에 정한 활동 테마 수. 2개 이상이면 2순위도 받는다. */
  activityCount: number;
  prize: string;
  prizeOther: string;
};

/** 신청 폼의 입력 오류를 항목별 문구로 돌려준다. */
export function validateApplication(draft: ApplicationDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = "이름을 입력하세요.";
  if (!/^[0-9]{6,12}$/.test(draft.studentId.trim())) errors.studentId = "학번을 숫자로 입력하세요.";
  if (!draft.cohort.trim()) errors.cohort = "기수를 입력하세요.";
  if (!draft.major.trim()) errors.major = "학과를 입력하세요.";
  if (draft.dates.length === 0) errors.dates = "참여 희망 날짜를 하나 이상 고르세요.";
  if (draft.activityCount > 0 && !draft.firstChoice) errors.firstChoice = "1순위 테마를 고르세요.";
  if (draft.activityCount > 1 && !draft.secondChoice) errors.secondChoice = "2순위 테마를 고르세요.";
  if (draft.secondChoice && draft.secondChoice === draft.firstChoice) errors.secondChoice = "1순위와 다른 테마를 고르세요.";
  if (draft.prize === OTHER_PRIZE && !draft.prizeOther.trim()) errors.prize = "원하는 상품을 적어 주세요.";
  return errors;
}

/** 고른 이벤트 상품을 저장할 값으로 바꾼다. 기타는 '기타: 내용'으로 저장한다. */
export function prizeValue(prize: string, other: string): string {
  return prize === OTHER_PRIZE ? `${OTHER_PRIZE_PREFIX}${other.trim()}` : prize;
}

/** 공지의 **굵게** 표시를 나눈다. 홀수 번째 조각이 굵은 글씨다. */
export function noticeSegments(line: string): { text: string; bold: boolean }[] {
  return line
    .split("**")
    .map((text, index) => ({ text, bold: index % 2 === 1 }))
    .filter((segment) => segment.text !== "");
}

/** 시즌1처럼 희망 횟수와 음주 여부를 받은 신청이 있는지 본다. */
export function hasLegacyAnswers(applications: CaptureApplication[]): boolean {
  return applications.some((item) => item.participation !== "" || item.drinking !== "");
}

/** 1·2순위를 받은 신청이 있는지 본다. */
export function hasRankedAnswers(applications: CaptureApplication[]): boolean {
  return applications.some((item) => item.firstChoice !== "");
}
