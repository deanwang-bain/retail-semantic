/** Shared ontology graph types + colours (safe for client components). */

export const NODE_COLORS: Record<string, string> = {
  Product: "#0f766e",
  Category: "#1d4ed8",
  Attribute: "#a16207",
  Concept: "#be123c",
  Customer: "#7c3aed",
  Order: "#0369a1",
  Review: "#c2410c",
  Store: "#15803d",
  Region: "#0e7490",
  Signal: "#b91c1c",
};

export type GraphNode = {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  degree?: number;
};

export type GraphLink = {
  source: string;
  target: string;
  type: string;
  highlight?: boolean;
};
