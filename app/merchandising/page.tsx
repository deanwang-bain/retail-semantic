"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResolutionTrace, type TraceStep } from "@/components/resolution-trace";

type Row = {
  region: string;
  category: string;
  stock: number;
  orderCount: number;
  unitsSold: number;
  sellThrough: number;
  status: string;
};

type Result = {
  focus: string;
  rows: Row[];
  chart: Array<{ region: string; stock: number; unitsSold: number }>;
  highlights: string[];
  trace: TraceStep[];
};

const EXAMPLES = [
  "what's underperforming in Southeast Asia?",
  "where is outerwear overstocked?",
];

export default function MerchandisingPage() {
  const [query, setQuery] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (q = query) => {
    setLoading(true);
    try {
      const res = await fetch("/api/merchandising", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          UC3 · Merchandising &amp; inventory
        </h1>
        <p className="mt-2 text-muted-foreground">
          Traverse <code className="rounded bg-muted px-1">Store → IN_REGION</code>,
          join stock with order velocity across SG / TH / MY / PH / VN.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button onClick={() => run()} disabled={loading}>
          {loading ? "Querying…" : "Ask"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <Button
            key={ex}
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery(ex);
              run(ex);
            }}
          >
            {ex}
          </Button>
        ))}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {result.highlights.map((h, i) => (
              <Badge key={i} variant="secondary">
                {h}
              </Badge>
            ))}
          </div>

          <ResolutionTrace steps={result.trace} />

          <div className="h-64 w-full rounded-md border border-border p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="region" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="stock" fill="#0f766e" name="Stock" />
                <Bar dataKey="unitsSold" fill="#a16207" name="Units sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Sell-through</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.slice(0, 40).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.region}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.stock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.orderCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.unitsSold}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(r.sellThrough * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "overstocked" || r.status === "understocked"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
