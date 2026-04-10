import type { Annotation } from '@/types/annotation';

interface TextNodeEntry {
  node: Text;
  start: number;
  end: number;
}

const ANNOTATION_COLORS = [
  { bg: 'rgba(255, 220, 100, 0.35)', border: '#ffd54f' },
  { bg: 'rgba(100, 220, 255, 0.30)', border: '#4dd0e1' },
  { bg: 'rgba(255, 150, 200, 0.30)', border: '#f48fb1' },
  { bg: 'rgba(150, 255, 150, 0.30)', border: '#81c784' },
  { bg: 'rgba(200, 170, 255, 0.30)', border: '#b39ddb' },
];

function getColorPreset(color: string, isActive: boolean) {
  const preset = ANNOTATION_COLORS.find(c => c.border === color) || ANNOTATION_COLORS[0];
  const bg = isActive ? preset.bg.replace(/[\d.]+\)$/, '0.55)') : preset.bg;
  return { bg, border: preset.border };
}

function getTextNodeMap(container: HTMLElement): TextNodeEntry[] {
  const entries: TextNodeEntry[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const len = node.length;
    entries.push({ node, start: offset, end: offset + len });
    offset += len;
  }
  return entries;
}

function findNodeAtOffset(map: TextNodeEntry[], offset: number): { entry: TextNodeEntry; localOffset: number } | null {
  for (const entry of map) {
    if (offset >= entry.start && offset <= entry.end) {
      return { entry, localOffset: offset - entry.start };
    }
  }
  return null;
}

export function clearAnnotationMarks(container: HTMLElement): void {
  const marks = container.querySelectorAll('mark[data-annotation-id]');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  });
  container.normalize();
}

export function applyAnnotationsToDOM(
  container: HTMLElement,
  annotations: Annotation[],
  activeAnnotationId: string | null,
  onAnnotationClick: (id: string) => void,
): Map<string, HTMLElement> {
  const refMap = new Map<string, HTMLElement>();
  if (annotations.length === 0) return refMap;

  // Sort by start_offset descending — process from end to avoid offset invalidation
  const sorted = [...annotations].sort((a, b) => b.start_offset - a.start_offset);

  for (const ann of sorted) {
    // Re-build map each time since DOM changes after each wrap
    const map = getTextNodeMap(container);

    const startInfo = findNodeAtOffset(map, ann.start_offset);
    const endInfo = findNodeAtOffset(map, ann.end_offset);
    if (!startInfo || !endInfo) continue;

    const isActive = activeAnnotationId === ann.id;
    const { bg, border } = getColorPreset(ann.color, isActive);

    // Collect text nodes that fall within this annotation range
    const nodesToWrap: { node: Text; wrapStart: number; wrapEnd: number }[] = [];

    for (const entry of map) {
      if (entry.end <= ann.start_offset || entry.start >= ann.end_offset) continue;
      const wrapStart = Math.max(0, ann.start_offset - entry.start);
      const wrapEnd = Math.min(entry.node.length, ann.end_offset - entry.start);
      if (wrapStart < wrapEnd) {
        nodesToWrap.push({ node: entry.node, wrapStart, wrapEnd });
      }
    }

    // Wrap in reverse order to preserve earlier node references
    let firstMark: HTMLElement | null = null;
    for (let i = nodesToWrap.length - 1; i >= 0; i--) {
      const { node, wrapStart, wrapEnd } = nodesToWrap[i];

      // Split the text node to isolate the portion to wrap
      let targetNode = node;
      if (wrapEnd < node.length) {
        node.splitText(wrapEnd);
      }
      if (wrapStart > 0) {
        targetNode = node.splitText(wrapStart);
      }

      const mark = document.createElement('mark');
      mark.setAttribute('data-annotation-id', ann.id);
      mark.style.backgroundColor = bg;
      mark.style.borderBottom = `3px solid ${border}`;
      mark.style.borderRadius = '2px';
      mark.style.cursor = 'pointer';
      mark.style.transition = 'background 0.15s';
      mark.style.padding = '1px 0';
      mark.style.color = 'var(--color-soft-primary)';

      const annId = ann.id;
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        onAnnotationClick(annId);
      });

      targetNode.parentNode!.insertBefore(mark, targetNode);
      mark.appendChild(targetNode);

      firstMark = mark;
    }

    if (firstMark) {
      refMap.set(ann.id, firstMark);
    }
  }

  return refMap;
}
