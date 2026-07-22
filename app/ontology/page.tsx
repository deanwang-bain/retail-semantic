"use client";

import { OntologyGraph } from "@/components/ontology/ontology-graph";

export default function OntologyPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col px-6 py-4">
      <div className="mb-3 shrink-0">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          Ontology Explorer
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The retail knowledge graph. Fuzzy language enters through{" "}
          <strong className="text-foreground">Concept</strong> nodes; structured
          precision comes out through{" "}
          <strong className="text-foreground">Attribute</strong> nodes via{" "}
          <code className="rounded bg-muted px-1">MAPS_TO</code>. That middle
          layer <em>is</em> the semantic layer.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <OntologyGraph height="100%" />
      </div>
    </div>
  );
}
