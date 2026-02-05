import { useState, useEffect, useRef } from "react";

export function useAnimatedCounter(end, duration = 1200, startOnMount = true) {
  const [value, setValue] = useState(0);
  const startTime = useRef(null);
  const animFrame = useRef(null);

  useEffect(() => {
    if (!startOnMount || end === 0 || end === undefined || end === null) {
      setValue(end || 0);
      return;
    }

    setValue(0);
    startTime.current = null;

    const animate = (timestamp) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * end);

      if (progress < 1) {
        animFrame.current = requestAnimationFrame(animate);
      } else {
        setValue(end);
      }
    };

    animFrame.current = requestAnimationFrame(animate);
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [end, duration, startOnMount]);

  return value;
}

export function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "", duration = 1200, className = "" }) {
  const animated = useAnimatedCounter(value, duration);

  const display = decimals > 0
    ? animated.toFixed(decimals)
    : Math.round(animated).toString();

  return (
    <span className={className}>
      {prefix}{display}{suffix}
    </span>
  );
}
