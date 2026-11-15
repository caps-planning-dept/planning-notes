-- 캡처 신청 고치기: 신청자가 날짜나 선택을 바꿔 달라고 하면 탭을 볼 수 있는 사람(관리자, 열람자)이 고친다.
-- 신청 시간과 시즌1 항목(희망 횟수, 음주 여부, 희망 활동)은 고치지 않는다.
-- 더하기만 하는 변경이다.

grant update (name, student_id, cohort, major, preferred_teammate, dates, first_choice, second_choice, prize)
  on public.capture_applications to authenticated;

create policy "열람자는 신청을 고친다" on public.capture_applications
  for update to authenticated
  using (private.can_view_capture(tab_id))
  with check (private.can_view_capture(tab_id));
