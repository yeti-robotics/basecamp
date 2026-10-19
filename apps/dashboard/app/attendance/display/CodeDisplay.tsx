'use client';

import { generateAttendanceCode } from '@repo/attendance-code';
import { useEffect, useState } from 'react';

type CodeDisplayProps = {
  secret: string;
  expiresAt: number;
  onExpired: () => void;
};

export function CodeDisplay({ secret, expiresAt, onExpired }: CodeDisplayProps) {
  const [code, setCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    let active = true;
    let lastStep = -1;
    let expired = false;

    const tick = () => {
      const now = Date.now();
      if (now >= expiresAt) {
        if (!expired) {
          expired = true;
          setCode(null);
          onExpired();
        }
        return;
      }

      const step = Math.floor(now / 30_000);
      setSecondsLeft(30 - Math.floor((now % 30_000) / 1_000));
      if (step === lastStep) return;
      lastStep = step;
      setCode(null);
      void generateAttendanceCode(secret, now)
        .then((nextCode) => {
          if (active && !expired && step === Math.floor(Date.now() / 30_000)) {
            setCode(nextCode);
          }
        })
        .catch(() => {
          if (active) setCode(null);
        });
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [secret, expiresAt, onExpired]);

  return (
    <div className="space-y-8 text-center">
      <div className="rounded-[2rem] border border-white/15 bg-white/[0.06] px-6 py-10 shadow-2xl shadow-black/30 sm:px-12 sm:py-14">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/75">
          Attendance code
        </p>
        <p
          aria-live="polite"
          className="mt-4 font-mono text-[clamp(5rem,19vw,11rem)] font-bold leading-none tracking-[0.08em] tabular-nums text-white"
        >
          {code ?? '····'}
        </p>
      </div>
      <div className="mx-auto max-w-xl space-y-3">
        <p className="text-lg text-white/85 sm:text-2xl">
          Enter this code with <span className="font-mono text-cyan-200">/signin</span> or{' '}
          <span className="font-mono text-cyan-200">/signout</span> in Discord.
        </p>
        <p className="font-mono text-sm uppercase tracking-widest text-white/50">
          New code in {secondsLeft}s
        </p>
      </div>
    </div>
  );
}
