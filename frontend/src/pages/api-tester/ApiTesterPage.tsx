import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, Play, RefreshCw, Square, XCircle } from "lucide-react";
import { useGatewayKey } from "../../hooks/useGatewayKey";
import { useToast } from "../../hooks/useToast";
import {
  listGatewayModels,
  prettyJson,
  sendChatCompletion,
  toCurl,
  type GatewayCallResult,
  type GatewayListResult,
  type GatewayModel,
} from "../../lib/gateway-test";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label, Select, Textarea } from "../../components/ui/Input";
import { GatewayKeyField } from "../../components/tester/GatewayKeyField";

function numeric(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function StatusPill({ ok, status }: { ok: boolean; status: number }) {
  return (
    <Badge tone={ok ? "success" : "danger"}>
      {ok ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
      HTTP {status}
    </Badge>
  );
}

export function ApiTesterPage() {
  const toast = useToast();
  const { apiKey, setApiKey } = useGatewayKey();

  const [models, setModels] = useState<GatewayModel[]>([]);
  const [keyResult, setKeyResult] = useState<GatewayListResult | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  const [model, setModel] = useState("");
  const [system, setSystem] = useState("");
  const [prompt, setPrompt] = useState("Say hello in one short sentence.");
  const [temperature, setTemperature] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [topP, setTopP] = useState("");
  const [stream, setStream] = useState(false);
  const [extra, setExtra] = useState("");

  const [result, setResult] = useState<GatewayCallResult | null>(null);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const autoLoaded = useRef(false);

  const loadModels = useCallback(async () => {
    const key = apiKey.trim();
    if (!key) {
      setKeyResult(null);
      setModels([]);
      return;
    }
    setLoadingModels(true);
    try {
      const response = await listGatewayModels(key);
      setKeyResult(response);
      setModels(response.models);
      if (!response.ok) {
        toast.error(response.errorMessage ?? "This key was rejected by the gateway.");
      } else {
        setModel((current) => current || response.models[0]?.id || "");
        toast.success(`Key accepted — ${response.models.length} model${response.models.length === 1 ? "" : "s"} available`);
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not reach the gateway.");
    } finally {
      setLoadingModels(false);
    }
  }, [apiKey, toast]);

  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    if (apiKey.trim()) void loadModels();
  }, [apiKey, loadModels]);

  const buildBody = (): Record<string, unknown> => {
    if (!model.trim()) throw new Error("Choose a model first.");
    if (!prompt.trim()) throw new Error("Enter a user message.");
    const body: Record<string, unknown> = {
      model: model.trim(),
      messages: [
        ...(system.trim() ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    };
    if (stream) body.stream = true;
    const temp = numeric(temperature);
    if (temp !== undefined) body.temperature = temp;
    const max = numeric(maxTokens);
    if (max !== undefined) body.max_tokens = max;
    const top = numeric(topP);
    if (top !== undefined) body.top_p = top;
    if (extra.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(extra);
      } catch {
        throw new Error("Extra parameters must be valid JSON.");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Extra parameters must be a JSON object.");
      }
      Object.assign(body, parsed as Record<string, unknown>);
    }
    return body;
  };

  const send = async () => {
    const key = apiKey.trim();
    if (!key) {
      setFormError("Paste your gateway API key first.");
      return;
    }
    setFormError(null);
    let body: Record<string, unknown>;
    try {
      body = buildBody();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Invalid request.");
      return;
    }

    setSending(true);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await sendChatCompletion({ apiKey: key, body, signal: controller.signal });
      setResult(response);
      if (!response.ok) toast.error(response.errorMessage ?? `Request failed with HTTP ${response.status}.`);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        toast.error("Request cancelled.");
      } else {
        toast.error(caught instanceof Error ? caught.message : "Could not reach the gateway.");
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to the clipboard");
    }
  };

  const curlSnippet = useMemo(() => {
    const body =
      result?.requestBody ??
      ({
        model: model.trim() || "<model>",
        messages: [{ role: "user", content: prompt || "<prompt>" }],
        ...(stream ? { stream: true } : {}),
      } as Record<string, unknown>);
    return toCurl(apiKey, body);
  }, [apiKey, model, prompt, stream, result]);

  const responseText = result
    ? result.streamedText !== null
      ? result.streamedText
      : result.responseBody
        ? prettyJson(result.responseBody)
        : result.responseText
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">API tester</h1>
        <p className="mt-1 text-sm text-muted">
          Build a raw OpenAI-compatible request against the live gateway and inspect the exact request and response.
          Real calls — they count toward quota and appear in Usage.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Connection"
          description="Authenticate with your own gateway key."
          actions={
            <Button variant="secondary" size="sm" onClick={() => void loadModels()} loading={loadingModels} disabled={!apiKey.trim()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Test key
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <GatewayKeyField value={apiKey} onChange={setApiKey} />
          {keyResult ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusPill ok={keyResult.ok} status={keyResult.status} />
              <span className="text-muted">{keyResult.latencyMs} ms</span>
              {keyResult.ok ? (
                <span className="text-muted">· {keyResult.models.length} models visible to this key</span>
              ) : (
                <span className="text-danger">{keyResult.errorMessage}</span>
              )}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Request"
            description="POST /v1/chat/completions"
            actions={
              <div className="flex items-center gap-2">
                {sending ? (
                  <Button variant="secondary" size="sm" onClick={cancel}>
                    <Square className="h-3.5 w-3.5" aria-hidden />
                    Cancel
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => void send()} loading={sending} disabled={!apiKey.trim()}>
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  Send
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="api-tester-model">Model</Label>
              {models.length > 0 ? (
                <Select id="api-tester-model" value={model} onChange={(event) => setModel(event.target.value)}>
                  {models.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} · {item.owned_by}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="api-tester-model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="e.g. deepseek-v4-flash"
                  className="font-mono text-xs"
                />
              )}
            </div>

            <div>
              <Label htmlFor="api-tester-system">System message (optional)</Label>
              <Textarea
                id="api-tester-system"
                value={system}
                onChange={(event) => setSystem(event.target.value)}
                placeholder="You are a helpful assistant."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="api-tester-prompt">User message</Label>
              <Textarea
                id="api-tester-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask the model something…"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="api-tester-temp">Temperature</Label>
                <Input id="api-tester-temp" inputMode="decimal" value={temperature} onChange={(event) => setTemperature(event.target.value)} placeholder="default" />
              </div>
              <div>
                <Label htmlFor="api-tester-max">Max tokens</Label>
                <Input id="api-tester-max" inputMode="numeric" value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)} placeholder="default" />
              </div>
              <div>
                <Label htmlFor="api-tester-topp">Top P</Label>
                <Input id="api-tester-topp" inputMode="decimal" value={topP} onChange={(event) => setTopP(event.target.value)} placeholder="default" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={stream} onChange={(event) => setStream(event.target.checked)} className="h-4 w-4 rounded border-border" />
              Stream the response (SSE)
            </label>

            <div>
              <Label htmlFor="api-tester-extra">Extra parameters (JSON, optional)</Label>
              <Textarea
                id="api-tester-extra"
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
                placeholder='{ "top_p": 0.9, "frequency_penalty": 0 }'
                className="font-mono text-xs"
                rows={2}
              />
            </div>

            {formError ? (
              <p className="text-sm text-danger" role="alert">
                {formError}
              </p>
            ) : null}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label>Equivalent cURL</Label>
                <Button variant="ghost" size="sm" onClick={() => void copy(curlSnippet, "cURL")}>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copy
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-slate-900 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-100">
                {curlSnippet}
              </pre>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Response"
            description={result ? `${result.requestBody && (result.requestBody as { model?: string }).model} · ${result.latencyMs} ms` : "Send a request to see the raw response."}
            actions={
              result ? (
                <Button variant="ghost" size="sm" onClick={() => void copy(responseText, "Response")}>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copy
                </Button>
              ) : null
            }
          />
          <CardBody className="space-y-4">
            {!result ? (
              <p className="py-6 text-center text-sm text-muted">No response yet.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusPill ok={result.ok} status={result.status} />
                  <span className="text-muted">{result.latencyMs} ms total</span>
                  {result.firstTokenMs !== null ? <span className="text-muted">· {result.firstTokenMs} ms first token</span> : null}
                  {result.usage ? (
                    <span className="text-muted">
                      · {result.usage.prompt_tokens ?? 0} in / {result.usage.completion_tokens ?? 0} out
                      {result.usage.cached_tokens ? ` (${result.usage.cached_tokens} cached)` : ""}
                    </span>
                  ) : null}
                </div>

                {result.errorMessage ? <p className="text-sm text-danger">{result.errorMessage}</p> : null}

                <div>
                  <Label>{result.streamedText !== null ? "Streamed output" : "Response body"}</Label>
                  <pre className="max-h-96 overflow-auto rounded-xl bg-slate-900 px-3.5 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-100">
                    {responseText || "(empty)"}
                  </pre>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label>Request body sent</Label>
                    <Button variant="ghost" size="sm" onClick={() => void copy(prettyJson(result.requestBody), "Request")}>
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copy
                    </Button>
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-xl bg-slate-900 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-100">
                    {prettyJson(result.requestBody)}
                  </pre>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
