import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/**
 * Counts up to `value` on mount / change. Respects prefers-reduced-motion
 * (shows the final value instantly). Duration capped at 300ms per the sprint
 * brief. Feature-local — not a reusable primitive.
 */
export function AnimatedCounter({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduced]);

  return <span data-numeric>{display}</span>;
}
