import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BridgeState, PomeradoBridge, QuotaView } from "../shared/types.js";

/**
 * The window's view of Pomerado: whether a key is connected, where it is kept, and today's runs.
 * Everything goes through `window.pomerado`, which the preload script exposes.
 */

declare global {
  interface Window {
    pomerado?: PomeradoBridge;
  }
}

export function getBridge(): PomeradoBridge {
  if (!window.pomerado) throw new Error("window.pomerado is missing: call exposePomerado in the preload script");
  return window.pomerado;
}

type PomeradoContext = {
  bridge: PomeradoBridge;
  /** Null until the main process answers. */
  state: BridgeState | null;
  quota: QuotaView | null;
  setQuota(quota: QuotaView | null): void;
  /** Read the connection and today's runs again. */
  refresh(): Promise<void>;
  setState(state: BridgeState): void;
};

const Context = createContext<PomeradoContext | null>(null);

export function PomeradoProvider({ children, bridge }: { children: ReactNode; bridge?: PomeradoBridge }) {
  const api = useMemo(() => bridge ?? getBridge(), [bridge]);
  const [state, setState] = useState<BridgeState | null>(null);
  const [quota, setQuota] = useState<QuotaView | null>(null);

  const refresh = useCallback(async () => {
    const next = await api.state();
    setState(next);
    if (!next.connected) return setQuota(null);
    const answer = await api.quota();
    if (answer.ok) setQuota(answer.quota);
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ bridge: api, state, quota, setQuota, refresh, setState }),
    [api, state, quota, refresh],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePomerado(): PomeradoContext {
  const value = useContext(Context);
  if (!value) throw new Error("usePomerado needs a PomeradoProvider");
  return value;
}
