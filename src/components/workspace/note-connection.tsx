"use client";

import { LiveblocksProvider, useClient } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Member } from "@/hooks/use-workspace";
import { cursorColor, noteRoomId } from "@/lib/collaboration";

async function authorize(room?: string) {
  const response = await fetch("/api/liveblocks-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room }),
  });
  return response.json();
}

type NoteConnectionProps = { userId: string; members: Member[]; children: ReactNode };

/**
 * 동시 편집 연결을 작업 공간 전체에서 하나만 만든다.
 * 노트를 열 때마다 새로 만들지 않으므로, 받아 둔 입장 권한과 미리 연결한 방을 다시 쓸 수 있다.
 */
export function NoteConnection({ userId, members, children }: NoteConnectionProps) {
  // 답글 이름을 다시 찾기 전에 최신 목록이 준비되도록 화면 반영 직전에 바꾼다.
  const membersRef = useRef(members);
  useLayoutEffect(() => {
    membersRef.current = members;
  }, [members]);

  // 답글에는 사용자 번호만 저장되므로, 화면에 보일 이름은 멤버 목록에서 찾는다.
  const resolveUsers = useCallback(({ userIds }: { userIds: string[] }) => {
    return userIds.map((id) => {
      const member = membersRef.current.find((item) => item.userId === id);
      // Google 프로필 사진은 다른 사이트에서 깨지는 일이 있어 이름 첫 글자로 표시한다.
      return { name: member?.displayName ?? "이전 멤버", color: cursorColor(id) };
    });
  }, []);

  return (
    <LiveblocksProvider authEndpoint={authorize} resolveUsers={resolveUsers}>
      <NameSync userId={userId} members={members} />
      {children}
    </LiveblocksProvider>
  );
}

/** 멤버 이름이 바뀌면 답글 이름을 다시 찾고, 내 이름이 바뀌면 새 이름이 담긴 입장 권한을 다시 받는다. */
function NameSync({ userId, members }: { userId: string; members: Member[] }) {
  const client = useClient();
  const names = members.map((member) => `${member.userId}:${member.displayName}`).join();
  const myName = members.find((member) => member.userId === userId)?.displayName;
  const lastName = useRef(myName);

  useEffect(() => {
    client.resolvers.invalidateUsers();
  }, [client, names]);

  useEffect(() => {
    // 커서 이름은 입장 권한에 담겨 있으므로, 받아 둔 권한을 버리면 열린 노트가 새 이름으로 다시 연결된다.
    if (lastName.current !== undefined && myName !== undefined && lastName.current !== myName) client.logout();
    lastName.current = myName;
  }, [client, myName]);

  return null;
}

/** 미리 연결한 노트를 열지 않으면 이 시간 뒤에 연결을 끊는다. */
const PRELOAD_MS = 30_000;

/**
 * 미리 연결해 둔 방. 목록 줄 하나가 사라져도 연결이 끊기지 않도록 화면 밖에 둔다.
 * 누르는 순간 목록 줄이 사라지면, 노트가 같은 방에 들어가기 전에 연결이 끊길 수 있기 때문이다.
 */
const preloaded = new Map<string, { leave: () => void; timer: ReturnType<typeof setTimeout> }>();

/**
 * 노트에 마우스를 올리거나 키보드로 고르면, 누르기 전에 미리 입장해 내용을 받아 둔다.
 * 실제로 노트를 열면 같은 방을 이어서 쓰므로 기다리는 시간이 줄어든다.
 */
export function usePreloadNote() {
  const client = useClient();

  return useCallback(
    (tabId: string) => {
      const roomId = noteRoomId(tabId);
      const release = () => {
        preloaded.get(roomId)?.leave();
        preloaded.delete(roomId);
      };
      const existing = preloaded.get(roomId);
      if (existing) {
        clearTimeout(existing.timer);
        existing.timer = setTimeout(release, PRELOAD_MS);
        return;
      }
      const { room, leave } = client.enterRoom(roomId);
      // 편집기가 쓰는 것과 같은 공유 문서를 만들어 내용 받기를 시작한다.
      getYjsProviderForRoom(room);
      preloaded.set(roomId, { leave, timer: setTimeout(release, PRELOAD_MS) });
    },
    [client],
  );
}
