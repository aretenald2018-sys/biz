'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { Annotation, MetaAnnotation } from '@/types/annotation';
import { ANNOTATION_COLORS } from '@/components/email/email-viewer-utils';

type ConnectorLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  active: boolean;
};

interface GenericConnectorItem {
  id: string;
  color: string;
}

interface GenericConnectorLinesProps<T extends GenericConnectorItem> {
  containerRef: RefObject<HTMLDivElement | null>;
  highlightRefs: MutableRefObject<Map<string, HTMLElement>>;
  cardRefs: MutableRefObject<Map<string, HTMLElement>>;
  items: T[];
  activeId: string | null;
  defaultColor: string;
  cardYOffset: number;
  midRatio: number;
  activeStrokeWidth: number;
  inactiveStrokeWidth: number;
  activeOpacity: number;
  inactiveOpacity: number;
  activeDotRadius: number;
  inactiveDotRadius: number;
  arrowSize: number;
  glow: boolean;
}

export function useConnectorLineSync(
  updateLines: () => void,
  containerRef?: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateLines();
      });
    };

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);

    const container = containerRef?.current ?? null;
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (container) {
      resizeObserver.observe(container);
      container.addEventListener('scroll', scheduleUpdate, true);
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
      if (container) {
        container.removeEventListener('scroll', scheduleUpdate, true);
      }
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [containerRef, updateLines]);
}

function GenericConnectorLines<T extends GenericConnectorItem>({
  containerRef,
  highlightRefs,
  cardRefs,
  items,
  activeId,
  defaultColor,
  cardYOffset,
  midRatio,
  activeStrokeWidth,
  inactiveStrokeWidth,
  activeOpacity,
  inactiveOpacity,
  activeDotRadius,
  inactiveDotRadius,
  arrowSize,
  glow,
}: GenericConnectorLinesProps<T>) {
  const [lines, setLines] = useState<ConnectorLine[]>([]);

  const updateLines = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const nextLines = items
      .map((item) => {
        const highlight = highlightRefs.current.get(item.id);
        const card = cardRefs.current.get(item.id);
        if (!highlight || !card) return null;
        const preset = ANNOTATION_COLORS.find((color) => color.border === item.color);
        return {
          id: item.id,
          color: preset?.border || defaultColor,
          active: activeId === item.id,
          x1: highlight.getBoundingClientRect().right - containerRect.left,
          y1: highlight.getBoundingClientRect().top - containerRect.top,
          x2: card.getBoundingClientRect().left - containerRect.left,
          y2: card.getBoundingClientRect().top + cardYOffset - containerRect.top,
        };
      })
      .filter((line): line is ConnectorLine => line !== null);

    setLines(nextLines);
  }, [activeId, cardRefs, cardYOffset, containerRef, defaultColor, highlightRefs, items]);

  useConnectorLineSync(updateLines, containerRef);

  if (lines.length === 0) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      {lines.map((line) => {
        const midX = line.x1 + (line.x2 - line.x1) * midRatio;
        const midY = line.y2;
        const strokeWidth = line.active ? activeStrokeWidth : inactiveStrokeWidth;
        const opacity = line.active ? activeOpacity : inactiveOpacity;
        const dotRadius = line.active ? activeDotRadius : inactiveDotRadius;

        return (
          <g key={line.id}>
            {glow && line.active && (
              <path
                d={`M ${line.x1} ${line.y1} L ${midX} ${midY} L ${line.x2} ${line.y2}`}
                fill="none"
                stroke={line.color}
                strokeWidth={6}
                opacity={0.15}
              />
            )}
            <path
              d={`M ${line.x1} ${line.y1} L ${midX} ${midY} L ${line.x2} ${line.y2}`}
              fill="none"
              stroke={line.color}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={line.x1} cy={line.y1} r={dotRadius} fill={line.color} opacity={opacity} />
            <polygon
              points={`${line.x2},${line.y2} ${line.x2 - arrowSize},${line.y2 - arrowSize / 2} ${line.x2 - arrowSize},${line.y2 + arrowSize / 2}`}
              fill={line.color}
              opacity={opacity}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function ConnectorLines({
  containerRef,
  highlightRefs,
  cardRefs,
  annotations,
  activeAnnotation,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  highlightRefs: MutableRefObject<Map<string, HTMLElement>>;
  cardRefs: MutableRefObject<Map<string, HTMLElement>>;
  annotations: Annotation[];
  activeAnnotation: string | null;
}) {
  return (
    <GenericConnectorLines
      containerRef={containerRef}
      highlightRefs={highlightRefs}
      cardRefs={cardRefs}
      items={annotations}
      activeId={activeAnnotation}
      defaultColor={ANNOTATION_COLORS[0].border}
      cardYOffset={12}
      midRatio={0.35}
      activeStrokeWidth={2.2}
      inactiveStrokeWidth={1.4}
      activeOpacity={0.9}
      inactiveOpacity={0.5}
      activeDotRadius={4}
      inactiveDotRadius={3}
      arrowSize={7}
      glow
    />
  );
}

export function MetaConnectorLines({
  containerRef,
  metaHighlightRefs,
  metaCardRefs,
  metas,
  activeMetaAnnotation,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  metaHighlightRefs: MutableRefObject<Map<string, HTMLElement>>;
  metaCardRefs: MutableRefObject<Map<string, HTMLElement>>;
  metas: MetaAnnotation[];
  activeMetaAnnotation: string | null;
}) {
  return (
    <GenericConnectorLines
      containerRef={containerRef}
      highlightRefs={metaHighlightRefs}
      cardRefs={metaCardRefs}
      items={metas}
      activeId={activeMetaAnnotation}
      defaultColor={ANNOTATION_COLORS[1].border}
      cardYOffset={10}
      midRatio={0.4}
      activeStrokeWidth={1.8}
      inactiveStrokeWidth={1.2}
      activeOpacity={0.8}
      inactiveOpacity={0.45}
      activeDotRadius={3}
      inactiveDotRadius={2}
      arrowSize={5}
      glow={false}
    />
  );
}
