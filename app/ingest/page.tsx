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

type MarketingImpact = {
  area: string;
  points: string[];
};

type CascadeStats = {
  ontologyMutations: number;
  skusAffected: number;
  customersAlerted: number;
  campaignsDrafted: number;
  supplierAlerts: number;
  timeToAction: string;
};

type ActionItem = {
  type: string;
  label: string;
  detail: string;
  risk: string;
};

type MarketingMessage = {
  headline: string;
  insights: string[];
  recommendations: string[];
  impactedPoints: MarketingImpact[];
  cascadeStats: CascadeStats;
  actionItems: ActionItem[];
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
  const [busy, setBusy] = useState(false);
  const [beforeSearch, setBeforeSearch] = useState<SearchSnap | null>(null);
  const [afterSearch, setAfterSearch] = useState<SearchSnap | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [marketingMessage, setMarketingMessage] = useState<MarketingMessage | null>(null);
  const [beforeMarketingMessage, setBeforeMarketingMessage] = useState<MarketingMessage | null>(null);
  const [newsSearchBefore, setNewsSearchBefore] = useState<SearchSnap | null>(null);
  const [newsSearchAfter, setNewsSearchAfter] = useState<SearchSnap | null>(null);

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
    setNewsSearchBefore(null);
    setNewsSearchAfter(null);
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

  const runNewsSearchSnap = async (label: string): Promise<SearchSnap> => {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "monsoon jacket waterproof" }),
    });
    const data = await res.json();
    return {
      label,
      productNames: (data.products ?? []).slice(0, 4).map((p: { name: string }) => p.name),
      concepts: data.concepts ?? [],
      unmappedHint: data.trace?.find((t: { detail: string }) => /UNMAPPED/i.test(t.detail))?.detail ?? "",
    };
  };

  const generateMarketingMessage = async (
    concepts: string[],
    narratives: string[],
    phase: "before" | "after" = "after",
    mutationCount = 0
  ): Promise<MarketingMessage> => {
    const res = await fetch("/api/ingest/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concepts, narratives, phase, mutationCount }),
    });
    const data = await res.json();
    return {
      headline: data.headline || "Market Opportunity Update",
      insights: data.insights || [],
      recommendations: data.recommendations || [],
      impactedPoints: data.impactedPoints || [],
      cascadeStats: data.cascadeStats || { ontologyMutations: 0, skusAffected: 0, customersAlerted: 0, campaignsDrafted: 0, supplierAlerts: 0, timeToAction: "—" },
      actionItems: data.actionItems || [],
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
      // For news: capture baseline marketing insights + search snap before mutations
      if (source === "news" && data.extraction?.concepts?.length > 0) {
        const [beforeMsg, searchSnap] = await Promise.all([
          generateMarketingMessage(data.extraction.concepts, data.narrative, "before", 0),
          runNewsSearchSnap("Without semantic layer"),
        ]);
        setBeforeMarketingMessage(beforeMsg);
        setNewsSearchBefore(searchSnap);
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
      if (/\bwindbreaker\b/i.test(text) && source === "review") {
        setAfterSearch(await runSearchSnap("After ingestion"));
      }
      // For news ingestion, generate marketing insights + post-mutation search
      if (source === "news" && proposal.extraction.concepts.length > 0) {
        const mCount = data.afterCounts.nodes - (proposal.beforeCounts?.nodes ?? data.afterCounts.nodes - 5);
        const [marketMsg, searchSnap] = await Promise.all([
          generateMarketingMessage(proposal.extraction.concepts, proposal.narrative, "after", mCount),
          runNewsSearchSnap("With semantic layer"),
        ]);
        setMarketingMessage(marketMsg);
        setNewsSearchAfter(searchSnap);
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
      setActiveStep(-1);
      setMarketingMessage(null);
      setBeforeMarketingMessage(null);
      setNewsSearchBefore(null);
      setNewsSearchAfter(null);
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
            News Intelligence
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ingest signals &rarr; extract concepts &rarr; mutate the ontology &rarr; watch business impact propagate.
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
            <CardTitle className="text-sm">Signal source</CardTitle>
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
              className="min-h-[140px] flex-1 text-xs"
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
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-1">
                  {proposal.extraction.concepts.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                  ))}
                  <Badge className="text-[10px]">{proposal.extraction.sentiment}</Badge>
                </div>
                {proposal.resolved.novelConcepts.length > 0 && (
                  <p className="text-[11px] text-amber-800">Novel: {proposal.resolved.novelConcepts.join(", ")}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {proposal.mutations.length} mutation{proposal.mutations.length !== 1 ? "s" : ""} proposed
                </p>
                <Button size="sm" onClick={apply} disabled={busy || !!applyResult}>Apply mutations</Button>
              </div>
            )}

            {applyResult && (
              <p className="text-[11px] text-teal-700">
                Applied &rarr; {applyResult.afterCounts.nodes} nodes / {applyResult.afterCounts.edges} edges
              </p>
            )}

            {/* Windbreaker search trigger */}
            {applyResult && source === "review" && !afterSearch && (
              <Button variant="secondary" size="sm"
                onClick={async () => setAfterSearch(await runSearchSnap("After ingestion"))}>
                Run search: &ldquo;windbreaker for the rain&rdquo;
              </Button>
            )}
            {message && <p className="text-[11px] text-muted-foreground">{message}</p>}
          </CardContent>
        </Card>

        {/* Right — before/after impact comparison */}
        <Card className="min-h-0 overflow-y-auto shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Semantic Layer Impact</CardTitle>
            <CardDescription>Before vs after the ontology processes this signal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!proposal && !applyResult && (
              <div className="rounded border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                Run pipeline to see the before state, then apply to see what changes.
              </div>
            )}

            {/* Email: churn risk before/after */}
            {source === "email" && applyResult && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Churn risk</p>
                {applyResult.churnAfter != null ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-slate-300 bg-slate-50/70 p-2 text-center">
                      <p className="text-[9px] uppercase text-slate-500">Before</p>
                      <p className="text-xl font-bold text-slate-700">{((applyResult.churnBefore ?? 0) * 100).toFixed(0)}%</p>
                    </div>
                    <div className="rounded border border-red-300 bg-red-50/70 p-2 text-center">
                      <p className="text-[9px] uppercase text-red-500">After signal</p>
                      <p className="text-xl font-bold text-red-700">{(applyResult.churnAfter * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No churn signal detected.</p>
                )}
                {applyResult.customerId && (
                  <p className="text-[11px]">Customer: <Link className="underline" href="/customers">{applyResult.customerId ?? DEMO_CHURN_CUSTOMER_ID}</Link></p>
                )}
              </div>
            )}

            {/* Review: search before/after */}
            {source === "review" && (beforeSearch || afterSearch) && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Search: &ldquo;windbreaker for the rain&rdquo;
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {beforeSearch && (
                    <div className="rounded border border-slate-200 bg-slate-50/80 p-2 text-[11px]">
                      <p className="mb-1 text-[9px] font-semibold uppercase text-slate-400">Before</p>
                      {beforeSearch.productNames.length === 0
                        ? <p className="italic text-red-600">0 results</p>
                        : <ul className="space-y-0.5 text-slate-600">{beforeSearch.productNames.map((n) => <li key={n}>&middot; {n}</li>)}</ul>
                      }
                      {beforeSearch.unmappedHint && <p className="mt-1 text-[9px] text-amber-600">{beforeSearch.unmappedHint}</p>}
                    </div>
                  )}
                  {afterSearch && (
                    <div className="rounded border border-teal-300 bg-teal-50/80 p-2 text-[11px]">
                      <p className="mb-1 text-[9px] font-semibold uppercase text-teal-600">After &starf;</p>
                      <ul className="space-y-0.5 text-teal-800">{afterSearch.productNames.map((n) => <li key={n}>&middot; {n}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Support: entity resolved */}
            {source === "support" && applyResult && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Signal captured</p>
                <div className="rounded border border-teal-300 bg-teal-50/70 p-2 text-[11px] space-y-1">
                  {proposal?.resolved.customerId && <p>Customer: <strong>{proposal.resolved.customerId}</strong></p>}
                  {proposal?.resolved.productSku && <p>Product: <strong>{proposal.resolved.productSku}</strong></p>}
                  {proposal?.extraction.aspects.length ? <p>Aspects: {proposal.extraction.aspects.join(", ")}</p> : null}
                  <p className="text-teal-700">{applyResult.afterCounts.nodes - proposal!.beforeCounts.nodes} new node(s) added</p>
                </div>
              </div>
            )}

            {/* ── Section 1: Cascade Amplifier ── */}
            {source === "news" && (beforeMarketingMessage || marketingMessage) && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  1 news article → downstream signals
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      { key: "ontologyMutations", label: "Ontology mutations", icon: "⬡" },
                      { key: "skusAffected", label: "SKUs affected", icon: "📦" },
                      { key: "customersAlerted", label: "Customers alerted", icon: "👥" },
                      { key: "campaignsDrafted", label: "Campaigns drafted", icon: "📣" },
                      { key: "supplierAlerts", label: "Supplier alerts", icon: "🚚" },
                    ] as { key: keyof CascadeStats; label: string; icon: string }[]
                  ).map(({ key, label, icon }) => {
                    const before = beforeMarketingMessage?.cascadeStats?.[key] ?? "—";
                    const after = marketingMessage?.cascadeStats?.[key];
                    return (
                      <div key={key} className="rounded border border-border bg-muted/20 px-2 py-1.5 text-[11px]">
                        <p className="text-muted-foreground">{icon} {label}</p>
                        <p className="font-mono font-semibold">
                          <span className="text-slate-400 line-through mr-1">{before}</span>
                          {after != null ? (
                            <span className={typeof after === "number" && after > 0 ? "text-amber-700" : "text-slate-600"}>
                              {after}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">pending…</span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                  <div className="col-span-2 rounded border border-border bg-muted/20 px-2 py-1.5 text-[11px]">
                    <p className="text-muted-foreground">⏱ Time to action</p>
                    <p className="font-mono font-semibold">
                      <span className="text-slate-400 line-through mr-1">
                        {beforeMarketingMessage?.cascadeStats?.timeToAction ?? "—"}
                      </span>
                      {marketingMessage?.cascadeStats?.timeToAction ? (
                        <span className="text-teal-700">{marketingMessage.cascadeStats.timeToAction}</span>
                      ) : (
                        <span className="text-muted-foreground italic">pending…</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Section 2: Search quality ── */}
            {source === "news" && (newsSearchBefore || newsSearchAfter) && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Customer search: &ldquo;monsoon jacket waterproof&rdquo;
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {newsSearchBefore && (
                    <div className="rounded border border-slate-200 bg-slate-50/80 p-2 text-[11px]">
                      <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Without layer</p>
                      {newsSearchBefore.productNames.length === 0 ? (
                        <p className="italic text-red-600">0 results — concept not mapped</p>
                      ) : (
                        <ul className="space-y-0.5 text-slate-600">
                          {newsSearchBefore.productNames.map((n) => <li key={n}>· {n}</li>)}
                        </ul>
                      )}
                      {newsSearchBefore.unmappedHint && (
                        <p className="mt-1 text-[10px] text-red-500">{newsSearchBefore.unmappedHint}</p>
                      )}
                    </div>
                  )}
                  {newsSearchAfter && (
                    <div className="rounded border border-teal-300 bg-teal-50/80 p-2 text-[11px]">
                      <p className="mb-1 text-[10px] font-semibold uppercase text-teal-600">With layer ✦</p>
                      {newsSearchAfter.productNames.length === 0 ? (
                        <p className="italic text-muted-foreground">No results yet</p>
                      ) : (
                        <ul className="space-y-0.5 text-teal-800">
                          {newsSearchAfter.productNames.map((n) => <li key={n}>· {n}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Section 3: Specific action items ── */}
            {source === "news" && (beforeMarketingMessage || marketingMessage) && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Actionable signals generated
                </p>
                {!marketingMessage && (
                  <p className="text-[11px] italic text-muted-foreground">Apply mutations to unlock specific actions.</p>
                )}
                {(marketingMessage ?? beforeMarketingMessage)?.actionItems.map((item, i) => {
                  const riskColor =
                    item.risk === "high" ? "border-red-300 bg-red-50/60 text-red-900"
                    : item.risk === "medium" ? "border-amber-300 bg-amber-50/60 text-amber-900"
                    : item.risk === "opportunity" ? "border-teal-300 bg-teal-50/60 text-teal-900"
                    : "border-slate-200 bg-slate-50/60 text-slate-600";
                  const badge =
                    item.risk === "high" ? "🔴 High risk"
                    : item.risk === "medium" ? "🟡 Medium"
                    : item.risk === "opportunity" ? "🟢 Opportunity"
                    : "— No signal";
                  return (
                    <div key={i} className={`rounded border px-2 py-1.5 text-[11px] ${riskColor}`}>
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold leading-tight">{item.label}</p>
                        <span className="shrink-0 text-[9px] font-medium opacity-80">{badge}</span>
                      </div>
                      <p className="mt-0.5 opacity-80">{item.detail}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
