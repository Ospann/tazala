import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

export interface SelectionMode {
  active: boolean;
  enter: () => void;
  exit: () => void;
}

export function useSelectionMode(onExit: () => void): SelectionMode {
  const [active, setActive] = useState(false);
  const enter = useCallback(() => setActive(true), []);
  const exit = useCallback(() => {
    setActive(false);
    onExit();
  }, [onExit]);

  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      exit();
      return true;
    });
    return () => subscription.remove();
  }, [active, exit]);

  return { active, enter, exit };
}
