import type { Annotation } from '@/types/annotation';

export interface TextSegment {
  text: string;
  annotations: Annotation[];
  startOffset: number;
  endOffset: number;
}

export function splitTextByAnnotations(text: string, annotations: Annotation[]): TextSegment[] {
  if (annotations.length === 0) {
    return [{ text, annotations: [], startOffset: 0, endOffset: text.length }];
  }

  // Collect all boundary points
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);

  for (const ann of annotations) {
    boundaries.add(Math.max(0, ann.start_offset));
    boundaries.add(Math.min(text.length, ann.end_offset));
  }

  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  const segments: TextSegment[] = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];
    if (start === end) continue;

    const segmentAnnotations = annotations.filter(
      (ann) => ann.start_offset < end && ann.end_offset > start
    );

    segments.push({
      text: text.substring(start, end),
      annotations: segmentAnnotations,
      startOffset: start,
      endOffset: end,
    });
  }

  return segments;
}

export function getSelectionOffsets(
  containerEl: HTMLElement
): { start: number; end: number; text: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);

  // Check if selection is within our container
  if (!containerEl.contains(range.commonAncestorContainer)) return null;

  const preRange = document.createRange();
  preRange.selectNodeContents(containerEl);
  preRange.setEnd(range.startContainer, range.startOffset);
  const start = preRange.toString().length;

  const selectedText = range.toString();
  if (!selectedText.trim()) return null;

  return {
    start,
    end: start + selectedText.length,
    text: selectedText,
  };
}
