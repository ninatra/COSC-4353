import { useEffect, useRef, useState } from 'react';

// Counts from 0 up to `target` when the component first appears.
// Later changes show immediately (the ticket's bump animation covers those).
export function useCountUp(target, duration = 700) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(reduced ? target : 0);
  const done = useRef(reduced);

  useEffect(() => {
    if (done.current) return;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setShown(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
      else done.current = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return done.current ? target : shown;
}
