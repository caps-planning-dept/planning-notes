-- 캡처 신청 폼의 질문 문장과 질문별 보충 설명을 회차마다 고칠 수 있게 한다.
-- 형식: {"name": {"label": "...", "help": "..."}, ...}. 비어 있으면 앱의 기본 문장을 쓴다.
-- 상품 안내(prize_note)는 이벤트 상품 질문의 보충 설명으로 옮긴다. 배포 전 사이트가 읽도록 열은 남긴다.

alter table public.capture_rounds
  add column questions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(questions) = 'object' and octet_length(questions::text) <= 20000);

update public.capture_rounds
set questions = jsonb_build_object('prize', jsonb_build_object('help', prize_note))
where prize_note <> '';

grant update (questions) on public.capture_rounds to authenticated;

create or replace function public.get_capture_form(token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', t.title,
    'notice', r.notice,
    'questions', r.questions,
    'dates', r.dates,
    'activities', r.activities,
    'prizes', r.prizes,
    'prizeNote', r.prize_note,
    'closesAt', r.closes_at,
    'isOpen', r.is_open and (r.closes_at is null or r.closes_at > now())
  )
  from public.capture_rounds r
  join public.tabs t on t.id = r.tab_id
  where r.public_token = token and t.deleted_at is null;
$$;
