import { useEffect, useRef, useState, type FormEvent } from "react";
import { KIT_COPY } from "../shared/copy.js";
import type { Settings } from "../shared/types.js";
import { usePomerado } from "./provider.js";
import { Button } from "./ui.js";

const S = KIT_COPY.settings;
const STANDARD: Settings = { apiBase: "https://api.pomerado.ai/v1", dashboardBase: "https://app.pomerado.ai" };

/**
 * Where the app reaches Pomerado, and disconnecting. The addresses default to production; a
 * developer can point them at Pomerado's staging. Changing the API address disconnects the key,
 * so a key only ever goes to the API it was checked against.
 */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { bridge, state, setState, setQuota } = usePomerado();
  const [values, setValues] = useState<Settings | null>(null);
  const [invalid, setInvalid] = useState<keyof Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    void bridge.settings().then(setValues);
    dialog.current?.showModal();
  }, [bridge]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!values) return;
    const answer = await bridge.saveSettings(values);
    if (!answer.ok) return setInvalid(answer.field);
    setInvalid(null);
    setValues(answer.settings);
    setState(answer.state);
    if (!answer.state.connected) setQuota(null);
    setSaved(true);
  }

  async function disconnect() {
    setState(await bridge.disconnect());
    setQuota(null);
    onClose();
  }

  const field = (name: keyof Settings, label: string) => (
    <div className="pk-field" data-invalid={invalid === name || undefined}>
      <label className="pk-label" htmlFor={`pk-setting-${name}`}>
        {label}
      </label>
      <input
        id={`pk-setting-${name}`}
        className="pk-input"
        type="url"
        spellCheck={false}
        value={values?.[name] ?? ""}
        aria-invalid={invalid === name || undefined}
        onChange={(event) => {
          setSaved(false);
          setValues((current) => (current ? { ...current, [name]: event.target.value } : current));
        }}
      />
      {invalid === name ? <p className="pk-field-error">{S.invalidAddress}</p> : null}
    </div>
  );

  return (
    <dialog ref={dialog} className="pk-sheet" onClose={onClose} aria-labelledby="pk-settings-title">
      <form className="pk-sheet-body" onSubmit={save} noValidate>
        <div className="pk-sheet-head">
          <h2 id="pk-settings-title" className="pk-sheet-title">
            {S.title}
          </h2>
          <Button variant="quiet" onClick={() => dialog.current?.close()}>
            {S.close}
          </Button>
        </div>
        {field("apiBase", S.apiBase)}
        {field("dashboardBase", S.dashboardBase)}
        <p className="pk-field-hint">{S.addressHint}</p>
        <div className="pk-sheet-actions">
          <Button type="submit" variant="primary">
            {S.save}
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setSaved(false);
              setValues(STANDARD);
            }}
          >
            {S.reset}
          </Button>
          {saved ? (
            <span className="pk-saved" role="status">
              {S.saved}
            </span>
          ) : null}
        </div>
        {state?.connected ? (
          <div className="pk-sheet-danger">
            <Button onClick={() => void disconnect()}>{S.disconnect}</Button>
            <p className="pk-field-hint">{S.disconnectHint}</p>
          </div>
        ) : null}
      </form>
    </dialog>
  );
}
