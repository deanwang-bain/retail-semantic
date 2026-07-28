"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OntologyGraph } from "@/components/ontology/ontology-graph";
import { DEMO_CHURN_CUSTOMER_ID } from "@/lib/demo-constants";

type PresetKey = "email" | "review" | "support" | "news";

type Proposal = {
  extraction: {
    concepts: string[];
    aspects: string[];
    sentiment: string;
    signals: Array<{ type: string; value: string }>;
    summary: string;
  };
  resolved: {
    customerId: string | null;
    productSku: string | null;
    knownConcepts: string[];
    novelConcepts: string[];
  };
  mutations: Array<Record<string, unknown> & { kind: string }>;
  beforeCounts: { nodes: number; edges: number };
  narrative: string[];
};

type ApplyResult = {
  afterCounts: { nodes: number; edges: number };
  newNodeIds: string[];
  churnBefore?: number;
  churnAfter?: number;
  customerId?: string;
};

type SearchSnap = {
  label: string;
  productNames: string[];
  concepts: string[];
  unmappedHint: string;
};

type MarketingMessage = {
  headline: string;
  insights: string[];
  recommendations: string[];
};

const STEPS = [
  "Extract",
  "Resolve / entity-link",
  "Detect novelty",
  "Propose mutations",
  "Apply",
] as const;

