"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type Health = {
  ok: boolean;
  neo4j: { ok: boolean };
  postgres: { ok: boolean };
  ai: { embeddings: string; llm: string };
};

export function StatusBadges() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/health");
        const data = (await res.json()) as Health;
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) {
          setHealth({
            ok: false,
            neo4j: { ok: false },
            postgres: { ok: false },
            ai: { embeddings: "local", llm: "simulated" },
          });
        }
      }
    };
    load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const dbOk = health?.ok ?? false;
  const llmLive = health?.ai.llm === "claude";

  return (
    <div className="flex items-center gap-2">
      <Badge variant={llmLive ? "default" : "secondary"}>
        AI: {llmLive ? "live" : "simulated"}
      </Badge>
      <Badge variant={dbOk ? "default" : "destructive"}>
        DB: {dbOk ? "connected" : "disconnected"}
      </Badge>
      {health && (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          emb: {health.ai.embeddings}
        </span>
      )}
    </div>
  );
}
