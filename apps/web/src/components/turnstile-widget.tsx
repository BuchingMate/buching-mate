import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

// Thin wrapper around Cloudflare Turnstile so signup/login don't each reach into
// import.meta.env or repeat options. Renders nothing when the site key is
// unset (dev convenience: lets a fresh checkout boot without Turnstile).
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

interface Props {
  onToken: (token: string) => void;
  onExpire?: () => void;
}

export const TurnstileWidget = forwardRef<TurnstileInstance | undefined, Props>(
  function TurnstileWidget({ onToken, onExpire }, ref) {
    if (!siteKey) return null;
    return (
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={onToken}
        onExpire={() => {
          onToken("");
          onExpire?.();
        }}
        options={{ theme: "auto" }}
      />
    );
  },
);

export const turnstileEnabled = Boolean(siteKey);
