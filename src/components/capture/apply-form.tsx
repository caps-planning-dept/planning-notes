"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRoundDate, OTHER_PRIZE, prizeValue, validateApplication } from "@/lib/capture";
import { createClient } from "@/lib/supabase/client";
import { CaptureNotice } from "./capture-notice";

type ApplyFormProps = {
  token: string;
  title: string;
  notice: string;
  dates: string[];
  activities: string[];
  prizes: string[];
  prizeNote: string;
};

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

type ChoiceGroupProps = {
  legend: string;
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabledOption?: string;
  disabledHint?: string;
  error?: string;
};

function ChoiceGroup({ legend, name, options, value, onChange, disabledOption, disabledHint, error }: ChoiceGroupProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">{legend}</legend>
      {options.map((option) => {
        const disabled = option === disabledOption;
        return (
          <label key={option} className={`flex min-h-9 items-center gap-2 ${disabled ? "text-muted-foreground" : ""}`}>
            <input
              type="radio"
              name={name}
              className="size-4"
              checked={value === option}
              disabled={disabled}
              onChange={() => onChange(option)}
            />
            {option}
            {disabled && disabledHint && <span className="text-xs">({disabledHint})</span>}
          </label>
        );
      })}
      <FieldError message={error} />
    </fieldset>
  );
}

export function ApplyForm({ token, title, notice, dates, activities, prizes, prizeNote }: ApplyFormProps) {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [cohort, setCohort] = useState("");
  const [major, setMajor] = useState("");
  const [teammate, setTeammate] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [firstChoice, setFirstChoice] = useState("");
  const [secondChoice, setSecondChoice] = useState("");
  const [prize, setPrize] = useState("");
  const [prizeOther, setPrizeOther] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function chooseFirst(value: string) {
    setFirstChoice(value);
    // 2순위와 같은 테마를 1순위로 옮기면 2순위를 다시 고르게 한다.
    if (value === secondChoice) setSecondChoice("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitError("");
    const found = validateApplication({
      name,
      studentId,
      cohort,
      major,
      dates: selectedDates,
      firstChoice,
      secondChoice,
      activityCount: activities.length,
      prize,
      prizeOther,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // 사람에게 보이지 않는 칸이 채워져 있으면 자동 등록으로 보고 저장하지 않는다.
    if (website) {
      setDone(true);
      return;
    }

    setSubmitting(true);
    const { error } = await createClient().rpc("submit_capture_ranked_application", {
      token,
      applicant_name: name,
      applicant_student_id: studentId,
      applicant_cohort: cohort,
      applicant_major: major,
      applicant_teammate: teammate,
      selected_dates: selectedDates,
      selected_first: firstChoice,
      selected_second: secondChoice,
      selected_prize: prizeValue(prize, prizeOther),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError("신청을 저장하지 못했습니다. 입력 내용과 마감 여부를 확인하고 잠시 뒤 다시 시도해 주세요.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="flex min-h-full items-center justify-center bg-secondary p-4">
        <div className="flex w-full max-w-md flex-col gap-3 bg-background p-8">
          <h1 className="font-display text-3xl">신청했습니다</h1>
          <p className="text-muted-foreground">날짜를 더하고 싶다면 다시 신청해 주세요. 앞선 신청에 더해집니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-secondary p-4">
      <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-xl flex-col gap-6 bg-background p-6 md:p-8">
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-3xl">{title || "캡처"} 신청</h1>
          <CaptureNotice text={notice} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="apply-name">이름</Label>
            <Input id="apply-name" name="name" autoComplete="name" maxLength={50} value={name} aria-invalid={Boolean(errors.name)} onChange={(e) => setName(e.target.value)} />
            <FieldError message={errors.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apply-major">학과</Label>
            <Input id="apply-major" name="major" autoComplete="off" maxLength={100} placeholder="예: 컴퓨터AI학부" className="placeholder:text-muted-foreground/60" value={major} aria-invalid={Boolean(errors.major)} onChange={(e) => setMajor(e.target.value)} />
            <FieldError message={errors.major} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apply-student-id">학번</Label>
            <Input id="apply-student-id" name="student-id" autoComplete="off" inputMode="numeric" maxLength={12} placeholder="예: 2026000000" className="placeholder:text-muted-foreground/60" value={studentId} aria-invalid={Boolean(errors.studentId)} onChange={(e) => setStudentId(e.target.value)} />
            <FieldError message={errors.studentId} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apply-cohort">기수</Label>
            <Input id="apply-cohort" name="cohort" autoComplete="off" maxLength={20} placeholder="예: 40기" className="placeholder:text-muted-foreground/60" value={cohort} aria-invalid={Boolean(errors.cohort)} onChange={(e) => setCohort(e.target.value)} />
            <FieldError message={errors.cohort} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="apply-teammate">함께 조를 이루고 싶은 사람 (선택)</Label>
          <Input id="apply-teammate" name="teammate" autoComplete="off" maxLength={100} value={teammate} onChange={(e) => setTeammate(e.target.value)} />
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

        {activities.length > 0 && (
          <ChoiceGroup
            legend="선호하는 활동 테마 1순위"
            name="first-choice"
            options={activities}
            value={firstChoice}
            onChange={chooseFirst}
            error={errors.firstChoice}
          />
        )}
        {activities.length > 1 && (
          <ChoiceGroup
            legend="선호하는 활동 테마 2순위"
            name="second-choice"
            options={activities}
            value={secondChoice}
            onChange={setSecondChoice}
            disabledOption={firstChoice}
            disabledHint="1순위로 고름"
            error={errors.secondChoice}
          />
        )}

        {prizes.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">이벤트 상품 선택 (택1, 선택)</legend>
            {prizeNote.trim() && (
              <p className="mb-1 text-sm whitespace-pre-line text-muted-foreground">{prizeNote}</p>
            )}
            {[...prizes, OTHER_PRIZE].map((option) => (
              <label key={option} className="flex min-h-9 items-center gap-2">
                <input type="radio" name="prize" className="size-4" checked={prize === option} onChange={() => setPrize(option)} />
                {option}
              </label>
            ))}
            {prize === OTHER_PRIZE && (
              <Input
                aria-label="원하는 상품"
                maxLength={90}
                placeholder="원하는 상품을 적어 주세요"
                className="placeholder:text-muted-foreground/60"
                value={prizeOther}
                aria-invalid={Boolean(errors.prize)}
                onChange={(e) => setPrizeOther(e.target.value)}
              />
            )}
            <FieldError message={errors.prize} />
            {prize && (
              <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setPrize("")}>
                선택 지우기
              </Button>
            )}
          </fieldset>
        )}

        <div aria-hidden className="absolute -left-[9999px]">
          <label>
            웹사이트
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <p className="rounded-md bg-secondary p-4 text-sm leading-relaxed">
          입력한 내용은 캡처 조 편성, 안내, 이벤트 경품 전달에만 쓰며, 지정된 기획부 담당자만 확인합니다. 해당 회차 종료 후
          1년 이내에 삭제합니다.{" "}
          <a className="underline underline-offset-4" href="/privacy" target="_blank" rel="noreferrer">
            개인정보처리방침
          </a>
        </p>

        {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
        <Button type="submit" disabled={submitting} className="chamfer h-11 rounded-none">
          {submitting ? "신청하는 중" : "신청하기"}
        </Button>
      </form>
    </main>
  );
}
