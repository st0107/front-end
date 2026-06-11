import { RefObject, useLayoutEffect, useMemo, useState } from 'react';
import type { GridMetrics, VirtualWindow } from '../types';

interface ScrollState {
  scrollTop: number;
  scrollLeft: number;
  width: number;
  height: number;
}

export function useVirtualGrid(
  viewportRef: RefObject<HTMLElement>,
  metrics: GridMetrics,
): {
  scrollState: ScrollState;
  virtualWindow: VirtualWindow;
  onScroll: () => void;
} {
  const [scrollState, setScrollState] = useState<ScrollState>({
    scrollTop: 0,
    scrollLeft: 0,
    width: 900,
    height: 600,
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateSize = () => {
      setScrollState((current) => ({
        ...current,
        width: viewport.clientWidth || current.width,
        height: viewport.clientHeight || current.height,
      }));
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [viewportRef]);

  const onScroll = () => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    setScrollState((current) => ({
      ...current,
      scrollTop: viewport.scrollTop,
      scrollLeft: viewport.scrollLeft,
    }));
  };

  const virtualWindow = useMemo<VirtualWindow>(() => {
    const startRow = Math.max(
      0,
      Math.floor(scrollState.scrollTop / metrics.rowHeight) - metrics.overscan,
    );
    const startCol = Math.max(
      0,
      Math.floor(scrollState.scrollLeft / metrics.columnWidth) - metrics.overscan,
    );
    const endRow = Math.min(
      metrics.rowCount - 1,
      Math.ceil((scrollState.scrollTop + scrollState.height) / metrics.rowHeight) +
        metrics.overscan,
    );
    const endCol = Math.min(
      metrics.columnCount - 1,
      Math.ceil((scrollState.scrollLeft + scrollState.width) / metrics.columnWidth) +
        metrics.overscan,
    );

    return {
      startRow,
      endRow,
      startCol,
      endCol,
      offsetTop: startRow * metrics.rowHeight,
      offsetLeft: startCol * metrics.columnWidth,
    };
  }, [metrics, scrollState]);

  return { scrollState, virtualWindow, onScroll };
}
