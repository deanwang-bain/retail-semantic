/**
 * Embedded retail ontology store — no Neo4j / Postgres / Docker.
 *
 * Graph + embeddings live in-process (globalThis singleton). Seeded from
 * data/snapshot.json (committed) so Vercel deploys work with zero infra.
 * Mutations (ingest) update the live store; Reset reloads the snapshot.
 */
export type NodeLabel =
  | "Product"
  | "Category"
  | "Attribute"
  | "Concept"
  | "Customer"
  | "Order"
  | "Review"
  | "Store"
  | "Region"
  | "Signal";

export type RelType =
  | "IN_CATEGORY"
  | "SUBCATEGORY_OF"
  | "HAS_ATTRIBUTE"
  | "MAPS_TO"
  | "SYNONYM_OF"
  | "PLACED"
  | "CONTAINS"
  | "WROTE"
  | "ABOUT"
  | "MENTIONS"
  | "STOCKED_AT"
  | "IN_REGION"
  | "EXPRESSED"
  | "REGARDS";

export type GraphNodeRec = {
  id: string; // e.g. Product:SKU-0001
  label: NodeLabel;
  props: Record<string, unknown>;
};

export type GraphEdgeRec = {
  id: string;
  type: RelType;
  from: string;
  to: string;
  props?: Record<string, unknown>;
};

export type EmbeddingRec = {
  id: string;
  entityType: "product" | "review" | "concept";
  entityId: string;
  content: string;
  embedding: number[];
};

export type Snapshot = {
  version: 1;
  nodes: GraphNodeRec[];
  edges: GraphEdgeRec[];
  embeddings: EmbeddingRec[];
};

export class OntologyStore {
  nodes = new Map<string, GraphNodeRec>();
  edges = new Map<string, GraphEdgeRec>();
  /** adjacency: nodeId -> edgeIds */
  out = new Map<string, string[]>();
  inn = new Map<string, string[]>();
  embeddings = new Map<string, EmbeddingRec>();

  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.out.clear();
    this.inn.clear();
    this.embeddings.clear();
  }

  loadSnapshot(snap: Snapshot) {
    this.clear();
    for (const n of snap.nodes) this.nodes.set(n.id, structuredClone(n));
    for (const e of snap.edges) this.addEdge(structuredClone(e));
    for (const emb of snap.embeddings) {
      this.embeddings.set(emb.id, structuredClone(emb));
    }
  }

  toSnapshot(): Snapshot {
    return {
      version: 1,
      nodes: Array.from(this.nodes.values()).map((n) => structuredClone(n)),
      edges: Array.from(this.edges.values()).map((e) => structuredClone(e)),
      embeddings: Array.from(this.embeddings.values()).map((e) =>
        structuredClone(e)
      ),
    };
  }

  upsertNode(node: GraphNodeRec) {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdgeRec) {
    this.edges.set(edge.id, edge);
    const outs = this.out.get(edge.from) ?? [];
    outs.push(edge.id);
    this.out.set(edge.from, outs);
    const inns = this.inn.get(edge.to) ?? [];
    inns.push(edge.id);
    this.inn.set(edge.to, inns);
  }

  /** MERGE-like edge: reuse if same type+from+to exists */
  mergeEdge(
    type: RelType,
    from: string,
    to: string,
    props?: Record<string, unknown>
  ) {
    for (const eid of this.out.get(from) ?? []) {
      const e = this.edges.get(eid)!;
      if (e.type === type && e.to === to) {
        if (props) e.props = { ...(e.props ?? {}), ...props };
        return e;
      }
    }
    const edge: GraphEdgeRec = {
      id: `${from}|${type}|${to}|${Math.random().toString(36).slice(2, 8)}`,
      type,
      from,
      to,
      props,
    };
    this.addEdge(edge);
    return edge;
  }

  get(id: string) {
    return this.nodes.get(id);
  }

  byLabel(label: NodeLabel): GraphNodeRec[] {
    return Array.from(this.nodes.values()).filter((n) => n.label === label);
  }

  findByProp(
    label: NodeLabel,
    key: string,
    value: unknown
  ): GraphNodeRec | undefined {
    return this.byLabel(label).find((n) => n.props[key] === value);
  }

  outEdges(nodeId: string, type?: RelType): GraphEdgeRec[] {
    return (this.out.get(nodeId) ?? [])
      .map((id) => this.edges.get(id)!)
      .filter((e) => (type ? e.type === type : true));
  }

  inEdges(nodeId: string, type?: RelType): GraphEdgeRec[] {
    return (this.inn.get(nodeId) ?? [])
      .map((id) => this.edges.get(id)!)
      .filter((e) => (type ? e.type === type : true));
  }

  neighbors(
    nodeId: string,
    type: RelType,
    direction: "out" | "in" | "both" = "out"
  ): GraphNodeRec[] {
    const nodes: GraphNodeRec[] = [];
    if (direction === "out" || direction === "both") {
      for (const e of this.outEdges(nodeId, type)) {
        const n = this.nodes.get(e.to);
        if (n) nodes.push(n);
      }
    }
    if (direction === "in" || direction === "both") {
      for (const e of this.inEdges(nodeId, type)) {
        const n = this.nodes.get(e.from);
        if (n) nodes.push(n);
      }
    }
    return nodes;
  }

  /** Follow SYNONYM_OF outbound up to `depth` hops (include start). */
  expandSynonyms(conceptId: string, depth = 2): GraphNodeRec[] {
    const start = this.nodes.get(conceptId);
    if (!start) return [];
    const seen = new Set<string>([conceptId]);
    const out: GraphNodeRec[] = [start];
    let frontier = [conceptId];
    for (let d = 0; d < depth; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const n of this.neighbors(id, "SYNONYM_OF", "out")) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          out.push(n);
          next.push(n.id);
        }
      }
      frontier = next;
    }
    return out;
  }

  counts() {
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};
    for (const n of this.nodes.values()) {
      nodesByType[n.label] = (nodesByType[n.label] ?? 0) + 1;
    }
    for (const e of this.edges.values()) {
      edgesByType[e.type] = (edgesByType[e.type] ?? 0) + 1;
    }
    return {
      nodesByType,
      edgesByType,
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
    };
  }
}

const globalKey = "__retail_ontology_store__";

export function getStore(): OntologyStore {
  const g = globalThis as unknown as Record<string, OntologyStore | undefined>;
  if (!g[globalKey]) g[globalKey] = new OntologyStore();
  return g[globalKey]!;
}

export function nodeId(label: NodeLabel, key: string) {
  return `${label}:${key}`;
}
