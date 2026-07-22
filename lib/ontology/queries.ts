/**
 * Read helpers over the retail ontology graph.
 * These Cypher queries are the source of truth for every use-case answer.
 */
import { getSession } from "./neo4j";
import type { GraphLink, GraphNode } from "./types";

export type { GraphLink, GraphNode };
export { NODE_COLORS } from "./types";

export async function getGraphStats(): Promise<{
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  totalNodes: number;
  totalEdges: number;
}> {
  const session = getSession();
  try {
    const nodes = await session.run(`
      MATCH (n)
      WITH labels(n)[0] AS label, count(*) AS c
      RETURN label, c
    `);
    const edges = await session.run(`
      MATCH ()-[r]->()
      WITH type(r) AS t, count(*) AS c
      RETURN t, c
    `);
    const nodesByType: Record<string, number> = {};
    let totalNodes = 0;
    for (const rec of nodes.records) {
      const label = rec.get("label") as string;
      const c = Number(rec.get("c"));
      nodesByType[label] = c;
      totalNodes += c;
    }
    const edgesByType: Record<string, number> = {};
    let totalEdges = 0;
    for (const rec of edges.records) {
      const t = rec.get("t") as string;
      const c = Number(rec.get("c"));
      edgesByType[t] = c;
      totalEdges += c;
    }
    return { nodesByType, edgesByType, totalNodes, totalEdges };
  } finally {
    await session.close();
  }
}

function nodeId(labels: string[], props: Record<string, unknown>): string {
  const type = labels[0] ?? "Node";
  const key =
    (props.sku as string) ||
    (props.id as string) ||
    (props.name as string) ||
    (props.uid as string) ||
    String(props.elementId ?? Math.random());
  return `${type}:${key}`;
}

export async function fetchOntologyGraph(opts?: {
  types?: string[];
  limit?: number;
  search?: string;
}): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const session = getSession();
  const limit = opts?.limit ?? 180;
  const types = opts?.types;
  const search = opts?.search?.trim();

  try {
    // Prefer the semantic-layer core: Concept, Attribute, Product, Category
    const result = await session.run(
      `
      MATCH (n)
      WHERE ($types IS NULL OR labels(n)[0] IN $types)
        AND (
          $search IS NULL OR $search = '' OR
          toLower(coalesce(n.name, '')) CONTAINS toLower($search) OR
          toLower(coalesce(n.sku, '')) CONTAINS toLower($search) OR
          toLower(coalesce(n.id, '')) CONTAINS toLower($search) OR
          toLower(coalesce(n.description, '')) CONTAINS toLower($search)
        )
      WITH n LIMIT $limit
      OPTIONAL MATCH (n)-[r]-(m)
      WHERE ($types IS NULL OR labels(m)[0] IN $types)
      RETURN n, collect(DISTINCT {rel: type(r), other: m, outgoing: startNode(r) = n}) AS rels
      `,
      {
        types: types && types.length > 0 ? types : null,
        search: search || null,
        limit,
      }
    );

    const nodeMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const linkKeys = new Set<string>();

    for (const rec of result.records) {
      const n = rec.get("n");
      const nLabels: string[] = n.labels;
      const nProps = n.properties as Record<string, unknown>;
      const nid = nodeId(nLabels, nProps);
      if (!nodeMap.has(nid)) {
        nodeMap.set(nid, {
          id: nid,
          label: String(nProps.name ?? nProps.sku ?? nProps.id ?? nLabels[0]),
          type: nLabels[0],
          properties: nProps,
        });
      }

      const rels = rec.get("rels") as Array<{
        rel: string;
        other: { labels: string[]; properties: Record<string, unknown> } | null;
        outgoing: boolean;
      }>;

      for (const item of rels) {
        if (!item.other) continue;
        const o = item.other;
        const oid = nodeId(o.labels, o.properties);
        if (!nodeMap.has(oid)) {
          nodeMap.set(oid, {
            id: oid,
            label: String(
              o.properties.name ?? o.properties.sku ?? o.properties.id ?? o.labels[0]
            ),
            type: o.labels[0],
            properties: o.properties,
          });
        }
        const source = item.outgoing ? nid : oid;
        const target = item.outgoing ? oid : nid;
        const key = `${source}|${item.rel}|${target}`;
        if (!linkKeys.has(key)) {
          linkKeys.add(key);
          links.push({ source, target, type: item.rel });
        }
      }
    }

    // Degree for sizing
    const degree = new Map<string, number>();
    for (const l of links) {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    }
    const nodes = Array.from(nodeMap.values()).map((n) => ({
      ...n,
      degree: degree.get(n.id) ?? 1,
    }));

    return { nodes, links };
  } finally {
    await session.close();
  }
}

export async function getNodeDetails(nodeKey: string): Promise<{
  node: GraphNode | null;
  relationships: Array<{ type: string; direction: string; other: GraphNode }>;
}> {
  const [type, ...rest] = nodeKey.split(":");
  const key = rest.join(":");
  const session = getSession();
  try {
    const result = await session.run(
      `
      MATCH (n)
      WHERE labels(n)[0] = $type AND (
        n.sku = $key OR n.id = $key OR n.name = $key OR n.uid = $key
      )
      OPTIONAL MATCH (n)-[r]-(m)
      RETURN n,
        collect(DISTINCT {
          type: type(r),
          direction: CASE WHEN startNode(r) = n THEN 'out' ELSE 'in' END,
          other: m
        }) AS rels
      LIMIT 1
      `,
      { type, key }
    );
    if (result.records.length === 0) return { node: null, relationships: [] };
    const n = result.records[0].get("n");
    const node: GraphNode = {
      id: nodeKey,
      label: String(n.properties.name ?? n.properties.sku ?? n.properties.id),
      type: n.labels[0],
      properties: n.properties,
    };
    const relationships = (
      result.records[0].get("rels") as Array<{
        type: string;
        direction: string;
        other: { labels: string[]; properties: Record<string, unknown> } | null;
      }>
    )
      .filter((r) => r.other)
      .map((r) => ({
        type: r.type,
        direction: r.direction,
        other: {
          id: nodeId(r.other!.labels, r.other!.properties),
          label: String(
            r.other!.properties.name ??
              r.other!.properties.sku ??
              r.other!.properties.id
          ),
          type: r.other!.labels[0],
          properties: r.other!.properties,
        },
      }));
    return { node, relationships };
  } finally {
    await session.close();
  }
}
