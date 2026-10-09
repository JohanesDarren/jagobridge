import { useCallback, useState } from "react";
import { loadGatewayKey, saveGatewayKey } from "../lib/gateway-test";

/**
 * The gateway API key the testers authenticate with. It is the caller's own
 * key (same one shown on the API Keys page) and is persisted locally so both
 * testers share it.
 */
export function useGatewayKey() {
  const [apiKey, setApiKeyState] = useState<string>(() => loadGatewayKey());

  const setApiKey = useCallback((next: string) => {
    setApiKeyState(next);
    saveGatewayKey(next.trim());
  }, []);

  return { apiKey, setApiKey };
}
