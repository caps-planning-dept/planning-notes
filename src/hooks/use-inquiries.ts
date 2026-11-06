import { useCallback, useEffect, useMemo, useState } from "react";
import type { Inquiry, InquiryStatus } from "@/lib/inquiry";
import { createClient } from "@/lib/supabase/client";

type InquiryRow = {
  id: string;
  author_id: string | null;
  title: string;
  body: string;
  status: InquiryStatus;
  created_at: string;
};

function toInquiry(row: InquiryRow): Inquiry {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** 볼 수 있는 범위는 DB 권한이 정한다. 관리자는 전체, 멤버는 자기 문의만 받는다. */
export function useInquiries(workspaceId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [error, setError] = useState("");

  const fetchInquiries = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("inquiries")
      .select("id, author_id, title, body, status, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (fetchError) {
      setError("문의를 불러오지 못했습니다. 새로고침해 주세요.");
    } else {
      setInquiries((data as InquiryRow[]).map(toInquiry));
    }
    setLoaded(true);
  }, [supabase, workspaceId]);

  useEffect(() => {
    Promise.resolve().then(fetchInquiries);
  }, [fetchInquiries]);

  async function submit(title: string, body: string): Promise<boolean> {
    setError("");
    const { error: insertError } = await supabase
      .from("inquiries")
      .insert({ workspace_id: workspaceId, title: title.trim(), body: body.trim() });
    if (insertError) {
      setError("문의를 보내지 못했습니다. 다시 시도해 주세요.");
      return false;
    }
    await fetchInquiries();
    return true;
  }

  async function setStatus(id: string, status: InquiryStatus) {
    setError("");
    const { error: updateError } = await supabase.from("inquiries").update({ status }).eq("id", id);
    if (updateError) {
      setError("상태를 바꾸지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    await fetchInquiries();
  }

  /** 관리자만 지울 수 있다. 권한이 없으면 DB가 0건을 지우므로 돌려받은 행으로 확인한다. */
  async function remove(id: string) {
    setError("");
    const { data, error: deleteError } = await supabase.from("inquiries").delete().eq("id", id).select("id");
    if (deleteError || data.length === 0) {
      setError("문의를 삭제하지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    await fetchInquiries();
  }

  return { loaded, inquiries, error, submit, setStatus, remove };
}
