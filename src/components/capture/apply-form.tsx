"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DRINKING_OPTIONS,
  formatRoundDate,
  PARTICIPATION_OPTIONS,
  validateApplication,
} from "@/lib/capture";
import { createClient } from "@/lib/supabase/client";

type ApplyFormProps = { token: string; title: string; dates: string[]; activities: string[] };

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

export function ApplyForm({ token, title, dates, activities }: ApplyFormProps) {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [cohort, setCohort] = useState("");
  const [major, setMajor] = useState("");
  const [teammate, setTeammate] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [participation, setParticipation] = useState("");
  const [drinking, setDrinking] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [otherActivity, setOtherActivity] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitError("");
    const found = validateApplication({
      name,
      studentId,
      cohort,
      major,
      dates: selectedDates,
      participation,
      drinking,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // 사람에게 보이지 않는 칸이 채워져 있으면 자동 등록으로 보고 저장하지 않는다.
    if (website) {
      setDone(true);
      return;
    }

    setSubmitting(true);
    const { error } = await createClient().rpc("submit_capture_application", {
      token,
      applicant_name: name,
      applicant_student_id: studentId,
      applicant_cohort: cohort,
      applicant_major: major,
      applicant_teammate: teammate,
      selected_dates: selectedDates,
      selected_participation: participation,
      selected_drinking: drinking,
      selected_activities: selectedActivities,
      applicant_other_activity: otherActivity,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError("신청을 저장하지 못했습니다. 마감 여부를 확인하고 다시 시도해 주세요.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="flex min-h-full items-center justify-center bg-secondary p-4">
        <div className="flex w-full max-w-md flex-col gap-3 bg-background p-8">
          <h1 className="font-display text-3xl">신청했습니다</h1>
          <p className="text-muted-foreground">날짜나 활동을 더하고 싶다면 다시 신청해 주세요. 앞선 신청에 더해집니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-secondary p-4">
      <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-xl flex-col gap-6 bg-background p-6 md:p-8">
        <h1 className="font-display text-3xl">{title || "캡처"} 신청</h1>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="apply-name">이름</Label>
            <Input id="apply-name" value={name} aria-invalid={Boolean(errors.name)} onChange={(e) => setName(e.target.value)} />
            <FieldError message={errors.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apply-student-id">학번</Label>
            <Input id="apply-student-id" inputMode="numeric" value={studentId} aria-invalid={Boolean(errors.studentId)} onChange={(e) => setStudentId(e.target.value)} />
            <FieldError message={errors.studentId} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apply-cohort">기수</Label>
            <Input id="apply-cohort" placeholder="예: 40.5기" className="placeholder:text-muted-foreground/60" value={cohort} aria-invalid={Boolean(errors.cohort)} onChange={(e) => setCohort(e.target.value)} />
            <FieldError message={errors.cohort} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apply-major">전공</Label>
            <Input id="apply-major" placeholder="예: 컴퓨터AI학부" className="placeholder:text-muted-foreground/60" value={major} aria-invalid={Boolean(errors.major)} onChange={(e) => setMajor(e.target.value)} />
            <FieldError message={errors.major} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="apply-teammate">함께 조를 하고 싶은 사람 (선택)</Label>
          <Input id="apply-teammate" value={teammate} onChange={(e) => setTeammate(e.target.value)} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">참여 희망 날짜 (복수 선택)</legend>
          {dates.map((date) => (
            <label key={date} className="flex min-h-9 items-center gap-2">
              <input type="checkbox" className="size-4" checked={selectedDates.includes(date)} onChange={() => setSelectedDates(toggle(selectedDates, date))} />
              {formatRoundDate(date)}
            </label>
          ))}
          <FieldError message={errors.dates} />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">희망 참여 횟수</legend>
          {PARTICIPATION_OPTIONS.map((option) => (
            <label key={option} className="flex min-h-9 items-center gap-2">
              <input type="radio" name="participation" className="size-4" checked={participation === option} onChange={() => setParticipation(option)} />
              {option}
            </label>
          ))}
          <FieldError message={errors.participation} />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">음주 여부</legend>
          {DRINKING_OPTIONS.map((option) => (
            <label key={option} className="flex min-h-9 items-center gap-2">
              <input type="radio" name="drinking" className="size-4" checked={drinking === option} onChange={() => setDrinking(option)} />
              {option}
            </label>
          ))}
          <FieldError message={errors.drinking} />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">하고 싶은 활동 (선택, 복수 선택)</legend>
          <p className="mb-1 text-sm text-muted-foreground">같은 활동을 희망하는 사람끼리 우선 배정할 수 있으며, 상황에 따라 배정되지 않을 수 있습니다.</p>
          {activities.map((activity) => (
            <label key={activity} className="flex min-h-9 items-center gap-2">
              <input type="checkbox" className="size-4" checked={selectedActivities.includes(activity)} onChange={() => setSelectedActivities(toggle(selectedActivities, activity))} />
              {activity}
            </label>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <Label htmlFor="apply-other">기타</Label>
            <Input id="apply-other" value={otherActivity} onChange={(e) => setOtherActivity(e.target.value)} />
          </div>
        </fieldset>

        <div aria-hidden className="absolute -left-[9999px]">
          <label>
            웹사이트
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <p className="rounded-md bg-secondary p-4 text-sm leading-relaxed">
          입력한 내용은 캡처 조 편성과 안내에만 쓰며, 지정된 기획부 담당자만 확인합니다. 해당 회차가 끝나면 삭제합니다.
        </p>

        {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
        <Button type="submit" disabled={submitting} className="chamfer h-11 rounded-none">
          {submitting ? "신청하는 중" : "신청하기"}
        </Button>
      </form>
    </main>
  );
}
