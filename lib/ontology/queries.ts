/**
 * Read helpers over the embedded retail ontology graph.
 */
import { ensureStore } from "@/lib/store/runtime";
import { getStore, type NodeLabel } from "@/lib/store/types";
import type { GraphLink, GraphNode } from "./types";

export type { GraphLink, GraphNode };
export { NODE_COLORS } from "./types";

export async function getGraphStats() {
  await ensureStore();
  return getStore().counts();
}

export async function fetchOntologyGraph(opts?: {
  types?: string[];
  limit?: number;
  search?: string;
}): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  await ensureStore();
  const store = getStore();
  const limit = opts?.limit ?? 180;
  const types = opts?.types;
  const search = opts?.search?.trim().toLowerCase();

  let candidates = Array.from(store.nodes.values()).filter((n) => {
    if (types && types.length && !types.includes(n.label)) return false;
    if (!search) return true;
    const hay = `${n.props.name ?? ""} ${n.props.sku ?? ""} ${n.props.id ?? ""} ${n.props.description ?? ""}`.toLowerCase();
    return hay.includes(search);
  });

  // Prefer semantic-layer core when no search
  if (!search) {
    const prefer = ["Concept", "Attribute", "Product", "Category"];
    candidates.sort((a, b) => {
      const ai = prefer.indexOf(a.label);
      const bi = prefer.indexOf(b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }
  candidates = candidates.slice(0, limit);

  const nodeMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const linkKeys = new Set<string>();

  const addNode = (id: string) => {
    const n = store.nodes.get(id);
    if (!n || nodeMap.has(id)) return;
    if (types && types.length && !types.includes(n.label)) return;
    nodeMap.set(id, {
      id: n.id,
      label: String(n.props.name ?? n.props.sku ?? n.props.id ?? n.label),
      type: n.label,
      properties: n.props,
    });
  };

  for (const n of candidates) {
    addNode(n.id);
    for (const e of [...store.outEdges(n.id), ...store.inEdges(n.id)]) {
      const other = e.from === n.id ? e.to : e.from;
      addNode(other);
      if (!nodeMap.has(other)) continue;
      const key = `${e.from}|${e.type}|${e.to}`;
      if (linkKeys.has(key)) continue;
      linkKeys.add(key);
      links.push({ source: e.from, target: e.to, type: e.type });
    }
  }

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
}

export async function getNodeDetails(nodeKey: string): Promise<{
  node: GraphNode | null;
  relationships: Array<{ type: string; direction: string; other: GraphNode }>;
}> {
  await ensureStore();
  const store = getStore();
  let n = store.nodes.get(nodeKey);
  if (!n) {
    const [label, ...rest] = nodeKey.split(":");
    const key = rest.join(":");
    n =
      store.findByProp(label as NodeLabel, "sku", key) ||
      store.findByProp(label as NodeLabel, "id", key) ||
      store.findByProp(label as NodeLabel, "name", key) ||
      store.findByProp(label as NodeLabel, "uid", key);
  }
  if (!n) return { node: null, relationships: [] };

  const node: GraphNode = {
    id: n.id,
    label: String(n.props.name ?? n.props.sku ?? n.props.id ?? n.label),
    type: n.label,
    properties: n.props,
  };

  const relationships: Array<{
    type: string;
    direction: string;
    other: GraphNode;
  }> = [];
  for (const e of store.outEdges(n.id)) {
    const o = store.nodes.get(e.to);
    if (!o) continue;
    relationships.push({
      type: e.type,
      direction: "out",
      other: {
        id: o.id,
        label: String(o.props.name ?? o.props.sku ?? o.props.id ?? o.label),
        type: o.label,
        properties: o.props,
      },
    });
  }
  for (const e of store.inEdges(n.id)) {
    const o = store.nodes.get(e.from);
    if (!o) continue;
    relationships.push({
      type: e.type,
      direction: "in",
      other: {
        id: o.id,
        label: String(o.props.name ?? o.props.sku ?? o.props.id ?? o.label),
        type: o.label,
        properties: o.props,
      },
    });
  }
  return { node, relationships };
}
