/**
 * LLM / NL-understanding provider abstraction.
 *
 * If ANTHROPIC_API_KEY is set → Claude (live).
 * Otherwise → deterministic rule-based parser covering the demo script queries.
 *
 * Same interface either way so the UI only cares about the mode badge.
 */
export type LlmMode = "live" | "simulated";

export function getLlmMode(): LlmMode {
  return process.env.ANTHROPIC_API_KEY ? "live" : "simulated";
}

export type QueryIntent =
  | { kind: "product_search"; raw: string; concepts: string[]; categoryHint?: string }
  | { kind: "at_risk_customers"; raw: string }
  | { kind: "customer_lookup"; raw: string; customerHint?: string }
  | { kind: "merchandising"; raw: string; focus: "underperforming" | "overstocked" | "general"; categoryHint?: string }
  | { kind: "recommend"; raw: string; customerHint?: string }
  | { kind: "unknown"; raw: string };

export type ExtractedEntity = {
  type: "customer" | "product" | "concept" | "aspect" | "region";
  value: string;
  confidence: number;
};

export type ExtractionResult = {
  entities: ExtractedEntity[];
  concepts: string[];
  aspects: string[]; // e.g. sizing, waterproof, warmth
  sentiment: "positive" | "neutral" | "negative";
  signals: Array<{ type: string; value: string }>;
  summary: string;
};

export async function parseQuery(raw: string): Promise<QueryIntent> {
  if (getLlmMode() === "live") {
    try {
      return await parseWithClaude(raw);
    } catch (err) {
      console.warn("Claude parse failed, falling back to rules:", err);
    }
  }
  return parseWithRules(raw);
}

export async function extractFromText(
  text: string,
  source: "email" | "review" | "support"
): Promise<ExtractionResult> {
  if (getLlmMode() === "live") {
    try {
      return await extractWithClaude(text, source);
    } catch (err) {
      console.warn("Claude extract failed, falling back to rules:", err);
    }
  }
  return extractWithRules(text, source);
}

// ─── Rule-based fallback (covers the scripted demo queries) ─────────────────

const CONCEPT_LEXICON: Record<string, string[]> = {
  warm: ["warm", "cozy", "thermal", "insulated", "fleece", "heat"],
  waterproof: ["waterproof", "water-resistant", "rain", "rainy", "downpour", "leaks", "dry"],
  commute: ["commute", "commuting", "city", "urban", "everyday"],
  breathable: ["breathable", "ventilated", "airy", "hot weather", "hot"],
  light: ["light", "lightweight", "packable", "ultralight"],
  gift: ["gift", "present"],
  sizing: ["sizing", "size", "sized", "small", "large", "fit", "fits"],
  jacket: ["jacket", "coat", "outerwear"],
  // Deliberately NOT mapping "windbreaker" here — that gap is closed live in ingest.
  rainy: ["rainy", "rain", "drizzle", "monsoon", "downpour"],
  outdoor: ["outdoor", "hiking", "trail"],
  formal: ["formal", "office", "work"],
  casual: ["casual", "weekend"],
  durable: ["durable", "rugged", "tough"],
  soft: ["soft", "comfortable", "comfy"],
};

export function detectConceptsInText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [concept, synonyms] of Object.entries(CONCEPT_LEXICON)) {
    if (synonyms.some((s) => lower.includes(s))) found.add(concept);
  }
  // Surface novel term "windbreaker" as a candidate concept (unmapped until ingest).
  if (/\bwindbreaker\b/i.test(text)) found.add("windbreaker");
  return Array.from(found);
}

function parseWithRules(raw: string): QueryIntent {
  const lower = raw.toLowerCase();

  if (
    /at[- ]?risk|churn|cancelling|cancel/.test(lower) &&
    /customer/.test(lower)
  ) {
    return { kind: "at_risk_customers", raw };
  }

  if (/recommend|suggestion|for them|for me/.test(lower)) {
    return { kind: "recommend", raw };
  }

  if (
    /underperform|overstock|inventory|southeast asia|sea\b|merchandis|slow.?mov/.test(
      lower
    )
  ) {
    const focus = /overstock/.test(lower)
      ? "overstocked"
      : /underperform|slow/.test(lower)
        ? "underperforming"
        : "general";
    const categoryHint = /outerwear|jacket/.test(lower)
      ? "Outerwear"
      : /footwear|shoe/.test(lower)
        ? "Footwear"
        : undefined;
    return { kind: "merchandising", raw, focus, categoryHint };
  }

  // Default: treat as product search (UC1)
  const concepts = detectConceptsInText(raw);
  const categoryHint = /jacket|coat|fleece|raincoat|outerwear|windbreaker/.test(
    lower
  )
    ? "Outerwear"
    : /shoe|boot|sneaker|footwear/.test(lower)
      ? "Footwear"
      : /bag|backpack/.test(lower)
        ? "Bags"
        : undefined;

  return { kind: "product_search", raw, concepts, categoryHint };
}

