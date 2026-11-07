import { fitImageSize, isInlineImage, replaceExtension } from "./note-files";

/**
 * 큰 사진은 올리기 전에 긴 쪽 2000px로 줄인다. 휴대폰 사진(3~10MB)이 수백 KB가 되어 노트가 빨리 열린다.
 * 움직이는 GIF는 줄이면 멈추므로 그대로 두고, 줄여도 작아지지 않으면 원본을 쓴다.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!isInlineImage(file.type) || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = fitImageSize(bitmap.width, bitmap.height);
    if (size.width === bitmap.width && file.size < 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    // WebP는 투명한 부분을 지키면서 작다. 지원하지 않는 브라우저는 PNG를 돌려주므로 그때는 JPEG로 바꾼다.
    let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp") {
      if (file.type === "image/png") return file;
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    }
    if (!blob || blob.size >= file.size) return file;
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], replaceExtension(file.name, extension), { type: blob.type });
  } catch {
    return file;
  }
}
