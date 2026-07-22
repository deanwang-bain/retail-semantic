"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type TraceStep = {
  step: string;
  detail: string;
  data?: unknown;
};

export function ResolutionTrace({
  steps,
  title = "How this was resolved",
}: {
  steps: TraceStep[];
  title?: string;
}) {
  if (!steps?.length) return null;
  return (
    <Accordion type="single" collapsible className="rounded-md border border-border px-3">
      <AccordionItem value="trace" className="border-0">
        <AccordionTrigger className="text-sm hover:no-underline">
          {title}
        </AccordionTrigger>
        <AccordionContent>
          <ol className="space-y-3 pb-2">
            {steps.map((s, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-foreground">{s.step}</p>
                <p className="text-muted-foreground">{s.detail}</p>
                {s.data != null && (
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-[11px]">
                    {JSON.stringify(s.data, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
