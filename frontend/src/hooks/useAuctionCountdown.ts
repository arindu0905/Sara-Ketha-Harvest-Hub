import { useState, useEffect, useRef } from 'react';

export interface CountdownParts {
  days:    number;
  hours:   number;
  minutes: number;
  seconds: number;
  total:   number;  // total ms remaining
  expired: boolean;
  finalMinutes: boolean;  // true when ≤ configurable final-minute window
}

/**
 * useAuctionCountdown
 *
 * Computes a live countdown to a target datetime using server-synchronized time.
 * On first render it fetches /health to get the server's current time, calculates
 * the offset from the client clock, then uses that offset for all subsequent ticks.
 * This prevents browser clock skew from affecting bid window timing.
 *
 * @param targetIso  – ISO 8601 end_at value from the auction record
 * @param warningMinutes – minutes before end when finalMinutes becomes true (default: 5)
 */
export function useAuctionCountdown(
  targetIso: string | undefined,
  warningMinutes = 5
): CountdownParts {
  const [parts, setParts]       = useState<CountdownParts>(zeroState());
  const offsetRef               = useRef<number>(0);   // client-to-server ms offset
  const syncedRef               = useRef<boolean>(false);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync with server time on mount (one-shot)
  useEffect(() => {
    if (syncedRef.current) return;
    const sync = async () => {
      try {
        const clientBefore = Date.now();
        const resp          = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/health`);
        const json          = await resp.json();
        const clientAfter   = Date.now();
        const rtt           = clientAfter - clientBefore;
        const serverTime    = new Date(json.timestamp).getTime();
        // Estimate: server time ≈ serverTime + rtt/2; offset = server - clientAfter
        offsetRef.current   = serverTime + rtt / 2 - clientAfter;
        syncedRef.current   = true;
      } catch {
        // On failure, assume no offset (local clock)
        syncedRef.current = true;
      }
    };
    sync();
  }, []);

  useEffect(() => {
    if (!targetIso) {
      setParts(zeroState());
      return;
    }

    const target = new Date(targetIso).getTime();

    const tick = () => {
      const now       = Date.now() + offsetRef.current;
      const remaining = target - now;

      if (remaining <= 0) {
        setParts({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, expired: true, finalMinutes: false });
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      const days     = Math.floor(remaining / 86_400_000);
      const hours    = Math.floor((remaining % 86_400_000) / 3_600_000);
      const minutes  = Math.floor((remaining % 3_600_000) / 60_000);
      const seconds  = Math.floor((remaining % 60_000) / 1_000);
      const finalMin = remaining <= warningMinutes * 60_000;

      setParts({ days, hours, minutes, seconds, total: remaining, expired: false, finalMinutes: finalMin });
    };

    tick();
    intervalRef.current = setInterval(tick, 1_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetIso, warningMinutes]);

  return parts;
}

function zeroState(): CountdownParts {
  return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, expired: false, finalMinutes: false };
}

/** Format countdown parts into a human-readable string */
export function formatCountdown(p: CountdownParts): string {
  if (p.expired) return 'Auction ended';
  if (p.days > 0) return `${p.days}d ${p.hours}h ${p.minutes}m`;
  if (p.hours > 0) return `${p.hours}h ${p.minutes}m ${p.seconds}s`;
  return `${String(p.minutes).padStart(2, '0')}:${String(p.seconds).padStart(2, '0')}`;
}
