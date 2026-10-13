import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function useCountUp(target: number, duration = 900, from?: number): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(from ?? target);
  const current = useRef(from ?? target);

  useEffect(() => {
    const start = current.current;
    if (reduceMotion || start === target) {
      current.current = target;
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }
    const startedAt = Date.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min((Date.now() - startedAt) / duration, 1);
      const next = start + (target - start) * easeOutCubic(progress);
      current.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reduceMotion, target]);

  return value;
}
