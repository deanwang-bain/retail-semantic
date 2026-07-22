"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS = [
  {
    n: 1,
    title: "Orient on the Overview",
    href: "/",
    say: "A relational schema stores rows. An ontology stores meaning — and the Concept→Attribute edges are the semantic layer.",
  },
  {
    n: 2,
    title: "Explore the ontology",
    href: "/ontology",
    say: "Filter to Concept + Attribute + Product. Click a Concept like “warm” and follow MAPS_TO into attributes, then into products.",
  },
  {
    n: 3,
    title: "UC1 — fuzzy search that works",
    href: "/search",
    say: "Run “warm jacket for a rainy commute”. Open the resolution trace: concepts → attributes → Cypher + vectors.",
  },
  {
    n: 4,
    title: "UC1 — the gap",
    href: "/search",
    say: "Now run “windbreaker for the rain”. Note weak/unmapped results — we deliberately never seeded “windbreaker”.",
  },
  {
    n: 5,
    title: "UC2 — baseline churn",
    href: "/customers",
    say: "Open CUST-001. Note the churn risk and existing size_issue signal. Remember this number.",
  },
  {
    n: 6,
    title: "UC3 — SEA merchandising",
    href: "/merchandising",
    say: "Ask “where is outerwear overstocked?” Thailand/Malaysia light up; Philippines understocked.",
  },
  {
    n: 7,
    title: "UC4 — recommendations with a why",
    href: "/recommendations",
    say: "Pick a Loyal/VIP customer and recommend. Every card cites the traversal path.",
  },
  {
    n: 8,
    title: "Climax A — teach windbreaker",
    href: "/ingest",
    say: "Load the Product review preset → Run pipeline → Apply. Watch Concept:windbreaker pulse in with SYNONYM_OF jacket. Re-run UC1 — same query now hits rain jackets.",
  },
  {
    n: 9,
    title: "Climax B — churn propagates",
    href: "/ingest",
    say: "Reset if needed, load Customer email → Apply. Jump to UC2 for CUST-001: churn risk jumped; intent_to_churn signal is cited.",
  },
  {
    n: 10,
    title: "Reset for the next audience",
    href: "/ingest",
    say: "Hit Reset ontology so the next room starts from a clean seed.",
  },
];

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Guided demo · ~5 minutes
        </h1>
        <p className="mt-2 text-muted-foreground">
          Scripted click-through for an executive audience. Speak the “say”
          lines; the links jump you to the right surface.
        </p>
      </div>
      <ol className="space-y-3">
        {STEPS.map((s) => (
          <Card key={s.n} className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {s.n}. {s.title}
              </CardTitle>
              <CardDescription>{s.say}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline">
                <Link href={s.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </ol>
    </div>
  );
}
