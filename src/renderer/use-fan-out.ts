import { useCallback, useEffect, useRef, useState } from "react";
import { startFanOut, type FanOut, type FanOutState, type SiteRun } from "../shared/engine.js";
import { usePomerado } from "./provider.js";

/**
 * The fan-out engine as a React hook. A new search stops the last one, and leaving (unmounting,
 * reloading or closing the window) stops whatever is still running, which cancels its jobs.
 */
export function useFanOut(options: { concurrency?: number; pollMs?: number; readingAfterMs?: number } = {}) {
  const { bridge, setQuota } = usePomerado();
  const [state, setState] = useState<FanOutState | null>(null);
  const current = useRef<FanOut | null>(null);
  const wasRunning = useRef(false);

  // Once a search ends, today's runs are read again so the meter stays true.
  useEffect(() => {
    const running = state?.running ?? false;
    if (wasRunning.current && !running && state && !state.quota && !state.authLost) {
      void bridge.quota().then((answer) => {
        if (answer.ok) setQuota(answer.quota);
      });
    }
    wasRunning.current = running;
  }, [state, bridge, setQuota]);
  const { concurrency, pollMs, readingAfterMs } = options;

  const stop = useCallback(() => {
    current.current?.stop();
  }, []);

  const start = useCallback(
    (sites: SiteRun[]) => {
      current.current?.stop();
      current.current = startFanOut({
        sites,
        bridge,
        concurrency,
        pollMs,
        readingAfterMs,
        onChange: (next) => {
          setState(next);
          if (next.quota) setQuota({ remaining: 0, limit: null, resetsAt: next.quota.resetAt });
        },
      });
    },
    [bridge, concurrency, pollMs, readingAfterMs, setQuota],
  );

  const reset = useCallback(() => {
    current.current?.stop();
    current.current = null;
    setState(null);
  }, []);

  useEffect(() => {
    const leave = () => current.current?.stop();
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  return {
    state,
    start,
    stop,
    reset,
    loadMore: (key: string) => current.current?.loadMore(key),
    answer: (key: string) => current.current?.answer(key),
    retry: (key: string) => current.current?.retry(key),
  };
}
