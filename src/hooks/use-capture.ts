import { useCallback, useEffect, useMemo, useState } from "react";
import { type CaptureApplication, type CaptureRound, type CaptureTeam, readQuestions } from "@/lib/capture";
import { createClient } from "@/lib/supabase/client";

type RoundRow = {
  tab_id: string;
  public_token: string;
  is_open: boolean;
  closes_at: string | null;
  dates: string[];
  activities: string[];
  notice: string;
  prizes: string[];
  questions: unknown;
};

type ApplicationRow = {
  id: string;
  name: string;
  student_id: string;
  cohort: string;
  major: string;
  preferred_teammate: string;
  dates: string[];
  participation: string;
  drinking: string;
  activities: string[];
  other_activity: string;
  first_choice: string;
  second_choice: string;
  prize: string;
  created_at: string;
};

type TeamRow = {
  id: string;
  event_date: string;
  activity: string;
  application_ids: string[];
  leader_application_id: string | null;
  note: string;
  created_at: string;
};

const ROUND_RETRY_MS = 1000;

function toApplication(row: ApplicationRow): CaptureApplication {
  return {
    id: row.id,
    name: row.name,
    studentId: row.student_id,
    cohort: row.cohort,
    major: row.major,
    preferredTeammate: row.preferred_teammate,
    dates: row.dates,
    participation: row.participation,
    drinking: row.drinking,
    activities: row.activities,
    otherActivity: row.other_activity,
    firstChoice: row.first_choice,
    secondChoice: row.second_choice,
    prize: row.prize,
    createdAt: row.created_at,
  };
}

const toTeam = (row: TeamRow): CaptureTeam => ({
  id: row.id,
  eventDate: row.event_date,
  activity: row.activity,
  applicationIds: row.application_ids,
  leaderId: row.leader_application_id,
  note: row.note,
  createdAt: row.created_at,
});

export function useCapture(tabId: string, isAdmin: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [round, setRound] = useState<CaptureRound | null>(null);
  const [applications, setApplications] = useState<CaptureApplication[]>([]);
  const [teams, setTeams] = useState<CaptureTeam[]>([]);
  const [error, setError] = useState("");

  const report = useCallback((failure: { message: string } | null) => {
    if (failure) setError("저장하지 못한 변경이 있습니다. 새로고침 후 다시 시도해 주세요.");
  }, []);

  const fetchRound = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from("capture_rounds")
      .select("tab_id, public_token, is_open, closes_at, dates, activities, notice, prizes, questions")
      .eq("tab_id", tabId)
      .maybeSingle();
    if (failure) return report(failure);
    const row = data as RoundRow | null;
    setRound(
      row && {
        tabId: row.tab_id,
        publicToken: row.public_token,
        isOpen: row.is_open,
        closesAt: row.closes_at,
        dates: row.dates,
        activities: row.activities,
        notice: row.notice,
        prizes: row.prizes,
        questions: readQuestions(row.questions),
      },
    );
  }, [supabase, tabId, report]);

  const fetchApplications = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from("capture_applications")
      .select("id, name, student_id, cohort, major, preferred_teammate, dates, participation, drinking, activities, other_activity, first_choice, second_choice, prize, created_at")
      .eq("tab_id", tabId)
      .order("created_at");
    if (failure) return report(failure);
    setApplications((data as ApplicationRow[]).map(toApplication));
  }, [supabase, tabId, report]);

  const fetchTeams = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from("capture_teams")
      .select("id, event_date, activity, application_ids, leader_application_id, note, created_at")
      .eq("tab_id", tabId)
      .order("created_at");
    if (failure) return report(failure);
    setTeams((data as TeamRow[]).map(toTeam));
  }, [supabase, tabId, report]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => Promise.all([fetchRound(), fetchApplications(), fetchTeams()]))
      .then(() => {
        if (!cancelled) setLoaded(true);
      });
    const filter = `tab_id=eq.${tabId}`;
    const channel = supabase
      .channel(`capture:${tabId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "capture_rounds", filter }, fetchRound)
      .on("postgres_changes", { event: "*", schema: "public", table: "capture_applications", filter }, fetchApplications)
      .on("postgres_changes", { event: "*", schema: "public", table: "capture_teams", filter }, fetchTeams)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, tabId, fetchRound, fetchApplications, fetchTeams]);

  // 새 캡처 탭은 저장이 끝나기 전에 화면이 먼저 열리므로, 회차가 보일 때까지 다시 조회한다.
  useEffect(() => {
    if (!loaded || round) return;
    const timer = setInterval(fetchRound, ROUND_RETRY_MS);
    return () => clearInterval(timer);
  }, [loaded, round, fetchRound]);

  return {
    loaded,
    isAdmin,
    round,
    applications,
    teams,
    error,
    updateRound(
      change: Partial<Pick<CaptureRound, "isOpen" | "closesAt" | "dates" | "activities" | "notice" | "prizes" | "questions">>,
    ) {
      setRound((current) => current && { ...current, ...change });
      supabase
        .from("capture_rounds")
        .update({
          ...("isOpen" in change ? { is_open: change.isOpen } : {}),
          ...("closesAt" in change ? { closes_at: change.closesAt } : {}),
          ...("dates" in change ? { dates: change.dates } : {}),
          ...("activities" in change ? { activities: change.activities } : {}),
          ...("notice" in change ? { notice: change.notice } : {}),
          ...("prizes" in change ? { prizes: change.prizes } : {}),
          ...("questions" in change ? { questions: change.questions } : {}),
        })
        .eq("tab_id", tabId)
        .then(({ error: failure }) => report(failure));
    },
    addTeam(eventDate: string, activity: string, applicationIds: string[], note: string) {
      const id = crypto.randomUUID();
      const leaderId = applicationIds[0] ?? null;
      const createdAt = new Date().toISOString();
      setTeams((current) => [...current, { id, eventDate, activity, applicationIds, leaderId, note, createdAt }]);
      supabase
        .from("capture_teams")
        .insert({
          id,
          tab_id: tabId,
          event_date: eventDate,
          activity,
          application_ids: applicationIds,
          leader_application_id: leaderId,
          note,
          created_at: createdAt,
        })
        .then(({ error: failure }) => report(failure));
      return id;
    },
    setTeamMembers(teamId: string, applicationIds: string[], leaderId: string | null) {
      setTeams((current) =>
        current.map((team) => (team.id === teamId ? { ...team, applicationIds, leaderId } : team)),
      );
      supabase
        .from("capture_teams")
        .update({ application_ids: applicationIds, leader_application_id: leaderId })
        .eq("id", teamId)
        .then(({ error: failure }) => report(failure));
    },
    deleteTeam(teamId: string) {
      setTeams((current) => current.filter((team) => team.id !== teamId));
      supabase
        .from("capture_teams")
        .delete()
        .eq("id", teamId)
        .then(({ error: failure }) => report(failure));
    },
    /** 신청을 지우면 조는 이름 없이 남아 쓸모가 없으므로 함께 지운다. */
    deleteAllApplications() {
      setApplications([]);
      setTeams([]);
      for (const table of ["capture_applications", "capture_teams"] as const) {
        supabase
          .from(table)
          .delete()
          .eq("tab_id", tabId)
          .then(({ error: failure }) => report(failure));
      }
    },
  };
}

export type Capture = ReturnType<typeof useCapture>;
