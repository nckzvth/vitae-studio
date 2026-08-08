import type { RichTextSpan, RichTextValue } from "@/src/model/types";

const sameMarks = (left: RichTextSpan, right: RichTextSpan) =>
  Boolean(left.bold) === Boolean(right.bold) &&
  Boolean(left.italic) === Boolean(right.italic) &&
  Boolean(left.underline) === Boolean(right.underline) &&
  Boolean(left.strikethrough) === Boolean(right.strikethrough);

export function normalizeRichText(value: RichTextValue): RichTextValue {
  const spans: RichTextSpan[] = [];
  value.spans.forEach((span) => {
    if (!span.text) return;
    const normalized: RichTextSpan = {
      text: span.text.replace(/\r\n?/g, "\n"),
      ...(span.bold ? { bold: true } : {}),
      ...(span.italic ? { italic: true } : {}),
      ...(span.underline ? { underline: true } : {}),
      ...(span.strikethrough ? { strikethrough: true } : {}),
    };
    const previous = spans.at(-1);
    if (previous && sameMarks(previous, normalized)) {
      previous.text += normalized.text;
    } else {
      spans.push(normalized);
    }
  });
  return { spans };
}

export function plainToRichText(value: string): RichTextValue {
  return value ? { spans: [{ text: value }] } : { spans: [] };
}

export function richTextToPlain(value: RichTextValue | undefined) {
  return value?.spans.map((span) => span.text).join("") ?? "";
}

export function sliceRichText(
  value: RichTextValue,
  start: number,
  end: number,
): RichTextValue {
  let offset = 0;
  const spans: RichTextSpan[] = [];
  for (const span of value.spans) {
    const spanStart = offset;
    const spanEnd = offset + span.text.length;
    const selectionStart = Math.max(start, spanStart);
    const selectionEnd = Math.min(end, spanEnd);
    if (selectionStart < selectionEnd) {
      spans.push({
        ...span,
        text: span.text.slice(
          selectionStart - spanStart,
          selectionEnd - spanStart,
        ),
      });
    }
    offset = spanEnd;
    if (offset >= end) break;
  }
  return normalizeRichText({ spans });
}

export function richTextForDisplay(
  formatted: RichTextValue | undefined,
  displayedText: string | undefined,
) {
  const text = displayedText ?? "";
  if (!formatted) return plainToRichText(text);
  const source = richTextToPlain(formatted);
  if (source === text) return formatted;
  const start = source.indexOf(text);
  return start >= 0
    ? sliceRichText(formatted, start, start + text.length)
    : plainToRichText(text);
}
