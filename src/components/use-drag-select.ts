import type { FlashListRef } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useEffect, useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import type { MediaItem } from '@/db/media-item';

import type { Selection } from './use-selection';

const LONG_PRESS_MS = 250;
const EDGE_SIZE = 64;
const MAX_SCROLL_STEP = 18;

interface DragSelectConfig {
  listRef: RefObject<FlashListRef<MediaItem> | null>;
  ids: readonly string[];
  selection: Selection;
  columns: number;
  cellSize: number;
  horizontalInset: number;
  viewportHeight: number;
  onBegin?: () => void;
}

interface DragSelectOptions extends Omit<DragSelectConfig, 'ids'> {
  items: readonly MediaItem[];
  enabled: boolean;
}

interface DragState {
  anchor: number;
  current: number;
  select: boolean;
  baseline: ReadonlySet<string>;
  fingerX: number;
  fingerY: number;
}

export function rangeSelection(
  ids: readonly string[],
  baseline: ReadonlySet<string>,
  anchor: number,
  current: number,
  select: boolean,
): Set<string> {
  const next = new Set(baseline);
  const from = Math.min(anchor, current);
  const to = Math.max(anchor, current);
  for (let index = from; index <= to; index++) {
    const id = ids[index];
    if (id === undefined) continue;
    if (select) next.add(id);
    else next.delete(id);
  }
  return next;
}

class DragSelectController {
  private config: DragSelectConfig | null = null;
  private drag: DragState | null = null;
  private frame: number | null = null;

  constructor(private readonly onDraggingChange: (dragging: boolean) => void) {}

  configure(config: DragSelectConfig) {
    this.config = config;
  }

  begin = (x: number, y: number) => {
    const config = this.config;
    const index = this.indexAt(x, y);
    const id = index === null ? undefined : config?.ids[index];
    if (!config || index === null || id === undefined) return;
    const baseline = config.selection.selected;
    this.drag = {
      anchor: index,
      current: -1,
      select: !baseline.has(id),
      baseline,
      fingerX: x,
      fingerY: y,
    };
    this.onDraggingChange(true);
    config.onBegin?.();
    this.apply(index);
  };

  move = (x: number, y: number) => {
    const state = this.drag;
    if (!state) return;
    state.fingerX = x;
    state.fingerY = y;
    const index = this.indexAt(x, y);
    if (index !== null) this.apply(index);
    if (this.frame === null) this.frame = requestAnimationFrame(this.tick);
  };

  finish = () => {
    this.stop();
    if (this.drag) this.onDraggingChange(false);
    this.drag = null;
  };

  stop = () => {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  };

  private indexAt(x: number, y: number): number | null {
    const config = this.config;
    const list = config?.listRef.current;
    if (!config || !list || config.ids.length === 0) return null;
    const first = list.getLayout(0);
    const cellWidth = first?.width ?? config.cellSize;
    const rowHeight = first?.height ?? config.cellSize;
    if (cellWidth <= 0 || rowHeight <= 0) return null;
    const contentY = y + list.getAbsoluteLastScrollOffset() - list.getFirstItemOffset();
    const row = Math.max(0, Math.floor(contentY / rowHeight));
    const column = Math.min(
      config.columns - 1,
      Math.max(0, Math.floor((x - config.horizontalInset) / cellWidth)),
    );
    return Math.min(config.ids.length - 1, row * config.columns + column);
  }

  private apply(index: number) {
    const state = this.drag;
    const config = this.config;
    if (!state || !config || index === state.current) return;
    state.current = index;
    config.selection.set(
      rangeSelection(config.ids, state.baseline, state.anchor, index, state.select),
    );
    void Haptics.selectionAsync();
  }

  private tick = () => {
    this.frame = null;
    const state = this.drag;
    const config = this.config;
    const list = config?.listRef.current;
    if (!state || !config || !list) return;
    const height = config.viewportHeight;
    let step = 0;
    if (state.fingerY < EDGE_SIZE) {
      step = -MAX_SCROLL_STEP * (1 - Math.max(0, state.fingerY) / EDGE_SIZE);
    } else if (state.fingerY > height - EDGE_SIZE) {
      step = MAX_SCROLL_STEP * (1 - Math.max(0, height - state.fingerY) / EDGE_SIZE);
    }
    if (step === 0) return;
    const offset = list.getAbsoluteLastScrollOffset();
    const maxOffset = Math.max(0, list.getChildContainerDimensions().height - height);
    const target = Math.min(maxOffset, Math.max(0, offset + step));
    if (target === offset) return;
    list.scrollToOffset({ offset: target, animated: false });
    const index = this.indexAt(state.fingerX, state.fingerY);
    if (index !== null) this.apply(index);
    this.frame = requestAnimationFrame(this.tick);
  };
}

export function useDragSelect({
  listRef,
  items,
  selection,
  columns,
  cellSize,
  horizontalInset,
  viewportHeight,
  onBegin,
  enabled,
}: DragSelectOptions) {
  const [dragging, setDragging] = useState(false);
  const [controller] = useState(() => new DragSelectController(setDragging));
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  useLayoutEffect(() => {
    controller.configure({
      listRef,
      ids,
      selection,
      columns,
      cellSize,
      horizontalInset,
      viewportHeight,
      onBegin,
    });
  }, [
    controller,
    listRef,
    ids,
    selection,
    columns,
    cellSize,
    horizontalInset,
    viewportHeight,
    onBegin,
  ]);

  useEffect(() => controller.stop, [controller]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(enabled)
        .activateAfterLongPress(LONG_PRESS_MS)
        .onStart((event) => controller.begin(event.x, event.y))
        .onUpdate((event) => controller.move(event.x, event.y))
        .onFinalize(controller.finish),
    [controller, enabled],
  );

  return { gesture, dragging };
}
