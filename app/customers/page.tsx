"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResolutionTrace } from "@/components/resolution-trace";
import { DEMO_CHURN_CUSTOMER_ID } from "@/lib/demo-constants";

type Customer = {
  id: string;
  name: string;
  segment: string;
  churn_risk: number;
  lifetime_value: number;
  region: string;
};

type Profile = {
  id: string;
  name: string;
  segment: string;
  lifetime_value: number;
  join_date: string;
  churn_risk: number;
  region: string;
  orders: Array<{ id: string; date: string; total: number; products: string[] }>;
  reviews: Array<{
    id: string;
    rating: number;
    text: string;
    sentiment: string;
    product: string;
  }>;
  signals: Array<{
    id: string;
    type: string;
    value: string;
    source: string;
    created_at: string;
  }>;
  riskDrivers: string[];
  timeline: Array<{ date: string; kind: string; label: string }>;
  trace: Array<{ step: string; detail: string }>;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [atRiskOnly, setAtRiskOnly] = useState(false);

  const loadList = async (atRisk = atRiskOnly) => {
    const res = await fetch(`/api/customers?atRisk=${atRisk ? "1" : "0"}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
  };

  const loadProfile = async (id: string) => {
    const res = await fetch(`/api/customers?id=${id}`);
    const data = await res.json();
    setProfile(data);
  };

  useEffect(() => {
    loadList();
    // Prefetch demo customer
    loadProfile(DEMO_CHURN_CUSTOMER_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          UC2 · Customer 360
        </h1>
        <p className="mt-2 text-muted-foreground">
          Orders, reviews, and <code className="rounded bg-muted px-1">Signal</code>{" "}
          nodes drive a visible churn risk. After ingesting the cancellation
          email, this score jumps — and the new signal is cited.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={atRiskOnly ? "default" : "outline"}
          size="sm"
          onClick={async () => {
            setAtRiskOnly(true);
            await loadList(true);
          }}
        >
          Show at-risk customers
        </Button>
        <Button
          variant={!atRiskOnly ? "default" : "outline"}
          size="sm"
          onClick={async () => {
            setAtRiskOnly(false);
            await loadList(false);
          }}
        >
          All customers
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => loadProfile(DEMO_CHURN_CUSTOMER_ID)}
        >
          Demo: {DEMO_CHURN_CUSTOMER_ID}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="max-h-[70vh] space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {customers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => loadProfile(c.id)}
              className={`flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-accent ${
                profile?.id === c.id ? "bg-accent" : ""
              }`}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {c.segment} · risk {(c.churn_risk * 100).toFixed(0)}%
              </span>
            </button>
          ))}
        </div>

        {profile && (
          <div className="space-y-4">
            <Card className="shadow-none">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>{profile.name}</CardTitle>
                    <CardDescription>
                      {profile.id} · {profile.segment} · {profile.region} · LTV $
                      {profile.lifetime_value}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Churn risk
                    </p>
                    <p
                      className={`text-3xl font-semibold tabular-nums ${
                        profile.churn_risk >= 0.7
                          ? "text-red-700"
                          : profile.churn_risk >= 0.5
                            ? "text-amber-700"
                            : "text-teal-800"
                      }`}
                    >
                      {(profile.churn_risk * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Risk drivers
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm">
                    {profile.riskDrivers.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.signals.map((s) => (
                    <Badge
                      key={s.id}
                      variant={
                        s.type === "intent_to_churn" ? "destructive" : "secondary"
                      }
                    >
                      {s.type}: {s.value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <ResolutionTrace steps={profile.trace} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Timeline</CardTitle>
                </CardHeader>
                <CardContent className="max-h-64 space-y-2 overflow-y-auto text-xs">
                  {profile.timeline.slice(0, 20).map((t, i) => (
                    <div key={i} className="border-l-2 border-border pl-2">
                      <span className="text-muted-foreground">{t.date}</span> ·{" "}
                      <Badge variant="outline" className="text-[10px]">
                        {t.kind}
                      </Badge>
                      <p>{t.label}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Reviews</CardTitle>
                </CardHeader>
                <CardContent className="max-h-64 space-y-2 overflow-y-auto text-xs">
                  {profile.reviews.map((r) => (
                    <div key={r.id}>
                      <p className="font-medium">
                        ★{r.rating} · {r.product} · {r.sentiment}
                      </p>
                      <p className="text-muted-foreground">{r.text}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground">
              Tip: ingest the cancellation email on{" "}
              <Link href="/ingest" className="underline">
                Ingest &amp; Watch
              </Link>
              , then reload this customer to see risk jump.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
