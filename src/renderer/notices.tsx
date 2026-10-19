import { KIT_COPY } from "../shared/copy.js";
import { resetTimeText } from "../shared/format.js";
import { usePomerado } from "./provider.js";
import { Button, Notice } from "./ui.js";

/**
 * The day's runs are used up: when they come back, and the one action that helps now, upgrading
 * to Premium on the Dashboard.
 */
export function QuotaHit({ resetAt }: { resetAt: string | null }) {
  const { bridge } = usePomerado();
  const time = resetTimeText(resetAt);
  return (
    <Notice
      tone="alert"
      testId="quota-hit"
      title={KIT_COPY.quota.title}
      actions={
        <Button variant="primary" onClick={() => void bridge.open("upgrade")}>
          {KIT_COPY.quota.button}
        </Button>
      }
    >
      <p>{time === null ? KIT_COPY.quota.bodyNoTime : KIT_COPY.quota.body(time)}</p>
    </Notice>
  );
}

/** Pomerado stopped accepting the key: connect a new one. */
export function AuthLost({ onReconnect }: { onReconnect: () => void }) {
  return (
    <Notice
      tone="alert"
      testId="auth-lost"
      title={KIT_COPY.authLost.title}
      actions={
        <Button variant="primary" onClick={onReconnect}>
          {KIT_COPY.authLost.button}
        </Button>
      }
    >
      <p>{KIT_COPY.authLost.body}</p>
    </Notice>
  );
}
