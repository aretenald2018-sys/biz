import DiffMatchPatch from 'diff-match-patch';
import type { DocxDiffLine, DocxDiffResult, DocxDiffSegment } from '@/types/document';
import type { TermsDiffSegment } from '@/types/terms';

export function diffTexts(leftText: string, rightText: string): TermsDiffSegment[] {
  const matcher = new DiffMatchPatch();
  const diffs = matcher.diff_main(normalizeLineEndings(leftText), normalizeLineEndings(rightText), false);
  matcher.diff_cleanupSemantic(diffs);

  return diffs
    .filter(([, text]) => Boolean(text))
    .map(([operation, text]) => ({
      kind: operation === DiffMatchPatch.DIFF_EQUAL
        ? 'equal'
        : operation === DiffMatchPatch.DIFF_INSERT
          ? 'insert'
          : 'delete',
      text,
    }));
}

export function buildDocxDiffResult(
  leftFilename: string,
  rightFilename: string,
  leftText: string,
  rightText: string,
): DocxDiffResult {
  const matcher = new DiffMatchPatch();
  const { chars1, chars2, lineArray } = matcher.diff_linesToChars_(
    normalizeLineEndings(leftText),
    normalizeLineEndings(rightText),
  );
  const diffs = matcher.diff_main(chars1, chars2, false);
  matcher.diff_cleanupSemantic(diffs);
  matcher.diff_charsToLines_(diffs, lineArray);

  const lines: DocxDiffLine[] = [];
  let added = 0;
  let removed = 0;
  let modified = 0;
  let diffIndex = 0;

  for (let index = 0; index < diffs.length; index += 1) {
    const [operation, chunk] = diffs[index];
    const chunkLines = splitDiffLines(chunk);

    if (operation === DiffMatchPatch.DIFF_EQUAL) {
      chunkLines.forEach((line) => {
        lines.push({
          left: line,
          right: line,
          type: 'equal',
          diffIndex: null,
        });
      });
      continue;
    }

    if (operation === DiffMatchPatch.DIFF_DELETE) {
      const next = diffs[index + 1];

      if (next && next[0] === DiffMatchPatch.DIFF_INSERT) {
        const insertedLines = splitDiffLines(next[1]);
        const pairLength = Math.max(chunkLines.length, insertedLines.length);

        for (let pairIndex = 0; pairIndex < pairLength; pairIndex += 1) {
          const leftLine = chunkLines[pairIndex] ?? '';
          const rightLine = insertedLines[pairIndex] ?? '';
          diffIndex += 1;

          if (leftLine && rightLine) {
            modified += 1;
            const { leftSegments, rightSegments } = computeIntraLineDiff(matcher, leftLine, rightLine);
            lines.push({
              left: leftLine,
              right: rightLine,
              leftSegments,
              rightSegments,
              type: 'modified',
              diffIndex,
            });
            continue;
          }

          if (leftLine) {
            removed += 1;
            lines.push({ left: leftLine, right: '', type: 'removed', diffIndex });
            continue;
          }

          added += 1;
          lines.push({ left: '', right: rightLine, type: 'added', diffIndex });
        }

        index += 1;
        continue;
      }

      chunkLines.forEach((line) => {
        diffIndex += 1;
        removed += 1;
        lines.push({ left: line, right: '', type: 'removed', diffIndex });
      });
      continue;
    }

    if (operation === DiffMatchPatch.DIFF_INSERT) {
      chunkLines.forEach((line) => {
        diffIndex += 1;
        added += 1;
        lines.push({ left: '', right: line, type: 'added', diffIndex });
      });
    }
  }

  return {
    leftFilename,
    rightFilename,
    lines: lines.length > 0 ? lines : [{ left: '', right: '', type: 'equal', diffIndex: null }],
    stats: {
      added,
      removed,
      modified,
      totalChanges: added + removed + modified,
    },
  };
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n?/g, '\n');
}

function computeIntraLineDiff(
  matcher: DiffMatchPatch,
  left: string,
  right: string,
): { leftSegments: DocxDiffSegment[]; rightSegments: DocxDiffSegment[] } {
  const diffs = matcher.diff_main(left, right);
  matcher.diff_cleanupSemantic(diffs);

  const leftSegments: DocxDiffSegment[] = [];
  const rightSegments: DocxDiffSegment[] = [];

  for (const [operation, text] of diffs) {
    if (!text) {
      continue;
    }

    if (operation === DiffMatchPatch.DIFF_EQUAL) {
      leftSegments.push({ text, type: 'equal' });
      rightSegments.push({ text, type: 'equal' });
    } else if (operation === DiffMatchPatch.DIFF_DELETE) {
      leftSegments.push({ text, type: 'delete' });
    } else if (operation === DiffMatchPatch.DIFF_INSERT) {
      rightSegments.push({ text, type: 'insert' });
    }
  }

  return { leftSegments, rightSegments };
}

function splitDiffLines(value: string) {
  const parts = normalizeLineEndings(value).split('\n');
  if (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }
  return parts;
}
