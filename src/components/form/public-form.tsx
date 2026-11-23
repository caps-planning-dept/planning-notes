"use client";

import { type FormEvent, useState } from "react";
import { CaptureNotice } from "@/components/capture/capture-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  answersToSubmit,
  type FormAnswers,
  type FormQuestion,
  MAX_ANSWER_LENGTH,
  questionTitle,
  validateAnswers,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type PublicFormProps = {
  token: string;
  title: string;
  notice: string;
  questions: FormQuestion[];
  /** 기획부가 설정 화면에서 보는 미리보기. 입력 확인까지만 하고 저장하지 않는다. */
  preview?: boolean;
};

// DB 함수가 직접 낸 안내(raise exception)는 신청자에게 그대로 보여 준다.
const SERVER_MESSAGE = "P0001";

function Required() {
  return (
    <span className="ml-0.5 text-destructive" aria-hidden>
      *
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

type QuestionFieldProps = {
  question: FormQuestion;
  index: number;
  answer: string | string[] | undefined;
  error?: string;
  onChange: (answer: string | string[]) => void;
};

function QuestionField({ question, index, answer, error, onChange }: QuestionFieldProps) {
  const id = `form-q-${question.id}`;
  const helpId = question.help.trim() ? `${id}-help` : undefined;
  const title = questionTitle(question, index);
  const help = <CaptureNotice id={helpId} text={question.help} className="gap-0.5 text-sm text-muted-foreground" />;

  if (question.type === "short" || question.type === "long") {
    const value = typeof answer === "string" ? answer : "";
    const Field = question.type === "short" ? Input : Textarea;
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="font-medium">
          {title}
          {question.required && <Required />}
        </label>
        {help}
        <Field
          id={id}
          aria-describedby={helpId}
          aria-required={question.required}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          maxLength={MAX_ANSWER_LENGTH[question.type]}
          value={value}
          onChange={(event: { target: { value: string } }) => onChange(event.target.value)}
        />
        <FieldError message={error} />
      </div>
    );
  }

  const multiple = question.type === "multiple";
  const picked = multiple ? (Array.isArray(answer) ? answer : []) : typeof answer === "string" ? answer : "";
  return (
    <fieldset className="flex flex-col gap-1" aria-describedby={helpId} aria-invalid={Boolean(error)}>
      <legend className="mb-2 font-medium">
        {title}
        {question.required && <Required />}
        {multiple && <span className="ml-2 text-sm font-normal text-muted-foreground">여러 개 고를 수 있습니다</span>}
      </legend>
      {help}
      {question.options.map((option) => (
        <label key={option} className="flex min-h-10 items-center gap-2">
          <input
            type={multiple ? "checkbox" : "radio"}
            name={id}
            className="size-4 shrink-0"
            checked={multiple ? (picked as string[]).includes(option) : picked === option}
            onChange={() => {
              if (!multiple) return onChange(option);
              const list = picked as string[];
              onChange(list.includes(option) ? list.filter((item) => item !== option) : [...list, option]);
            }}
          />
          {option}
        </label>
      ))}
      <FieldError message={error} />
      {!multiple && !question.required && picked && (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => onChange("")}>
          선택 지우기
        </Button>
      )}
    </fieldset>
  );
}

export function PublicForm({ token, title, notice, questions, preview = false }: PublicFormProps) {
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [previewPassed, setPreviewPassed] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitError("");
    const found = validateAnswers(questions, answers);
    setErrors(found);
    setPreviewPassed(false);
    const firstProblem = questions.find((question) => found[question.id]);
    if (firstProblem) {
      document.getElementById(`form-q-${firstProblem.id}`)?.focus();
      return;
    }
    if (preview) {
      setPreviewPassed(true);
      return;
    }
    // 사람에게 보이지 않는 칸이 채워져 있으면 자동 등록으로 보고 저장하지 않는다.
    if (website) {
      setDone(true);
      return;
    }

    setSubmitting(true);
    const { error } = await createClient().rpc("submit_form_response", {
      token,
      answers: answersToSubmit(questions, answers),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(
        error.code === SERVER_MESSAGE
          ? error.message
          : "신청을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="flex min-h-full items-center justify-center bg-secondary p-4">
        <div className="flex w-full max-w-md flex-col gap-3 bg-background p-8">
          <h1 className="font-display text-3xl">신청했습니다</h1>
          <p className="text-muted-foreground">{title}에 낸 신청이 접수되었습니다.</p>
        </div>
      </main>
    );
  }

  // 미리보기는 앱 화면 안에 들어가므로 페이지 본문(main)과 첫 제목(h1)을 쓰지 않는다.
  const Shell = preview ? "div" : "main";
  const Heading = preview ? "h2" : "h1";

  return (
    <Shell className={cn("bg-secondary p-4", preview ? "rounded-md" : "min-h-full")}>
      <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-xl flex-col gap-6 bg-background p-6 md:p-8">
        <div className="flex flex-col gap-4">
          <Heading className="font-display text-3xl">{title || "신청"}</Heading>
          <CaptureNotice text={notice} />
          {questions.some((question) => question.required) && (
            <p className="text-sm text-destructive">* 표시는 필수 질문입니다.</p>
          )}
        </div>

        {questions.map((question, index) => (
          <QuestionField
            key={question.id}
            question={question}
            index={index}
            answer={answers[question.id]}
            error={errors[question.id]}
            onChange={(answer) => {
              setAnswers((current) => ({ ...current, [question.id]: answer }));
              setErrors((current) => {
                const rest = { ...current };
                delete rest[question.id];
                return rest;
              });
            }}
          />
        ))}

        <div aria-hidden className="absolute -left-[9999px]">
          <label>
            웹사이트
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <p className="rounded-md bg-secondary p-4 text-sm leading-relaxed">
          입력한 내용은 이 행사의 운영과 안내에만 쓰며, 지정된 기획부 담당자만 확인합니다. 행사 종료 후 1년 이내에
          삭제합니다.{" "}
          <a className="underline underline-offset-4" href="/privacy" target="_blank" rel="noreferrer">
            개인정보처리방침
          </a>
        </p>

        {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
        {previewPassed && (
          <p role="status" className="rounded-md bg-secondary p-3 text-sm">
            입력에 문제가 없습니다. 미리보기라서 실제로 신청되지는 않았습니다.
          </p>
        )}
        <Button type="submit" disabled={submitting} className="chamfer h-11 rounded-none">
          {submitting ? "신청하는 중" : "신청하기"}
        </Button>
      </form>
    </Shell>
  );
}
