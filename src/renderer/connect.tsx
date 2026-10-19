import { useState, type FormEvent } from "react";
import { KIT_COPY } from "../shared/copy.js";
import { runsLeftText } from "../shared/format.js";
import type { ConnectFailure } from "../shared/types.js";
import { usePomerado } from "./provider.js";
import { Button } from "./ui.js";

const C = KIT_COPY.connect;

/**
 * Onboarding on rails: create a free account, make a key with the Dashboard's prefilled form,
 * paste it. The key is checked with GET /v1/quota in the main process, which also tells the
 * person how many runs they have today.
 */
export function ConnectScreen({ appName, onDone }: { appName: string; onDone: () => void }) {
  const { bridge, state, quota, setQuota, refresh } = usePomerado();
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<ConnectFailure | null>(null);
  const [connected, setConnected] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    setFailure(null);
    const answer = await bridge.connect(key);
    setChecking(false);
    if (!answer.ok) return setFailure(answer.reason);
    setKey("");
    setQuota(answer.quota);
    setConnected(true);
    await refresh();
  }

  if (connected) {
    return (
      <section className="pk-connect pk-connect--done" aria-labelledby="pk-connected-title">
        <div className="pk-connect-card">
          <h1 id="pk-connected-title" className="pk-title">
            {C.connectedTitle}
          </h1>
          <p className="pk-lede" data-testid="connected-runs">
            {C.connectedBody(runsLeftText(quota))}
          </p>
          <Button variant="primary" onClick={onDone} autoFocus>
            {C.connectedButton}
          </Button>
        </div>
      </section>
    );
  }

  const stored = state?.keyStorage === "memory" ? C.storedMemory : C.storedKeychain;
  return (
    <section className="pk-connect" aria-labelledby="pk-connect-title">
      <div className="pk-arcs" aria-hidden="true">
        <span className="pk-arc pk-arc--crimson pk-arc--left" />
        <span className="pk-arc pk-arc--orange pk-arc--right" />
      </div>
      <div className="pk-connect-card">
        <h1 id="pk-connect-title" className="pk-title">
          {C.heading}
        </h1>
        <p className="pk-lede">{C.lede(appName)}</p>
        <ol className="pk-steps">
          <li className="pk-step">
            <span className="pk-step-number" aria-hidden="true">
              1
            </span>
            <div className="pk-step-body">
              <h2 className="pk-step-title">{C.step1Title}</h2>
              <p className="pk-step-text">{C.step1Body}</p>
              <Button onClick={() => void bridge.open("signUp")}>{C.step1Button}</Button>
              <p className="pk-step-note">{C.step1Skip}</p>
            </div>
          </li>
          <li className="pk-step">
            <span className="pk-step-number" aria-hidden="true">
              2
            </span>
            <div className="pk-step-body">
              <h2 className="pk-step-title">{C.step2Title}</h2>
              <p className="pk-step-text">{C.step2Body}</p>
              <Button onClick={() => void bridge.open("createKey")}>{C.step2Button}</Button>
            </div>
          </li>
          <li className="pk-step">
            <span className="pk-step-number" aria-hidden="true">
              3
            </span>
            <form className="pk-step-body" onSubmit={submit} noValidate>
              <h2 className="pk-step-title">
                <label htmlFor="pk-key">{C.step3Title}</label>
              </h2>
              <p className="pk-step-text pk-visually-hidden">{C.step3Label}</p>
              <input
                id="pk-key"
                className="pk-input pk-input--key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={C.step3Placeholder}
                aria-label={C.step3Label}
                aria-invalid={failure !== null || undefined}
                aria-describedby="pk-key-help"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
              <Button type="submit" variant="primary" busy={checking}>
                {checking ? C.checking : C.step3Button}
              </Button>
              <p id="pk-key-help" className={failure ? "pk-field-error" : "pk-step-note"} role={failure ? "alert" : undefined}>
                {failure ? C.errors[failure] : stored}
              </p>
            </form>
          </li>
        </ol>
      </div>
    </section>
  );
}
