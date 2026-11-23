import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cleanQuestions,
  type FormResponse,
  type FormSettings,
  readFormAnswers,
  readFormQuestions,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/client";

type SettingsRow = {
  tab_id: string;
  public_token: string;
  is_open: boolean;
  closes_at: string | null;
  capacity: number | null;
  notice: string;
  questions: unknown;
};

type ResponseRow = { id: string; answers: unknown; created_at: string };

const SETTINGS_RETRY_MS = 1000;

export type SettingsChange = Partial<Pick<FormSettings, "isOpen" | "closesAt" | "capacity" | "notice" | "questions">>;

/** 신청폼 탭의 설정과 응답. 다른 사람이 바꾸면 바로 반영한다. */
export function useForm(tabId: string, isAdmin: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<FormSettings | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [error, setError] = useState("");

  const report = useCallback((failure: { message: string } | null) => {
    if (failure) setError("저장하지 못한 변경이 있습니다. 새로고침 후 다시 시도해 주세요.");
  }, []);

  const fetchSettings = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from("form_settings")
      .select("tab_id, public_token, is_open, closes_at, capacity, notice, questions")
      .eq("tab_id", tabId)
      .maybeSingle();
    if (failure) return report(failure);
    const row = data as SettingsRow | null;
    setSettings(
      row && {
        tabId: row.tab_id,
        publicToken: row.public_token,
        isOpen: row.is_open,
        closesAt: row.closes_at,
        capacity: row.capacity,
        notice: row.notice,
        questions: readFormQuestions(row.questions),
      },
    );
  }, [supabase, tabId, report]);

  const fetchResponses = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from("form_responses")
      .select("id, answers, created_at")
      .eq("tab_id", tabId)
      .order("created_at");
    if (failure) return report(failure);
    setResponses(
      (data as ResponseRow[]).map((row) => ({
        id: row.id,
        answers: readFormAnswers(row.answers),
        createdAt: row.created_at,
      })),
    );
  }, [supabase, tabId, report]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => Promise.all([fetchSettings(), fetchResponses()]))
      .then(() => {
        if (!cancelled) setLoaded(true);
      });
    const filter = `tab_id=eq.${tabId}`;
    const channel = supabase
      .channel(`form:${tabId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "form_settings", filter }, fetchSettings)
      .on("postgres_changes", { event: "*", schema: "public", table: "form_responses", filter }, fetchResponses)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, tabId, fetchSettings, fetchResponses]);

  // 새 신청폼 탭은 저장이 끝나기 전에 화면이 먼저 열리므로, 설정이 보일 때까지 다시 조회한다.
  useEffect(() => {
    if (!loaded || settings) return;
    const timer = setInterval(fetchSettings, SETTINGS_RETRY_MS);
    return () => clearInterval(timer);
  }, [loaded, settings, fetchSettings]);

  return {
    loaded,
    isAdmin,
    settings,
    responses,
    error,
    updateSettings(change: SettingsChange) {
      const questions = change.questions && cleanQuestions(change.questions);
      setSettings((current) => current && { ...current, ...change, ...(questions ? { questions } : {}) });
      supabase
        .from("form_settings")
        .update({
          ...("isOpen" in change ? { is_open: change.isOpen } : {}),
          ...("closesAt" in change ? { closes_at: change.closesAt } : {}),
          ...("capacity" in change ? { capacity: change.capacity } : {}),
          ...("notice" in change ? { notice: change.notice } : {}),
          ...(questions ? { questions } : {}),
        })
        .eq("tab_id", tabId)
        .then(({ error: failure }) => report(failure));
    },
    deleteResponse(id: string) {
      setResponses((current) => current.filter((item) => item.id !== id));
      supabase
        .from("form_responses")
        .delete()
        .eq("id", id)
        .then(({ error: failure }) => report(failure));
    },
    deleteAllResponses() {
      setResponses([]);
      supabase
        .from("form_responses")
        .delete()
        .eq("tab_id", tabId)
        .then(({ error: failure }) => report(failure));
    },
  };
}

export type FormTab = ReturnType<typeof useForm>;
