export type InquiryStatus = "open" | "done";

export type Inquiry = {
  id: string;
  authorId: string | null;
  title: string;
  body: string;
  status: InquiryStatus;
  createdAt: string;
};

export const INQUIRY_TITLE_MAX = 100;
export const INQUIRY_BODY_MAX = 2000;
export const DISPLAY_NAME_MAX = 50;

export function validateInquiry(title: string, body: string): { title?: string; body?: string } {
  const errors: { title?: string; body?: string } = {};
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (!cleanTitle) errors.title = "제목을 입력하세요.";
  else if (cleanTitle.length > INQUIRY_TITLE_MAX) errors.title = `제목은 ${INQUIRY_TITLE_MAX}자까지 쓸 수 있습니다.`;
  if (!cleanBody) errors.body = "내용을 입력하세요.";
  else if (cleanBody.length > INQUIRY_BODY_MAX) errors.body = `내용은 ${INQUIRY_BODY_MAX}자까지 쓸 수 있습니다.`;
  return errors;
}

export function validateDisplayName(name: string): string | null {
  const clean = name.trim();
  if (!clean) return "이름을 입력하세요.";
  if (clean.length > DISPLAY_NAME_MAX) return `이름은 ${DISPLAY_NAME_MAX}자까지 쓸 수 있습니다.`;
  return null;
}