function extractWithRules(
  text: string,
  source: "email" | "review" | "support"
): ExtractionResult {
  const lower = text.toLowerCase();
  const concepts = detectConceptsInText(text);
  const aspects: string[] = [];
  if (/siz(e|ing)|fit|small|large/.test(lower)) aspects.push("sizing");
  if (/leak|rain|waterproof|dry|downpour/.test(lower)) aspects.push("waterproof");
  if (/warm|cold|heat/.test(lower)) aspects.push("warmth");
  if (/light|heavy|weight/.test(lower)) aspects.push("weight");

  let sentiment: ExtractionResult["sentiment"] = "neutral";
  if (
    /cancel|leaks|way off|complaint|terrible|awful|disappointed|not warm|sizing was/.test(
      lower
    )
  ) {
    sentiment = "negative";
  } else if (/perfect|love|great|super|excellent|amazing/.test(lower)) {
    sentiment = "positive";
  }

  const signals: ExtractionResult["signals"] = [];
  if (/cancel|cancelling|thinking of cancelling/.test(lower)) {
    signals.push({ type: "intent_to_churn", value: "expressed cancellation intent" });
  }
  if (/leak/.test(lower)) {
    signals.push({ type: "complaint", value: "product leaks in rain" });
  }
  if (/siz(e|ing).*off|ran a size|way off|too small|too large/.test(lower)) {
    signals.push({ type: "size_issue", value: "sizing complaint" });
  }

  const entities: ExtractedEntity[] = [];
  if (/\bwindbreaker\b/i.test(text)) {
    entities.push({ type: "product", value: "windbreaker", confidence: 0.9 });
    entities.push({ type: "concept", value: "windbreaker", confidence: 0.95 });
  }
  if (/manila/i.test(text)) {
    entities.push({ type: "region", value: "Philippines", confidence: 0.8 });
  }

  for (const c of concepts) {
    if (c !== "windbreaker") {
      entities.push({ type: "concept", value: c, confidence: 0.85 });
    }
  }
  for (const a of aspects) {
    entities.push({ type: "aspect", value: a, confidence: 0.8 });
  }

  return {
    entities,
    concepts,
    aspects,
    sentiment,
    signals,
    summary: `${source} · sentiment=${sentiment} · concepts=[${concepts.join(", ")}]`,
  };
}

// ─── Claude (live) ──────────────────────────────────────────────────────────

async function anthropicJson<T>(system: string, user: string): Promise<T> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
  };
  const text = data.content.find((c) => c.type === "text")?.text ?? "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");
  return JSON.parse(jsonMatch[0]) as T;
}

async function parseWithClaude(raw: string): Promise<QueryIntent> {
  return anthropicJson<QueryIntent>(
    `You parse retail demo queries into a JSON intent object.
Valid kinds: product_search, at_risk_customers, customer_lookup, merchandising, recommend, unknown.
For product_search include concepts[] (warm, waterproof, commute, breathable, light, jacket, rainy, etc.) and optional categoryHint.
For merchandising include focus: underperforming|overstocked|general.
Return ONLY JSON.`,
    raw
  );
}

async function extractWithClaude(
  text: string,
  source: "email" | "review" | "support"
): Promise<ExtractionResult> {
  return anthropicJson<ExtractionResult>(
    `Extract entities/concepts/aspects/sentiment/signals from retail ${source} text.
Return JSON: { entities:[{type,value,confidence}], concepts:[], aspects:[], sentiment, signals:[{type,value}], summary }.
Signal types include: intent_to_churn, complaint, size_issue.
Always flag "windbreaker" as a concept if present.`,
    text
  );
}
