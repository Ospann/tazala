import { useCallback, useMemo, useState } from 'react';

export interface Selection {
  selected: ReadonlySet<string>;
  count: number;
  toggle: (id: string) => void;
  set: (ids: Iterable<string>) => void;
  selectAll: () => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
}

export function useSelection(allIds: readonly string[], initial?: Iterable<string>): Selection {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initial));

  const toggle = useCallback((id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const set = useCallback((ids: Iterable<string>) => setSelected(new Set(ids)), []);
  const selectAll = useCallback(() => setSelected(new Set(allIds)), [allIds]);
  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  return useMemo(
    () => ({ selected, count: selected.size, toggle, set, selectAll, clear, isSelected }),
    [selected, toggle, set, selectAll, clear, isSelected],
  );
}
