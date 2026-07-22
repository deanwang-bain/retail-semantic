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
  neo4j: { ok: boolean; latencyMs: number; error?: string };
  postgres: {
    ok: boolean;
    latencyMs: number;
    pgvector?: boolean;
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
          Phase 1 check — Neo4j (ontology) and Postgres + pgvector (embeddings)
          must both be reachable. Run{" "}
          <code className="rounded bg-muted px-1">docker compose up -d</code>{" "}
          first.
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
          <div className="grid gap-3 sm:grid-cols-3">
            <StatusRow
              label="Neo4j"
              ok={health.neo4j.ok}
              detail={
                health.neo4j.ok
                  ? `${health.neo4j.latencyMs}ms`
                  : health.neo4j.error
              }
            />
            <StatusRow
              label="Postgres"
              ok={health.postgres.ok}
              detail={
                health.postgres.ok
                  ? `${health.postgres.latencyMs}ms · pgvector ${
                      health.postgres.pgvector ? "on" : "off"
                    }`
                  : health.postgres.error
              }
            />
            <StatusRow
              label="AI mode"
              ok={true}
              detail={`LLM ${health.ai.llm} · emb ${health.ai.embeddings}`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={ok ? "default" : "destructive"}>
          {ok ? "ok" : "down"}
        </Badge>
      </div>
      {detail && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}
