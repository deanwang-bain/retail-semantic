"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResolutionTrace, type TraceStep } from "@/components/resolution-trace";

type Customer = {
  id: string;
  name: string;
  segment: string;
  region: string;
};

type Rec = {
  sku: string;
  name: string;
  brand: string;
  price: number;
  description: string;
  why: string;
  path: string;
  score: number;
  availableQty: number;
};

type Result = {
  customerName: string;
  region: string;
  recommendations: Rec[];
  trace: TraceStep[];
};

export default function RecommendationsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("CUST-012");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []));
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/recommendations?customerId=${encodeURIComponent(customerId)}`
      );
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          UC4 · Personalized recommendations
        </h1>
        <p className="mt-2 text-muted-foreground">
          Multi-hop traversal through past products, shared attributes, and
          positively reviewed concepts — filtered by regional stock.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.id}) · {c.region}
            </option>
          ))}
        </select>
        <Button onClick={run} disabled={loading}>
          {loading ? "Traversing…" : "Recommend for them"}
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            For <strong>{result.customerName}</strong> in {result.region}
          </p>
          <ResolutionTrace steps={result.trace} />
          <div className="grid gap-3 sm:grid-cols-2">
            {result.recommendations.map((r) => (
              <Card key={r.sku} className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <CardDescription>
                    {r.brand} · ${r.price} · qty {r.availableQty}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{r.description}</p>
                  <p className="text-teal-800">
                    <strong>Why:</strong> {r.why}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{r.path}</p>
                </CardContent>
              </Card>
            ))}
            {result.recommendations.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No candidates with regional availability.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
