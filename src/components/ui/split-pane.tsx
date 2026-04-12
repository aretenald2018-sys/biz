'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  className?: string;
  initialRatio?: number;
  minLeftPx?: number;
  minRightPx?: number;
}

export function SplitPane({
  left,
  right,
  className,
  initialRatio = 56,
  minLeftPx = 360,
  minRightPx = 360,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragActiveRef = useRef(false);
  const [ratio, setRatio] = useState(initialRatio);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);

    return () => {
      mediaQuery.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragActiveRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const nextRatio = ((event.clientX - rect.left) / rect.width) * 100;
      const minLeftRatio = (minLeftPx / rect.width) * 100;
      const minRightRatio = 100 - (minRightPx / rect.width) * 100;
      const clampedRatio = Math.min(Math.max(nextRatio, minLeftRatio), minRightRatio);
      setRatio(clampedRatio);
    };

    const handleMouseUp = () => {
      dragActiveRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minLeftPx, minRightPx]);

  return (
    <div
      ref={containerRef}
      className={`${isDesktop ? 'flex-row items-stretch' : 'flex-col'} flex gap-3 ${className || ''}`}
    >
      <div
        className="min-w-0"
        style={isDesktop ? { width: `${ratio}%`, flex: '0 0 auto' } : { width: '100%' }}
      >
        {left}
      </div>

      {isDesktop && (
        <div
          className="w-3 shrink-0 items-stretch justify-center cursor-col-resize flex"
          onMouseDown={() => {
            dragActiveRef.current = true;
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
        >
          <div className="w-px h-full bg-border/70 transition-colors hover:bg-primary/60" />
        </div>
      )}

      <div
        className="min-w-0"
        style={isDesktop ? { width: `${100 - ratio}%`, flex: '0 0 auto' } : { width: '100%' }}
      >
        {right}
      </div>
    </div>
  );
}