export default function IngestPage() {
  const [presets, setPresets] = useState<Record<
    PresetKey,
    {
      label: string;
      source: PresetKey;
      text: string;
      customerId?: string;
      productSku?: string;
      rating?: number;
    }
  > | null>(null);
  const [text, setText] = useState("");
  const [source, setSource] = useState<PresetKey>("email");
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [productSku, setProductSku] = useState<string | undefined>();
  const [rating, setRating] = useState<number | undefined>();
  const [activeStep, setActiveStep] = useState(-1);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [pulseIds, setPulseIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [beforeSearch, setBeforeSearch] = useState<SearchSnap | null>(null);
  const [afterSearch, setAfterSearch] = useState<SearchSnap | null>(null);
  const [graphKey, setGraphKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [marketingMessage, setMarketingMessage] = useState<MarketingMessage | null>(null);
  const [beforeMarketingMessage, setBeforeMarketingMessage] = useState<MarketingMessage | null>(null);

  useEffect(() => {
    fetch("/api/ingest")
      .then((r) => r.json())
      .then((d) => setPresets(d.presets));
  }, []);

  const loadPreset = (key: PresetKey) => {
    if (!presets) return;
    const p = presets[key];
    setSource(key);
    setText(p.text);
    setCustomerId(p.customerId);
    setProductSku(p.productSku);
    setRating(p.rating);
    setProposal(null);
    setApplyResult(null);
    setActiveStep(-1);
    setBeforeSearch(null);
    setAfterSearch(null);
    setMessage(null);
    setMarketingMessage(null);
    setBeforeMarketingMessage(null);
  };

  const runSearchSnap = async (label: string): Promise<SearchSnap> => {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "windbreaker for the rain" }),
    });
    const data = await res.json();
    const unmapped =
      data.trace
        ?.find((t: { detail: string }) => /UNMAPPED/i.test(t.detail))
        ?.detail ?? "";
    return {
      label,
      productNames: (data.products ?? [])
        .slice(0, 4)
        .map((p: { name: string }) => p.name),
      concepts: data.concepts ?? [],
      unmappedHint: unmapped,
    };
  };

  const generateMarketingMessage = async (
    concepts: string[],
    narratives: string[],
    phase: "before" | "after" = "after"
  ): Promise<MarketingMessage> => {
    const res = await fetch("/api/ingest/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concepts, narratives, phase }),
    });
    const data = await res.json();
    return {
      headline: data.headline || "Market Opportunity Update",
      insights: data.insights || [],
      recommendations: data.recommendations || [],
    };
  };

  const propose = async () => {
    setBusy(true);
    setApplyResult(null);
    setMessage(null);
    try {
      // Capture before-state for payoff A when teaching windbreaker
      if (/\bwindbreaker\b/i.test(text)) {
        setBeforeSearch(await runSearchSnap("Before ingestion"));
      }
      for (let i = 0; i < 4; i++) {
        setActiveStep(i);
        await wait(450);
      }
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "propose",
          text,
          source,
          customerId,
          productSku,
          rating,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposal(data);
      setActiveStep(3);
      // For news: capture baseline marketing insights before mutations are applied
      if (source === "news" && data.extraction?.concepts?.length > 0) {
        const beforeMsg = await generateMarketingMessage(
          data.extraction.concepts,
          data.narrative,
          "before"
        );
        setBeforeMarketingMessage(beforeMsg);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      setActiveStep(4);
      await wait(300);
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", proposal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApplyResult(data);
      setPulseIds(data.newNodeIds ?? []);
      setGraphKey((k) => k + 1);
      if (/\bwindbreaker\b/i.test(text) && source === "review") {
        setAfterSearch(await runSearchSnap("After ingestion"));
      }
      // For news ingestion, generate marketing insights
      if (source === "news" && proposal.extraction.concepts.length > 0) {
        const marketMsg = await generateMarketingMessage(
          proposal.extraction.concepts,
          proposal.narrative
        );
        setMarketingMessage(marketMsg);
        setMessage("Mutations applied. Marketing insights generated.");
      } else {
        setMessage("Mutations applied. Graph updated.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setMessage("Resetting ontology (re-seed)…");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposal(null);
      setApplyResult(null);
      setBeforeSearch(null);
      setAfterSearch(null);
      setPulseIds([]);
      setActiveStep(-1);
      setGraphKey((k) => k + 1);
      setMessage(data.message);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const progress = activeStep < 0 ? 0 : ((activeStep + 1) / STEPS.length) * 100;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-3 px-4 py-4 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            Ingest &amp; Watch
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The living semantic layer. Unstructured text → extract → resolve →
            learn synonyms → mutate the ontology. New nodes pulse in on the
            right.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset} disabled={busy}>
          Reset ontology
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        {/* Left — source */}
        <Card className="flex min-h-0 flex-col shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Source</CardTitle>
            <CardDescription>Load a preset unstructured input</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {(["email", "review", "support", "news"] as PresetKey[]).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={source === k ? "default" : "outline"}
                  onClick={() => loadPreset(k)}
                  disabled={!presets}
                >
                  {presets?.[k]?.label ?? k}
                </Button>
              ))}
            </div>
            <Textarea
              className="min-h-[140px] flex-1"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button onClick={propose} disabled={busy || !text.trim()}>
              Run pipeline
            </Button>
          </CardContent>
        </Card>

        {/* Center — pipeline */}
        <Card className="min-h-0 overflow-y-auto shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pipeline</CardTitle>
            <CardDescription>
              {activeStep >= 0
                ? STEPS[Math.min(activeStep, STEPS.length - 1)]
                : "Idle"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} />
            <ol className="space-y-2">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    i === activeStep
                      ? "border-teal-700 bg-teal-50"
                      : i < activeStep
                        ? "border-border bg-muted/40"
                        : "border-dashed border-border opacity-50"
                  }`}
                >
                  <span className="font-medium">
                    {i + 1}. {s}
                  </span>
                </li>
              ))}
            </ol>

            {proposal && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Extraction
                  </p>
                  <p>{proposal.extraction.summary}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {proposal.extraction.concepts.map((c) => (
                      <Badge key={c} variant="secondary">
                        {c}
                      </Badge>
                    ))}
                    <Badge>{proposal.extraction.sentiment}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Entity link
                  </p>
                  <p>
                    Customer {proposal.resolved.customerId ?? "—"} · Product{" "}
                    {proposal.resolved.productSku ?? "—"}
                  </p>
                  {proposal.resolved.novelConcepts.length > 0 && (
                    <p className="mt-1 text-amber-800">
                      Novel: {proposal.resolved.novelConcepts.join(", ")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Proposed mutations
                  </p>
                  <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto font-mono text-[11px]">
                    {proposal.mutations.map((m, i) => (
                      <li key={i} className="rounded bg-muted px-2 py-1">
                        {JSON.stringify(m)}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  Before: {proposal.beforeCounts.nodes} nodes /{" "}
                  {proposal.beforeCounts.edges} edges
                </p>
                <Button onClick={apply} disabled={busy || !!applyResult}>
                  Apply mutations
                </Button>
              </div>
            )}

            {applyResult && (
              <div className="space-y-2 rounded-md border border-teal-700/30 bg-teal-50/50 p-3 text-sm">
                <p>
                  After: {applyResult.afterCounts.nodes} nodes /{" "}
                  {applyResult.afterCounts.edges} edges
                </p>
                {applyResult.churnAfter != null && (
                  <p>
                    Churn risk{" "}
                    <strong>
                      {((applyResult.churnBefore ?? 0) * 100).toFixed(0)}% →{" "}
                      {(applyResult.churnAfter * 100).toFixed(0)}%
                    </strong>{" "}
                    for{" "}
                    <Link
                      className="underline"
                      href={`/customers`}
                    >
                      {applyResult.customerId ?? DEMO_CHURN_CUSTOMER_ID}
                    </Link>
                  </p>
                )}
              </div>
            )}

            {/* Payoff A */}
            {(beforeSearch || afterSearch) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {beforeSearch && (
                  <SearchCompare card={beforeSearch} tone="before" />
                )}
                {afterSearch && (
                  <SearchCompare card={afterSearch} tone="after" />
                )}
              </div>
            )}
            {applyResult && source === "review" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  setAfterSearch(await runSearchSnap("After ingestion (re-run)"));
                }}
              >
                Re-run UC1: “windbreaker for the rain”
              </Button>
            )}
            {/* News Marketing Insights — Before / After */}
            {source === "news" && (beforeMarketingMessage || marketingMessage) && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Marketing Message
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {beforeMarketingMessage && (
                    <div className="space-y-2 rounded-md border border-slate-300 bg-slate-50/70 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Before ingestion
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {beforeMarketingMessage.headline}
                      </p>
                      {beforeMarketingMessage.insights.length > 0 && (
                        <ul className="list-inside list-disc space-y-1 text-[11px] text-slate-700">
                          {beforeMarketingMessage.insights.map((ins, i) => (
                            <li key={i}>{ins}</li>
                          ))}
                        </ul>
                      )}
                      {beforeMarketingMessage.recommendations.length > 0 && (
                        <>
                          <p className="text-[10px] font-medium uppercase text-slate-500 mt-1">
                            Recommendations
                          </p>
                          <ul className="list-inside list-disc space-y-1 text-[11px] text-slate-700">
                            {beforeMarketingMessage.recommendations.map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                  {marketingMessage && (
                    <div className="space-y-2 rounded-md border border-amber-700/30 bg-amber-50/70 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                        After ingestion ✦
                      </p>
                      <p className="text-sm font-semibold text-amber-900">
                        {marketingMessage.headline}
                      </p>
                      {marketingMessage.insights.length > 0 && (
                        <ul className="list-inside list-disc space-y-1 text-[11px] text-amber-800">
                          {marketingMessage.insights.map((ins, i) => (
                            <li key={i}>{ins}</li>
                          ))}
                        </ul>
                      )}
                      {marketingMessage.recommendations.length > 0 && (
                        <>
                          <p className="text-[10px] font-medium uppercase text-amber-700 mt-1">
                            Recommendations
                          </p>
                          <ul className="list-inside list-disc space-y-1 text-[11px] text-amber-800">
                            {marketingMessage.recommendations.map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {message && (
              <p className="text-xs text-muted-foreground">{message}</p>
            )}
          </CardContent>
        </Card>

        {/* Right — live graph */}
        <Card className="flex min-h-0 flex-col shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Live ontology</CardTitle>
            <CardDescription>
              Concept / Attribute focus — new nodes pulse
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <OntologyGraph
              key={graphKey}
              compact
              height="100%"
              defaultTypes={["Concept", "Attribute", "Product", "Signal", "Review"]}
              pulseIds={pulseIds}
              highlightIds={pulseIds}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SearchCompare({
  card,
  tone,
}: {
  card: SearchSnap;
  tone: "before" | "after";
}) {
  return (
    <div
      className={`rounded-md border p-2 text-xs ${
        tone === "after"
          ? "border-teal-700/40 bg-teal-50/60"
          : "border-border bg-muted/30"
      }`}
    >
      <p className="font-medium">{card.label}</p>
      <p className="text-muted-foreground">
        concepts: {card.concepts.join(", ") || "—"}
      </p>
      {card.unmappedHint && (
        <p className="mt-1 text-amber-800">{card.unmappedHint}</p>
      )}
      <ul className="mt-1 list-inside list-disc">
        {card.productNames.length ? (
          card.productNames.map((n) => <li key={n}>{n}</li>)
        ) : (
          <li>Weak / no structured matches</li>
        )}
      </ul>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
