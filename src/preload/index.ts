import { CHANNELS, type PomeradoBridge } from "../shared/types.js";

/**
 * The preload half of the bridge: `window.pomerado`, a fixed set of calls into the main process.
 * The window can't send anything else over IPC. The kit doesn't import Electron; the preload
 * script passes in contextBridge and ipcRenderer.
 */

type ContextBridgeLike = { exposeInMainWorld(key: string, api: unknown): void };
type IpcRendererLike = { invoke(channel: string, ...args: unknown[]): Promise<unknown> };

export function createBridge(ipcRenderer: IpcRendererLike): PomeradoBridge {
  const call =
    <T>(channel: string) =>
    (...args: unknown[]) =>
      ipcRenderer.invoke(channel, ...args) as Promise<T>;
  return {
    state: call(CHANNELS.state),
    connect: call(CHANNELS.connect),
    disconnect: call(CHANNELS.disconnect),
    quota: call(CHANNELS.quota),
    run: call(CHANNELS.run),
    job: call(CHANNELS.job),
    cancel: call(CHANNELS.cancel),
    answer: call(CHANNELS.answer),
    open: call(CHANNELS.open),
    openUrl: call(CHANNELS.openUrl),
    settings: call(CHANNELS.settings),
    saveSettings: call(CHANNELS.saveSettings),
  };
}

export function exposePomerado(contextBridge: ContextBridgeLike, ipcRenderer: IpcRendererLike) {
  contextBridge.exposeInMainWorld("pomerado", createBridge(ipcRenderer));
}
