"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NODE_COLORS, type GraphLink, type GraphNode } from "@/lib/ontology/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const ALL_TYPES = Object.keys(NODE_COLORS);

type Props = {
  highlightIds?: string[];
  pulseIds?: string[];
  height?: number | string;
  defaultTypes?: string[];
  compact?: boolean;
};

export function OntologyGraph({
  highlightIds = [],
  pulseIds = [],
  height = "100%",
  defaultTypes = ["Concept", "Attribute", "Product", "Category"],
  compact = false,
}: Props) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [types, setTypes] = useState<string[]>(defaultTypes);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    node: GraphNode;
    relationships: Array<{ type: string; direction: string; other: GraphNode }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const fgRef = useRef<{ zoomToFit?: (ms?: number, padding?: number) => void } | null>(null);
  const pulseSet = useMemo(() => new Set(pulseIds), [pulseIds]);
  const highlightSet = useMemo(() => new Set(highlightIds), [highlightIds]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (types.length) params.set("types", types.join(","));
      if (search) params.set("search", search);
      const res = await fetch(`/api/ontology?${params}`);
      const data = await res.json();
      setNodes(data.nodes ?? []);
      setLinks(data.links ?? []);
    } finally {
      setLoading(false);
    }
  }, [types, search]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    }),
    [nodes, links]
  );

  const toggleType = (t: string) => {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const inspect = async (node: GraphNode) => {
    const res = await fetch(
      `/api/ontology?view=node&id=${encodeURIComponent(node.id)}`
    );
    const data = await res.json();
    setSelected(data);
  };

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-3">
      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search nodes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
          <span className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${nodes.length} nodes · ${links.length} edges`}
          </span>
        </div>
      )}
      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs transition-opacity"
              style={{ opacity: types.includes(t) ? 1 : 0.35 }}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: NODE_COLORS[t] }}
              />
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 gap-3">
        <div
          className="relative min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-white/70"
          style={{ height }}
        >
          <ForceGraph2D
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({
              ref: fgRef,
              graphData,
              nodeId: "id",
              linkDirectionalArrowLength: 3.5,
              linkDirectionalArrowRelPos: 1,
              linkWidth: (l: GraphLink) =>
                l.type === "MAPS_TO" || l.type === "SYNONYM_OF" ? 2.2 : 1,
              linkColor: (l: GraphLink) =>
                l.type === "MAPS_TO"
                  ? "#be123c"
                  : l.type === "SYNONYM_OF"
                    ? "#a16207"
                    : "#cbd5e1",
              nodeCanvasObject: (
                node: GraphNode & { x?: number; y?: number },
                ctx: CanvasRenderingContext2D,
                globalScale: number
              ) => {
                const label = node.label;
                const fontSize = 12 / globalScale;
                const r = 4 + Math.min(10, (node.degree ?? 1) * 0.6);
                const color = NODE_COLORS[node.type] ?? "#64748b";
                const isPulse = pulseSet.has(node.id);
                const isHi = highlightSet.has(node.id) || isPulse;
                if (isPulse) {
                  ctx.beginPath();
                  ctx.arc(node.x!, node.y!, r + 6, 0, 2 * Math.PI);
                  ctx.fillStyle = "rgba(190, 18, 60, 0.25)";
                  ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
                if (isHi) {
                  ctx.strokeStyle = "#0f172a";
                  ctx.lineWidth = 2 / globalScale;
                  ctx.stroke();
                }
                ctx.font = `${fontSize}px Sans-Serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = "#334155";
                ctx.fillText(label.slice(0, 22), node.x!, node.y! + r + 1);
              },
              onNodeClick: (node: GraphNode) => inspect(node),
              cooldownTicks: 80,
              onEngineStop: () => fgRef.current?.zoomToFit?.(400, 40),
            } as Record<string, unknown>)}
          />
        </div>
        {selected?.node && (
          <aside className="w-72 shrink-0 overflow-y-auto rounded-md border border-border bg-card p-4 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge style={{ background: NODE_COLORS[selected.node.type] }}>
                {selected.node.type}
              </Badge>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
            <h3 className="font-medium">{selected.node.label}</h3>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">
              {JSON.stringify(selected.node.properties, null, 2)}
            </pre>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Relationships
            </p>
            <ul className="mt-1 space-y-1">
              {selected.relationships.map((r, i) => (
                <li key={i} className="text-xs leading-snug">
                  <span className="text-muted-foreground">
                    {r.direction === "out" ? "→" : "←"} {r.type}
                  </span>{" "}
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => inspect(r.other)}
                  >
                    {r.other.label}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Red edges = <code>MAPS_TO</code> (semantic layer). Amber ={" "}
          <code>SYNONYM_OF</code>. Node size scales with degree.
        </p>
      )}
    </div>
  );
}
