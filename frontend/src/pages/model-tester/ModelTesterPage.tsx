import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Square, XCircle, Zap } from "lucide-react";
import { useGatewayKey } from "../../hooks/useGatewayKey";
import { useToast } from "../../hooks/useToast";
import {
  extractAssistantText,
  listGatewayModels,
  runPool,
  sendChatCompletion,
  type GatewayListResult,
  type GatewayModel,
} from "../../lib/gateway-test";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label, Textarea } from "../../components/ui/Input";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";
import { GatewayKeyField } from "../../components/tester/GatewayKeyField";

type ProbeStatus = "idle" | "running" | "ok" | "fail";

interface ProbeResult {
  status: ProbeStatus;
  httpStatus?: number;
  latencyMs?: number;
  tokens?: number;
  output?: string;
  error?: string;
}

const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 6, 8];

function numeric(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function StatusCell({ status }: { status: ProbeStatus }) {
  if (status === "running") {
    return (
      <Badge tone="primary">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />
        testing
      </Badge>
    );
  }
  if (status === "ok") {
    return (
      <Badge tone="success">
        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
        ok
      </Badge>
    );
  }
  if (status === "fail") {
    return (
      <Badge tone="danger">
        <XCircle className="mr-1 h-3 w-3" aria-hidden />
        fail
      </Badge>
    );
  }
  return <Badge tone="neutral">idle</Badge>;
}

export function ModelTesterPage() {
  const toast = useToast();
  const { apiKey, setApiKey } = useGatewayKey();

  const [models, setModels] = useState<GatewayModel[]>([]);
  const [keyResult, setKeyResult] = useState<GatewayListResult | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  const [prompt, setPrompt] = useState("Reply with the single word: pong.");
  const [maxTokens, setMaxTokens] = useState("16");
  const [concurrency, setConcurrency] = useState(3);

  const [results, setResults] = useState<Record<string, ProbeResult>>({});
  const [running, setRunning] = useState(false);

  const controllersRef = useRef(new Map<string, AbortController>());
  const stopRef = useRef(false);
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
      setResults({});
      if (!response.ok) {
        toast.error(response.errorMessage ?? "This key was rejected by the gateway.");
      } else {
        toast.success(`Key accepted — ${response.models.length} model${response.models.length === 1 ? "" : "s"} to test`);
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

  const probeOne = useCallback(
    async (id: string) => {
      const key = apiKey.trim();
      if (!key) return;
      const controller = new AbortController();
      controllersRef.current.set(id, controller);
      setResults((prev) => ({ ...prev, [id]: { status: "running" } }));

      const max = numeric(maxTokens);
      const body: Record<string, unknown> = {
        model: id,
        messages: [{ role: "user", content: prompt.trim() || "ping" }],
        ...(max !== undefined ? { max_tokens: max } : {}),
      };

      try {
        const response = await sendChatCompletion({ apiKey: key, body, signal: controller.signal });
        const output = (extractAssistantText(response.responseBody) ?? response.streamedText ?? "").trim();
        setResults((prev) => ({
          ...prev,
          [id]: {
            status: response.ok ? "ok" : "fail",
            httpStatus: response.status,
            latencyMs: response.latencyMs,
            tokens: response.usage?.completion_tokens,
            output: output.slice(0, 200),
            error: response.ok ? undefined : response.errorMessage,
          },
        }));
      } catch (caught) {
        const aborted = caught instanceof DOMException && caught.name === "AbortError";
        setResults((prev) => ({
          ...prev,
          [id]: {
            status: "fail",
            error: aborted ? "Stopped" : caught instanceof Error ? caught.message : "Request failed",
          },
        }));
      } finally {
        controllersRef.current.delete(id);
      }
    },
    [apiKey, maxTokens, prompt],
  );

  const probeAll = async () => {
    if (!apiKey.trim()) {
      toast.error("Paste your gateway API key first.");
      return;
    }
    if (models.length === 0) {
      toast.error("Load models first.");
      return;
    }
    stopRef.current = false;
    setRunning(true);
    const ids = models.map((item) => item.id);
    const seed: Record<string, ProbeResult> = {};
    for (const id of ids) seed[id] = { status: "running" };
    setResults(seed);

    try {
      await runPool(ids, concurrency, (id) => probeOne(id), () => stopRef.current);
    } finally {
      setRunning(false);
      stopRef.current = false;
    }
  };

  const stop = () => {
    stopRef.current = true;
    controllersRef.current.forEach((controller) => controller.abort());
  };

  const groups = useMemo(() => {
    const map = new Map<string, GatewayModel[]>();
    for (const item of models) {
      const list = map.get(item.owned_by) ?? [];
      list.push(item);
      map.set(item.owned_by, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [models]);

  const summary = useMemo(() => {
    const values = Object.values(results);
    const ok = values.filter((item) => item.status === "ok").length;
    const fail = values.filter((item) => item.status === "fail").length;
    const busy = values.filter((item) => item.status === "running").length;
    const latencies = values
      .filter((item) => item.status === "ok" && typeof item.latencyMs === "number")
      .map((item) => item.latencyMs as number);
    const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
    return { ok, fail, busy, tested: ok + fail, avg };
  }, [results]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Model tester</h1>
        <p className="mt-1 text-sm text-muted">
          Probe every model your key can reach with one small completion and see which respond, how fast, and what
          the gateway returns. Real calls — they count toward quota and appear in Usage.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Connection"
          description="Authenticate with your own gateway key."
          actions={
            <Button variant="secondary" size="sm" onClick={() => void loadModels()} loading={loadingModels} disabled={!apiKey.trim()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Load models
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <GatewayKeyField value={apiKey} onChange={setApiKey} />
          {keyResult ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={keyResult.ok ? "success" : "danger"}>HTTP {keyResult.status}</Badge>
              <span className="text-muted">{keyResult.latencyMs} ms</span>
              {keyResult.ok ? (
                <span className="text-muted">· {keyResult.models.length} models across {groups.length} providers</span>
              ) : (
                <span className="text-danger">{keyResult.errorMessage}</span>
              )}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Probe settings"
          description={`${models.length} models loaded`}
          actions={
            <div className="flex items-center gap-2">
              {running ? (
                <Button variant="secondary" size="sm" onClick={stop}>
                  <Square className="h-3.5 w-3.5" aria-hidden />
                  Stop
                </Button>
              ) : null}
              <Button size="sm" onClick={() => void probeAll()} loading={running} disabled={models.length === 0}>
                <Zap className="h-3.5 w-3.5" aria-hidden />
                Probe all
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <div>
              <Label htmlFor="model-tester-prompt">Test prompt</Label>
              <Textarea
                id="model-tester-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={2}
                placeholder="Reply with the single word: pong."
              />
            </div>
            <div>
              <Label htmlFor="model-tester-max">Max tokens</Label>
              <Input id="model-tester-max" inputMode="numeric" value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)} className="w-28" />
            </div>
            <div>
              <Label htmlFor="model-tester-conc">Concurrency</Label>
              <select
                id="model-tester-conc"
                className="jb-input w-28"
                value={concurrency}
                onChange={(event) => setConcurrency(Number(event.target.value))}
                disabled={running}
              >
                {CONCURRENCY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="success">{summary.ok} ok</Badge>
            <Badge tone="danger">{summary.fail} failed</Badge>
            {summary.busy > 0 ? <Badge tone="primary">{summary.busy} running</Badge> : null}
            <span className="text-muted">
              {summary.tested} tested
              {summary.avg !== null ? ` · avg ${summary.avg} ms` : ""}
            </span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Models" description="Grouped by provider. Test one or all." />
        <CardBody className="p-0">
          {models.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Enter your API key and press “Load models” to begin.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Model</TH>
                  <TH>Status</TH>
                  <TH>HTTP</TH>
                  <TH>Latency</TH>
                  <TH>Output</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {groups.map(([provider, list]) => (
                  <Fragment key={provider}>
                    <TR className="bg-surface/70">
                      <TD className="text-xs font-semibold uppercase tracking-wide text-muted" >
                        {provider} · {list.length}
                      </TD>
                      <TD />
                      <TD />
                      <TD />
                      <TD />
                      <TD />
                    </TR>
                    {list.map((item) => {
                      const state = results[item.id];
                      const status = state?.status ?? "idle";
                      return (
                        <TR key={item.id}>
                          <TD className="font-mono text-xs">{item.id}</TD>
                          <TD>
                            <StatusCell status={status} />
                          </TD>
                          <TD className="text-muted">{state?.httpStatus ?? "—"}</TD>
                          <TD className="text-muted">{typeof state?.latencyMs === "number" ? `${state.latencyMs} ms` : "—"}</TD>
                          <TD className="max-w-xs">
                            {state?.error ? (
                              <span className="text-danger">{state.error}</span>
                            ) : state?.output ? (
                              <span className="text-muted">{state.output}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </TD>
                          <TD>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void probeOne(item.id)}
                              disabled={status === "running" || running}
                            >
                              Test
                            </Button>
                          </TD>
                        </TR>
                      );
                    })}
                  </Fragment>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
