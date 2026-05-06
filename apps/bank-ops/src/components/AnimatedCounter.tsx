'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export default function AnimatedCounter({
  value,
  duration = 1200,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const hasAnimated = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);
  const startTime = useRef<number>(0);
  const animFrame = useRef<number>(0);

  const animate = useCallback(() => {
    const now = performance.now();
    const elapsed = now - startTime.current;
    const progress = Math.min(elapsed / duration, 1);
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    setDisplayValue(eased * value);

    if (progress < 1) {
      animFrame.current = requestAnimationFrame(animate);
    } else {
      setDisplayValue(value);
    }
  }, [duration, value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          startTime.current = performance.now();
          animate();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrame.current);
    };
  }, [animate]);

  const formatted =
    decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue).toLocaleString();

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/* Currency variant that formats large numbers nicely */
export function AnimatedCurrency({
  value,
  duration = 1200,
  className = '',
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const hasAnimated = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);
  const startTime = useRef<number>(0);
  const animFrame = useRef<number>(0);

  const runAnimation = useCallback(() => {
    const now = performance.now();
    const elapsed = now - startTime.current;
    const progress = Math.min(elapsed / duration, 1);
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    setDisplayValue(eased * value);

    if (progress < 1) {
      animFrame.current = requestAnimationFrame(runAnimation);
    } else {
      setDisplayValue(value);
    }
  }, [duration, value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          startTime.current = performance.now();
          runAnimation();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrame.current);
    };
  }, [runAnimation]);

  const formatted = new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(displayValue));

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {formatted}
    </span>
  );
}
