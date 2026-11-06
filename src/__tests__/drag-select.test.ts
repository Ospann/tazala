import { rangeSelection } from '@/components/use-drag-select';

const ids = ['a', 'b', 'c', 'd', 'e'];

describe('rangeSelection', () => {
  it('selects the range between anchor and current in either direction', () => {
    expect([...rangeSelection(ids, new Set(), 1, 3, true)].sort()).toEqual(['b', 'c', 'd']);
    expect([...rangeSelection(ids, new Set(), 3, 1, true)].sort()).toEqual(['b', 'c', 'd']);
  });

  it('keeps the baseline outside the range', () => {
    const next = rangeSelection(ids, new Set(['a', 'e']), 1, 2, true);
    expect([...next].sort()).toEqual(['a', 'b', 'c', 'e']);
  });

  it('restores the baseline when the finger moves back', () => {
    const baseline = new Set(['d']);
    rangeSelection(ids, baseline, 0, 4, true);
    expect([...rangeSelection(ids, baseline, 0, 1, true)].sort()).toEqual(['a', 'b', 'd']);
  });

  it('deselects the range when the drag starts on a selected item', () => {
    const next = rangeSelection(ids, new Set(ids), 1, 3, false);
    expect([...next].sort()).toEqual(['a', 'e']);
  });

  it('ignores indices outside the list', () => {
    expect([...rangeSelection(ids, new Set(), 3, 9, true)].sort()).toEqual(['d', 'e']);
  });
});
