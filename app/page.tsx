import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HealthPanel } from "@/components/health-panel";

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <section className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-widest text-teal-700">
          Why this demo exists
        </p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
          An ontology turns messy language into precise retail facts.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          A flat relational schema stores rows. An{" "}
          <strong className="text-foreground">ontology</strong> stores{" "}
          <em>meaning</em> — products, customers, concepts like &ldquo;warm&rdquo;
          or &ldquo;rainy commute,&rdquo; and the edges that connect them. The{" "}
          <strong className="text-foreground">semantic layer</strong> is that
          middle mapping:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            Concept → MAPS_TO → Attribute
          </code>{" "}
          and learned synonyms. Fuzzy language enters through concepts;
          structured precision comes out through attributes. New unstructured
          data grows this middle layer live.
        </p>
        <div className="flex gap-3 pt-2">
          <Button asChild>
            <Link href="/demo">Start the guided demo</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ontology">Explore the ontology</Link>
          </Button>
        </div>
      </section>

      <HealthPanel />

      <section className="grid gap-4 sm:grid-cols-2">
        {[
          {
            title: "UC1 · Semantic search",
            href: "/search",
            desc: "“warm jacket for a rainy commute” → concepts → attributes → products.",
          },
          {
            title: "UC2 · Customer 360",
            href: "/customers",
            desc: "Orders, reviews, and Signal nodes drive a visible churn risk score.",
          },
          {
            title: "UC3 · Merchandising",
            href: "/merchandising",
            desc: "Inventory × velocity across Singapore, Thailand, Malaysia, PH, VN.",
          },
          {
            title: "UC4 · Recommendations",
            href: "/recommendations",
            desc: "Multi-hop graph traversal with a one-line “why” for each pick.",
          },
        ].map((item) => (
          <Card key={item.href} className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <Link href={item.href} className="hover:underline">
                  {item.title}
                </Link>
              </CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>
    </div>
  );
}
