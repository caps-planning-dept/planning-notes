"use client";

import { Copy, UserPlus, UserX, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInvitations } from "@/hooks/use-invitations";
import type { Member, Workspace } from "@/hooks/use-workspace";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatTime = (value: string | null) => (value ? dateFormat.format(new Date(value)) : "기록 없음");

type MembersViewProps = { workspace: Workspace; workspaceId: string; userId: string; isAdmin: boolean };

export function MembersView({ workspace, workspaceId, userId, isAdmin }: MembersViewProps) {
  const { invitations, error: inviteError, refresh, revoke } = useInvitations(workspaceId, isAdmin);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  async function createLink() {
    setCopied(false);
    const token = await workspace.createInvitation();
    if (token) setInviteLink(`${window.location.origin}/invite/${token}`);
    await refresh();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-5 overflow-y-auto p-6">
      <h1 className="font-display text-4xl">멤버</h1>

      {isAdmin && (
        <section className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">초대 링크는 7일 뒤 만료되며, 만들 때 한 번만 표시됩니다.</p>
            <Button className="chamfer rounded-none" onClick={createLink}>
              <UserPlus data-icon="inline-start" />
              초대 링크 만들기
            </Button>
          </div>
          {inviteLink && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                aria-label="초대 링크"
                value={inviteLink}
                className="h-9 min-w-0 flex-1 rounded-md border bg-secondary px-2 text-sm"
              />
              <Button variant="outline" onClick={copyLink}>
                <Copy data-icon="inline-start" />
                {copied ? "복사했습니다" : "복사"}
              </Button>
            </div>
          )}
          {inviteError && <p role="alert" className="text-sm text-destructive">{inviteError}</p>}
          {invitations.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">아직 유효한 초대 링크 {invitations.length}개</h2>
              <ul className="flex flex-col divide-y border-y">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-muted-foreground">
                      {formatTime(invitation.createdAt)} 생성 · {formatTime(invitation.expiresAt)} 만료
                    </span>
                    <Button variant="outline" onClick={() => revoke(invitation.id)}>
                      <X data-icon="inline-start" />
                      취소
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <ul className="flex flex-col divide-y border-y">
        {workspace.members.map((member) => {
          const online = workspace.onlineIds.includes(member.userId);
          return (
            <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {member.displayName}
                  {member.role === "admin" && (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-normal">관리자</span>
                  )}
                  {online && <span className="text-xs font-normal text-[#2f7d32]">접속 중</span>}
                </p>
                <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                <p className="text-sm text-muted-foreground">
                  최근 로그인 {formatTime(member.lastSignInAt)} · 최근 활동 {formatTime(member.lastActiveAt)}
                </p>
              </div>
              {isAdmin && member.userId !== userId && (
                <Button variant="outline" onClick={() => setRemoving(member)}>
                  <UserX data-icon="inline-start" />
                  내보내기
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{removing?.displayName} 님을 내보낼까요?</DialogTitle>
            <DialogDescription>
              내보내면 바로 탭과 일정을 볼 수 없게 됩니다. 아직 유효한 초대 링크가 있으면 다시 들어올 수 있으니 함께 취소해 주세요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) workspace.removeMember(removing.userId);
                setRemoving(null);
              }}
            >
              내보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
