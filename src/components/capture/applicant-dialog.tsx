"use client";

import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Capture } from "@/hooks/use-capture";
import {
  assignedDatesByStudent,
  type CaptureApplication,
  formatRoundDate,
  groupApplicants,
  OTHER_PRIZE,
  OTHER_PRIZE_PREFIX,
  prizeValue,
  validateApplication,
} from "@/lib/capture";

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type ApplicantDialogProps = {
  capture: Capture;
  /** 열 사람의 학번. 없으면 닫힌다. */
  studentId: string | null;
  onStudentChange: (studentId: string | null) => void;
};

/** 한 사람의 모든 신청을 보여 주고, 신청마다 내용을 고칠 수 있게 한다. */
export function ApplicantDialog({ capture, studentId, onStudentChange }: ApplicantDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const applicant = useMemo(
    () => groupApplicants(capture.applications).find((item) => item.studentId === studentId) ?? null,
    [capture.applications, studentId],
  );

  function close() {
    setEditingId(null);
    onStudentChange(null);
  }

  return (
    <Dialog open={applicant !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {applicant && (
          <>
            <DialogHeader>
              <DialogTitle>{applicant.name}</DialogTitle>
              <DialogDescription>학번 {applicant.studentId}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-5">
              {applicant.applications.map((item, index) => {
                const label =
                  applicant.applications.length > 1 ? (index === 0 ? "최신 신청" : `이전 신청 ${index}`) : "신청 내용";
                return editingId === item.id ? (
                  <ApplicationEditor
                    key={item.id}
                    capture={capture}
                    application={item}
                    label={label}
                    onCancel={() => setEditingId(null)}
                    onSaved={(nextStudentId) => {
                      setEditingId(null);
                      if (nextStudentId !== applicant.studentId && applicant.applications.length === 1) {
                        onStudentChange(nextStudentId);
                      }
                    }}
                  />
                ) : (
                  <ApplicationDetail
                    key={item.id}
                    application={item}
                    label={label}
                    onEdit={editingId === null ? () => setEditingId(item.id) : undefined}
                  />
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ApplicationDetailProps = { application: CaptureApplication; label: string; onEdit?: () => void };

function ApplicationDetail({ application, label, onEdit }: ApplicationDetailProps) {
  const details: [string, string][] = [
    ["신청 시간", timeFormat.format(new Date(application.createdAt))],
    ["기수", application.cohort],
    ["학과", application.major],
    ["함께 조", application.preferredTeammate || "없음"],
    ["희망 날짜", application.dates.map(formatRoundDate).join(", ")],
    ...(application.firstChoice
      ? ([
          ["1순위", application.firstChoice],
          ["2순위", application.secondChoice || "없음"],
        ] as [string, string][])
      : ([
          ["희망 횟수", application.participation || "없음"],
          ["음주 여부", application.drinking || "없음"],
          ["희망 활동", application.activities.join(", ") || "없음"],
          ["기타", application.otherActivity || "없음"],
        ] as [string, string][])),
    ...(application.prize ? ([["이벤트 상품", application.prize]] as [string, string][]) : []),
  ];
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            고치기
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const select = "h-9 rounded-md border bg-background px-2 text-sm";

type ApplicationEditorProps = {
  capture: Capture;
  application: CaptureApplication;
  label: string;
  onCancel: () => void;
  onSaved: (studentId: string) => void;
};

function ApplicationEditor({ capture, application, label, onCancel, onSaved }: ApplicationEditorProps) {
  const round = capture.round;
  const roundPrizes = (round?.prizes ?? []).filter((item) => item !== OTHER_PRIZE);
  const startsOther = application.prize.startsWith(OTHER_PRIZE_PREFIX);
  // 설정에서 상품을 지웠어도 원래 고른 상품은 남겨 둔다.
  const keptPrize = !startsOther && application.prize && !roundPrizes.includes(application.prize) ? [application.prize] : [];

  const [name, setName] = useState(application.name);
  const [studentId, setStudentId] = useState(application.studentId);
  const [cohort, setCohort] = useState(application.cohort);
  const [major, setMajor] = useState(application.major);
  const [teammate, setTeammate] = useState(application.preferredTeammate);
  const [dates, setDates] = useState(application.dates);
  const [firstChoice, setFirstChoice] = useState(application.firstChoice);
  const [secondChoice, setSecondChoice] = useState(application.secondChoice);
  const [prize, setPrize] = useState(startsOther ? OTHER_PRIZE : application.prize);
  const [prizeOther, setPrizeOther] = useState(startsOther ? application.prize.slice(OTHER_PRIZE_PREFIX.length) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // 설정에서 날짜나 테마를 지웠어도 원래 신청에 있던 값은 고를 수 있게 남긴다.
  const dateOptions = [...new Set([...(round?.dates ?? []), ...application.dates])].sort();
  const ranked = application.firstChoice !== "";
  const activityOptions = [
    ...new Set([...(round?.activities ?? []), application.firstChoice, application.secondChoice].filter(Boolean)),
  ];
  const prizeOptions = [...roundPrizes, ...keptPrize];
  const showPrize = prizeOptions.length > 0 || application.prize !== "";

  const assigned = assignedDatesByStudent(capture.teams, capture.applications).get(application.studentId) ?? [];
  const droppedAssigned = assigned.filter((date) => application.dates.includes(date) && !dates.includes(date));

  async function save() {
    const found = validateApplication({
      name,
      studentId,
      cohort,
      major,
      dates,
      firstChoice,
      secondChoice,
      // 원래 2순위를 적었던 신청만 2순위를 꼭 고르게 한다.
      activityCount: ranked ? (application.secondChoice ? 2 : 1) : 0,
      prize,
      prizeOther,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError("");
    const failure = await capture.updateApplication(application.id, {
      name: name.trim(),
      studentId: studentId.trim(),
      cohort: cohort.trim(),
      major: major.trim(),
      preferredTeammate: teammate.trim(),
      dates: [...dates].sort(),
      firstChoice,
      secondChoice,
      prize: prizeValue(prize, prizeOther),
    });
    setSaving(false);
    if (failure) setSaveError(failure);
    else onSaved(studentId.trim());
  }

  const field = (id: string, text: string, input: React.ReactNode, error?: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{text}</Label>
      {input}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  return (
    <section className="flex flex-col gap-4 rounded-md border p-4">
      <h3 className="text-sm font-medium">{label} 고치기</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("edit-name", "이름", <Input id="edit-name" maxLength={50} value={name} aria-invalid={Boolean(errors.name)} onChange={(e) => setName(e.target.value)} />, errors.name)}
        {field("edit-student-id", "학번", <Input id="edit-student-id" inputMode="numeric" maxLength={12} value={studentId} aria-invalid={Boolean(errors.studentId)} onChange={(e) => setStudentId(e.target.value)} />, errors.studentId)}
        {field("edit-cohort", "기수", <Input id="edit-cohort" maxLength={20} value={cohort} aria-invalid={Boolean(errors.cohort)} onChange={(e) => setCohort(e.target.value)} />, errors.cohort)}
        {field("edit-major", "학과", <Input id="edit-major" maxLength={100} value={major} aria-invalid={Boolean(errors.major)} onChange={(e) => setMajor(e.target.value)} />, errors.major)}
      </div>
      {field("edit-teammate", "함께 조를 이루고 싶은 사람", <Input id="edit-teammate" maxLength={100} value={teammate} onChange={(e) => setTeammate(e.target.value)} />)}

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1.5 text-sm font-medium">희망 날짜</legend>
        <div className="flex flex-wrap gap-x-4">
          {dateOptions.map((date) => (
            <label key={date} className="flex min-h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={dates.includes(date)}
                onChange={() => setDates(dates.includes(date) ? dates.filter((item) => item !== date) : [...dates, date])}
              />
              {formatRoundDate(date)}
            </label>
          ))}
        </div>
        {errors.dates && <p className="text-sm text-destructive">{errors.dates}</p>}
        {droppedAssigned.length > 0 && (
          <p className="text-sm text-destructive">
            {droppedAssigned.map(formatRoundDate).join(", ")}에는 이미 조에 배정되어 있습니다. 저장해도 조에서는 빠지지 않으니
            조 편성에서 따로 빼 주세요.
          </p>
        )}
      </fieldset>

      {ranked && (
        <div className="grid gap-3 sm:grid-cols-2">
          {field(
            "edit-first",
            "1순위 테마",
            <select id="edit-first" className={select} value={firstChoice} onChange={(e) => setFirstChoice(e.target.value)}>
              {activityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>,
            errors.firstChoice,
          )}
          {field(
            "edit-second",
            "2순위 테마",
            <select id="edit-second" className={select} value={secondChoice} onChange={(e) => setSecondChoice(e.target.value)}>
              <option value="">고르지 않음</option>
              {activityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>,
            errors.secondChoice,
          )}
        </div>
      )}

      {showPrize && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-prize">이벤트 상품</Label>
          <div className="flex flex-wrap gap-2">
            <select id="edit-prize" className={select} value={prize} onChange={(e) => setPrize(e.target.value)}>
              <option value="">고르지 않음</option>
              {prizeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              <option value={OTHER_PRIZE}>{OTHER_PRIZE} (직접 입력)</option>
            </select>
            {prize === OTHER_PRIZE && (
              <Input
                aria-label="기타 상품 직접 입력"
                maxLength={90}
                className="h-9 min-w-0 flex-1"
                value={prizeOther}
                aria-invalid={Boolean(errors.prize)}
                onChange={(e) => setPrizeOther(e.target.value)}
              />
            )}
          </div>
          {errors.prize && <p className="text-sm text-destructive">{errors.prize}</p>}
        </div>
      )}

      {!ranked && (
        <p className="text-sm text-muted-foreground">희망 횟수, 음주 여부, 희망 활동은 고칠 수 없습니다.</p>
      )}
      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>취소</Button>
        <Button onClick={save} disabled={saving}>{saving ? "저장하는 중" : "저장"}</Button>
      </div>
    </section>
  );
}
