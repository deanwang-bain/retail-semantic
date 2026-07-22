"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResolutionTrace, type TraceStep } from "@/components/resolution-trace";

type ProductHit = {
  sku: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  description: string;
  category?: string;
  score: number;
  matchedAttributes: string[];
};

type SearchResponse = {
  query: string;
  concepts: string[];
  attributes: string[];
  products: ProductHit[];
  trace: TraceStep[];
  mode: string;
};

const EXAMPLES = [
  "warm jacket for a rainy commute",
  "something breathable for hot weather",
  "windbreaker for the rain",
];

export default function SearchPage() {
  const [query, setQuery] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (q = query) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          UC1 · Semantic product search
        </h1>
        <p className="mt-2 text-muted-foreground">
          Messy language enters through <strong>Concepts</strong>, resolves via{" "}
          <code className="rounded bg-muted px-1">MAPS_TO</code> to Attributes,
          then ranks products with graph overlap + pgvector similarity.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Describe what you want…"
        />
        <Button onClick={() => run()} disabled={loading}>
          {loading ? "Resolving…" : "Search"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <Button
            key={ex}
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery(ex);
              run(ex);
            }}
          >
            {ex}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {result.concepts.map((c) => (
              <Badge key={c} variant="secondary">
                concept:{c}
              </Badge>
            ))}
            {result.attributes.map((a) => (
              <Badge key={a}>{a}</Badge>
            ))}
          </div>

          <ResolutionTrace steps={result.trace} />

          <div className="grid gap-3 sm:grid-cols-2">
            {result.products.map((p) => (
              <Card key={p.sku} className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription>
                    {p.brand} · {p.category} · {p.currency} {p.price}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{p.description}</p>
                  <p className="text-xs">
                    score {p.score.toFixed(2)}
                    {p.matchedAttributes.length > 0 &&
                      ` · attrs ${p.matchedAttributes.join(", ")}`}
                  </p>
                </CardContent>
              </Card>
            ))}
            {result.products.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No strong matches — likely an unmapped concept. Try Ingest &amp;
                Watch to teach the ontology.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
