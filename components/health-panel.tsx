"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type HealthResponse = {
  ok: boolean;
  store: {
    ok: boolean;
    kind?: string;
    latencyMs: number;
    nodes?: number;
    edges?: number;
    embeddings?: number;
    error?: string;
  };
  ai: { embeddings: string; llm: string };
};

export function HealthPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">System health</CardTitle>
        <CardDescription>
          v2 embedded store — no Docker. Ontology + embeddings load from{" "}
          <code className="rounded bg-muted px-1">data/snapshot.json</code>.
          Run <code className="rounded bg-muted px-1">npm run seed</code> to
          regenerate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground">Checking…</p>
        )}
        {!loading && !health && (
          <p className="text-sm text-destructive">
            Could not reach /api/health
          </p>
        )}
        {health && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Embedded store</span>
                <Badge variant={health.store.ok ? "default" : "destructive"}>
                  {health.store.ok ? "ok" : "down"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {health.store.ok
                  ? `${health.store.latencyMs}ms · ${health.store.nodes} nodes · ${health.store.edges} edges · ${health.store.embeddings} vectors`
                  : health.store.error}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">AI mode</span>
                <Badge variant="default">ok</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                LLM {health.ai.llm} · emb {health.ai.embeddings}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
