import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Invitation = { id: string; createdAt: string; expiresAt: string };

type InvitationRow = { id: string; created_at: string; expires_at: string };

/** 관리자가 아직 유효한 초대 링크를 보고 취소한다. 링크 원문은 저장되지 않아 목록에 나오지 않는다. */
export function useInvitations(workspaceId: string, isAdmin: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error: failure } = await supabase
      .from("invitations")
      .select("id, created_at, expires_at")
      .eq("workspace_id", workspaceId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (failure) {
      setError("초대 링크 목록을 불러오지 못했습니다.");
      return;
    }
    setInvitations(
      (data as InvitationRow[]).map((row) => ({ id: row.id, createdAt: row.created_at, expiresAt: row.expires_at })),
    );
  }, [supabase, workspaceId, isAdmin]);

  useEffect(() => {
    Promise.resolve().then(refresh);
  }, [refresh]);

  async function revoke(id: string) {
    setError("");
    const { error: failure } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (failure) {
      setError("초대 링크를 취소하지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    await refresh();
  }

  return { invitations, error, refresh, revoke };
}
