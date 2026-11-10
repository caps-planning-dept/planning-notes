"use client";

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
import type { Member, Workspace } from "@/hooks/use-workspace";
import {
  blockedByParent,
  canManageTab,
  needsHandover,
  restrictedAncestor,
} from "@/lib/tab-access";
import { cn } from "@/lib/utils";
import type { Tab } from "@/lib/workspace";

type ViewersDialogProps = {
  tab: Tab;
  workspace: Workspace;
  userId: string;
  open: boolean;
  onClose: () => void;
};

export function ViewersDialog({ tab, workspace, userId, open, onClose }: ViewersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {open && <ViewersForm tab={tab} workspace={workspace} userId={userId} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

/** 마지막 설정 가능자가 빠질 때, 넘긴 뒤에 할 일 */
type Pending = { kind: "leave" } | { kind: "unmanage" };

function ViewersForm({ tab, workspace, userId, onClose }: Omit<ViewersDialogProps, "open">) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { tabs, tabViewers, members } = workspace;
  const me = members.find((member) => member.userId === userId);
  if (!me) return null;

  const isCapture = tab.template === "capture";
  const manageable = canManageTab(tab, tabViewers, me);
  const ancestor = restrictedAncestor(tabs, tab.id);
  const rowOf = (memberId: string) => tabViewers.find((item) => item.tabId === tab.id && item.userId === memberId);
  const blocked = (member: Member) => blockedByParent(tabs, tabViewers, tab.id, member);
  const title = tab.title || "제목 없음";

  async function run(action: () => Promise<boolean>) {
    setBusy(true);
    setFailed(false);
    const ok = await action();
    setBusy(false);
    if (!ok) setFailed(true);
    return ok;
  }

  /** 본인을 빼거나 본인의 설정 권한을 거둔다. 마지막 설정 가능자면 먼저 넘길 사람을 고르게 한다. */
  async function selfChange(next: Pending) {
    if (needsHandover(tab, tabViewers, members, me!, userId, next.kind)) {
      setPending(next);
      return;
    }
    await applySelfChange(next);
  }

  async function applySelfChange(next: Pending) {
    const ok = await run(() =>
      next.kind === "leave"
        ? workspace.setTabViewer(tab.id, userId, false)
        : workspace.setTabManager(tab.id, userId, false),
    );
    // 열람자에서 빠지면 이 탭을 더 볼 수 없으므로 창을 닫는다.
    if (ok && next.kind === "leave" && tab.viewersOnly) onClose();
  }

  async function handOver(successorId: string) {
    if (!pending) return;
    // 캡처 탭은 관리자만 설정하므로, 다른 관리자를 열람자로 넣는 것이 넘기기다.
    const ok = await run(() =>
      isCapture
        ? workspace.setTabViewer(tab.id, successorId, true)
        : workspace.setTabManager(tab.id, successorId, true),
    );
    if (!ok) return;
    const next = pending;
    setPending(null);
    await applySelfChange(next);
  }

  if (pending) {
    const candidates = members.filter(
      (member) => member.userId !== userId && (!isCapture || member.role === "admin") && !blocked(member),
    );
    return (
      <div className="flex flex-col gap-5">
        <DialogHeader>
          <DialogTitle>설정 권한 넘기기</DialogTitle>
          <DialogDescription>
            {title} 탭의 열람자를 바꿀 수 있는 사람이 나뿐입니다. 먼저 넘겨받을 멤버를 고르세요. 넘긴 뒤
            {pending.kind === "leave" ? " 나를 열람자에서 뺍니다." : " 내 설정 권한을 거둡니다."}
          </DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            넘겨받을 수 있는 멤버가 없습니다.
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {candidates.map((member) => (
              <li key={member.userId}>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={busy}
                  onClick={() => handOver(member.userId)}
                >
                  {member.displayName}에게 넘기기
                </Button>
              </li>
            ))}
          </ul>
        )}
        {failed && <p className="text-sm text-destructive">저장하지 못했습니다. 다시 시도해 주세요.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setPending(null)}>
            돌아가기
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const description = isCapture
    ? "캡처 탭은 신청자 학번이 있어 체크한 사람만 봅니다. 관리자도 체크해야 봅니다. 열람자는 관리자만 바꿀 수 있습니다."
    : manageable
      ? "바꾸면 바로 저장됩니다. 지정한 멤버만 볼 때는 관리자도 체크해야 봅니다."
      : "열람자는 관리자와 설정 가능한 멤버가 바꿀 수 있습니다.";

  const selfRow = rowOf(userId);
  const canLeave = tab.viewersOnly && me.role !== "admin" && selfRow !== undefined;

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>열람자 설정</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {!isCapture && (
        <fieldset className="flex flex-col gap-1" disabled={!manageable || busy}>
          <legend className="mb-2 text-sm font-medium">볼 수 있는 사람</legend>
          {[
            { value: false, label: "모든 멤버" },
            { value: true, label: "지정한 멤버만" },
          ].map((option) => (
            <label
              key={String(option.value)}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-md px-2 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring",
                manageable && "cursor-pointer",
                tab.viewersOnly === option.value ? "bg-muted font-medium" : manageable && "hover:bg-muted/60",
              )}
            >
              <input
                type="radio"
                name="viewers-only"
                className="size-4"
                checked={tab.viewersOnly === option.value}
                onChange={() => run(() => workspace.setTabViewersOnly(tab.id, option.value))}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      )}

      {ancestor && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          상위 탭 「{ancestor.title || "제목 없음"}」을 볼 수 없는 멤버는 이 탭도 볼 수 없습니다.
        </p>
      )}

      <section className="flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <span className="flex-1">멤버</span>
          {tab.viewersOnly && <span className="w-16 text-center">볼 수 있음</span>}
          {!isCapture && <span className="w-16 text-center">설정 가능</span>}
        </div>
        <ul className="flex max-h-72 flex-col overflow-y-auto">
          {members.map((member) => {
            const row = rowOf(member.userId);
            const self = member.userId === userId;
            const isMemberAdmin = member.role === "admin";
            const isBlocked = !isMemberAdmin && blocked(member);
            const note = isBlocked ? "상위 탭을 볼 수 없음" : isMemberAdmin ? "관리자" : null;
            const editable = manageable && !isBlocked && !busy;
            return (
              <li key={member.userId} className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {member.displayName}
                  {self && <span className="text-muted-foreground"> (나)</span>}
                  {note && <span className="block text-xs text-muted-foreground">{note}</span>}
                </span>
                {tab.viewersOnly && (
                  <span className="flex w-16 justify-center">
                    <input
                      type="checkbox"
                      className="size-4"
                      aria-label={`${member.displayName} 볼 수 있음`}
                      checked={!isBlocked && row !== undefined}
                      disabled={!editable}
                      onChange={(event) => {
                        if (!event.target.checked && self) return selfChange({ kind: "leave" });
                        run(() => workspace.setTabViewer(tab.id, member.userId, event.target.checked));
                      }}
                    />
                  </span>
                )}
                {!isCapture && (
                  <span className="flex w-16 justify-center">
                    <input
                      type="checkbox"
                      className="size-4"
                      aria-label={`${member.displayName} 설정 가능`}
                      checked={isMemberAdmin || row?.canManage === true}
                      disabled={!editable || isMemberAdmin}
                      title={isMemberAdmin ? "관리자는 볼 수 있는 탭의 설정을 언제나 바꿀 수 있습니다" : undefined}
                      onChange={(event) => {
                        if (!event.target.checked && self) return selfChange({ kind: "unmanage" });
                        run(() => workspace.setTabManager(tab.id, member.userId, event.target.checked));
                      }}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {failed && <p className="text-sm text-destructive">저장하지 못했습니다. 다시 시도해 주세요.</p>}

      <DialogFooter>
        {canLeave && !manageable && (
          <Button variant="outline" disabled={busy} onClick={() => selfChange({ kind: "leave" })}>
            나를 열람자에서 빼기
          </Button>
        )}
        <Button className="chamfer rounded-none" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </div>
  );
}
