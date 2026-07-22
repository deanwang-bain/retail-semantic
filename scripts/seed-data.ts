/**
 * Deterministic mock retail data for the ontology demo.
 * Internally consistent so UC1–UC4 and the ingest payoffs all produce sensible results.
 *
 * INTENTIONAL GAP: the word "windbreaker" is NOT seeded as a Concept or SYNONYM.
 * The Ingest & Watch demo closes that gap live.
 */

export const REGIONS = [
  "Singapore",
  "Thailand",
  "Malaysia",
  "Philippines",
  "Vietnam",
] as const;

export type RegionName = (typeof REGIONS)[number];

export const CATEGORIES = [
  { name: "Outerwear", parent: null },
  { name: "Jackets", parent: "Outerwear" },
  { name: "Raincoats", parent: "Outerwear" },
  { name: "Fleeces", parent: "Outerwear" },
  { name: "Footwear", parent: null },
  { name: "Bags", parent: null },
  { name: "Accessories", parent: null },
  { name: "Basics", parent: null },
] as const;

/** Structured attributes that Concepts MAPS_TO. */
export const ATTRIBUTES = [
  { name: "warmth", value: "high" },
  { name: "warmth", value: "medium" },
  { name: "warmth", value: "low" },
  { name: "waterproof", value: "true" },
  { name: "waterproof", value: "false" },
  { name: "breathable", value: "true" },
  { name: "breathable", value: "false" },
  { name: "material", value: "fleece" },
  { name: "material", value: "nylon" },
  { name: "material", value: "cotton" },
  { name: "material", value: "goretex" },
  { name: "material", value: "wool" },
  { name: "weight", value: "light" },
  { name: "weight", value: "medium" },
  { name: "weight", value: "heavy" },
  { name: "occasion", value: "commute" },
  { name: "occasion", value: "outdoor" },
  { name: "occasion", value: "casual" },
  { name: "occasion", value: "formal" },
] as const;

/**
 * Concepts = the semantic bridge. Fuzzy language enters here.
 * MAPS_TO edges connect them to structured Attributes.
 * Deliberately omit "windbreaker".
 */
export const CONCEPTS: Array<{
  name: string;
  description: string;
  mapsTo: Array<{ name: string; value: string }>;
  synonymsOf?: string[]; // this concept SYNONYM_OF target
}> = [
  {
    name: "warm",
    description: "Keeps the wearer warm in cool or cold conditions",
    mapsTo: [
      { name: "warmth", value: "high" },
      { name: "warmth", value: "medium" },
    ],
  },
  {
    name: "waterproof",
    description: "Resists rain and wet weather",
    mapsTo: [{ name: "waterproof", value: "true" }],
  },
  {
    name: "rainy",
    description: "Suitable for rainy weather and downpours",
    mapsTo: [{ name: "waterproof", value: "true" }],
    synonymsOf: ["waterproof"],
  },
  {
    name: "commute",
    description: "Practical for daily city commuting",
    mapsTo: [{ name: "occasion", value: "commute" }],
  },
  {
    name: "breathable",
    description: "Allows airflow; good for hot or active use",
    mapsTo: [{ name: "breathable", value: "true" }],
  },
  {
    name: "light",
    description: "Lightweight and easy to pack or wear all day",
    mapsTo: [{ name: "weight", value: "light" }],
  },
  {
    name: "gift",
    description: "Suitable as a present",
    mapsTo: [{ name: "occasion", value: "casual" }],
  },
  {
    name: "jacket",
    description: "Outerwear jacket category concept — light shells, softshells, and city jackets",
    mapsTo: [
      { name: "occasion", value: "commute" },
      { name: "weight", value: "light" },
    ],
  },
  {
    name: "fleece",
    description: "Soft fleece insulation",
    mapsTo: [
      { name: "material", value: "fleece" },
      { name: "warmth", value: "high" },
    ],
    synonymsOf: ["warm"],
  },
  {
    name: "outdoor",
    description: "For hiking and outdoor activities",
    mapsTo: [{ name: "occasion", value: "outdoor" }],
  },
  {
    name: "casual",
    description: "Everyday casual wear",
    mapsTo: [{ name: "occasion", value: "casual" }],
  },
  {
    name: "formal",
    description: "Office and formal occasions",
    mapsTo: [{ name: "occasion", value: "formal" }],
  },
  {
    name: "durable",
    description: "Built to last under rough use",
    mapsTo: [{ name: "material", value: "nylon" }],
  },
  {
    name: "soft",
    description: "Soft hand-feel and comfort",
    mapsTo: [{ name: "material", value: "cotton" }],
  },
  {
    name: "hot",
    description: "For hot weather climates across SEA",
    mapsTo: [
      { name: "breathable", value: "true" },
      { name: "weight", value: "light" },
      { name: "warmth", value: "low" },
    ],
    synonymsOf: ["breathable"],
  },
  {
    name: "insulated",
    description: "Thermal insulation for cold snaps (e.g. Baguio)",
    mapsTo: [{ name: "warmth", value: "high" }],
    synonymsOf: ["warm"],
  },
  {
    name: "packable",
    description: "Compresses small for travel",
    mapsTo: [{ name: "weight", value: "light" }],
    synonymsOf: ["light"],
  },
  {
    name: "urban",
    description: "City-ready styling and function",
    mapsTo: [{ name: "occasion", value: "commute" }],
    synonymsOf: ["commute"],
  },
  {
    name: "monsoon",
    description: "Handles heavy tropical rain seasons",
    mapsTo: [{ name: "waterproof", value: "true" }],
    synonymsOf: ["rainy"],
  },
  {
    name: "trail",
    description: "Trail and light hiking ready",
    mapsTo: [{ name: "occasion", value: "outdoor" }],
    synonymsOf: ["outdoor"],
  },
  {
    name: "cozy",
    description: "Soft warmth for lounging or cool evenings",
    mapsTo: [
      { name: "warmth", value: "medium" },
      { name: "material", value: "fleece" },
    ],
    synonymsOf: ["warm"],
  },
  {
    name: "office",
    description: "Appropriate for workplace dress codes",
    mapsTo: [{ name: "occasion", value: "formal" }],
    synonymsOf: ["formal"],
  },
  {
    name: "weekend",
    description: "Relaxed weekend wear",
    mapsTo: [{ name: "occasion", value: "casual" }],
    synonymsOf: ["casual"],
  },
  {
    name: "rugged",
    description: "Tough construction for hard use",
    mapsTo: [{ name: "material", value: "nylon" }],
    synonymsOf: ["durable"],
  },
  {
    name: "goretex",
    description: "Premium waterproof breathable membrane",
    mapsTo: [
      { name: "material", value: "goretex" },
      { name: "waterproof", value: "true" },
      { name: "breathable", value: "true" },
    ],
  },
];

type AttrRef = { name: string; value: string };

export type SeedProduct = {
  sku: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  season: string;
  color: string;
  size: string;
  description: string;
  category: string;
  attributes: AttrRef[];
};

const brands = ["Aether", "MonsoonCo", "Trailform", "UrbanKnit", "SeaBreeze"];

function p(
  i: number,
  name: string,
  category: string,
  description: string,
  attributes: AttrRef[],
  extras?: Partial<SeedProduct>
): SeedProduct {
  return {
    sku: `SKU-${String(i).padStart(4, "0")}`,
    name,
    brand: brands[i % brands.length],
    price: extras?.price ?? 49 + (i % 12) * 10,
    currency: "USD",
    season: extras?.season ?? (i % 2 === 0 ? "All-season" : "Monsoon"),
    color: extras?.color ?? ["Black", "Navy", "Olive", "Grey", "Sand"][i % 5],
    size: extras?.size ?? ["S", "M", "L", "XL"][i % 4],
    description,
    category,
    attributes,
  };
}

export const PRODUCTS: SeedProduct[] = [
  p(1, "CityShell Rain Jacket", "Jackets", "Waterproof jacket built for a rainy commute through the city.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "commute" }]),
  p(2, "Summit Fleece Zip", "Fleeces", "High-warmth fleece for cool highland evenings and Baguio weekends.", [{ name: "warmth", value: "high" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "fleece" }, { name: "weight", value: "medium" }, { name: "occasion", value: "casual" }]),
  p(3, "Downpour Trench", "Raincoats", "Full-length raincoat that kept me dry on monsoon walks.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "medium" }, { name: "occasion", value: "commute" }]),
  p(4, "AeroLite Shell", "Jackets", "Ultra-light packable shell for sudden tropical downpours.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "commute" }], { price: 89 }),
  p(5, "Harbor Softshell", "Jackets", "Breathable softshell for warm humid days with light rain.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "commute" }]),
  p(6, "Alpine Thermo Parka", "Jackets", "Insulated warm parka for cold snaps — not for hot weather.", [{ name: "warmth", value: "high" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "heavy" }, { name: "occasion", value: "outdoor" }], { price: 189 }),
  p(7, "Merino Layer Fleece", "Fleeces", "Soft merino-blend fleece, cozy and warm for evenings.", [{ name: "warmth", value: "high" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "fleece" }, { name: "weight", value: "medium" }, { name: "occasion", value: "casual" }]),
  p(8, "Office Wool Blazer", "Jackets", "Formal wool blazer for Singapore office dress codes.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "wool" }, { name: "weight", value: "medium" }, { name: "occasion", value: "formal" }], { price: 159 }),
  p(9, "TrailGuard Rain Shell", "Raincoats", "Gore-Tex trail raincoat — waterproof and breathable for outdoor hikes.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "goretex" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }], { price: 229 }),
  p(10, "Weekend Quilted Jacket", "Jackets", "Casual quilted jacket with medium warmth for weekend errands.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "medium" }, { name: "occasion", value: "casual" }]),
  // Products 11-20 outerwear continued
  p(11, "Mono Rain Poncho", "Raincoats", "Packable waterproof poncho for festival rain and sudden showers.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }]),
  p(12, "CloudKnit Fleece Hoodie", "Fleeces", "Breathable light fleece hoodie for air-conditioned offices.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "fleece" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }]),
  p(13, "StormRider Jacket", "Jackets", "Rugged waterproof commute jacket with taped seams.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "medium" }, { name: "occasion", value: "commute" }], { price: 119 }),
  p(14, "BreezeShell Active", "Jackets", "Something breathable for hot weather runs and humid streets.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }]),
  p(15, "NightShift Softshell", "Jackets", "Urban softshell for evening city commuting.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "commute" }]),
  p(16, "Highland Pile Fleece", "Fleeces", "Heavy pile fleece — warm enough for highland trips.", [{ name: "warmth", value: "high" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "false" }, { name: "material", value: "fleece" }, { name: "weight", value: "heavy" }, { name: "occasion", value: "outdoor" }]),
  p(17, "Petal Rain Mac", "Raincoats", "Lightweight raincoat styled for everyday rainy errands.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }]),
  p(18, "Transit Insulated Jacket", "Jackets", "Warm insulated jacket for early morning MRT rides.", [{ name: "warmth", value: "high" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "medium" }, { name: "occasion", value: "commute" }]),
  p(19, "Drift Cotton Overshirt", "Jackets", "Soft cotton overshirt for casual weekends — not waterproof.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }]),
  p(20, "Ridge Gore-Tex Jacket", "Jackets", "Premium waterproof breathable outdoor jacket.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "goretex" }, { name: "weight", value: "medium" }, { name: "occasion", value: "outdoor" }], { price: 279 }),
  // Footwear 21-32
  p(21, "Monsoon Trail Runner", "Footwear", "Waterproof trail runners for wet path commuting.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }], { price: 129 }),
  p(22, "CityWalk Leather", "Footwear", "Formal leather shoes for office days.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "wool" }, { name: "weight", value: "medium" }, { name: "occasion", value: "formal" }], { price: 149 }),
  p(23, "Harbor Slip-On", "Footwear", "Breathable casual slip-ons for hot weather.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }]),
  p(24, "StormBoot Mid", "Footwear", "Waterproof mid boots for rainy season walks.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "heavy" }, { name: "occasion", value: "outdoor" }], { price: 169 }),
  p(25, "AeroKnit Trainer", "Footwear", "Lightweight breathable trainers for humid gyms.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }]),
  p(26, "Office Loafer Pro", "Footwear", "Comfortable formal loafers for long office days.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "wool" }, { name: "weight", value: "medium" }, { name: "occasion", value: "formal" }]),
  p(27, "Delta Sandal", "Footwear", "Light sandals for hot weather weekends.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }], { price: 39 }),
  p(28, "FogLine Hiking Boot", "Footwear", "Durable outdoor hiking boots with medium warmth.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "goretex" }, { name: "weight", value: "heavy" }, { name: "occasion", value: "outdoor" }], { price: 199 }),
  p(29, "Metro Canvas Low", "Footwear", "Casual canvas sneakers for everyday commute.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "commute" }]),
  p(30, "RainGuard Galosh", "Footwear", "Waterproof overshoes for sudden downpours.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "commute" }], { price: 45 }),
  p(31, "Velvet Slide", "Footwear", "Soft indoor-outdoor slides for casual evenings.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }]),
  p(32, "Pulse Cross-Trainer", "Footwear", "Breathable trainers for gym and light outdoor use.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }]),
  // Bags 33-42
  p(33, "Commute Rolltop 20L", "Bags", "Waterproof rolltop backpack for rainy city commuting.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "commute" }], { price: 99 }),
  p(34, "Slim Laptop Tote", "Bags", "Formal tote for office laptops and notebooks.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "formal" }]),
  p(35, "Weekend Duffel 40L", "Bags", "Casual durable duffel for weekend trips.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "medium" }, { name: "occasion", value: "casual" }]),
  p(36, "Trail Daypack", "Bags", "Light outdoor daypack for hot weather hikes.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }]),
  p(37, "Market Crossbody", "Bags", "Soft casual crossbody for errands.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "false" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }], { price: 49 }),
  p(38, "Storm Pouch Set", "Bags", "Waterproof pouches for monsoon travel documents.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }]),
  p(39, "Studio Camera Sling", "Bags", "Durable sling for weekend photography walks.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "medium" }, { name: "occasion", value: "casual" }]),
  p(40, "Fold Tote Compact", "Bags", "Packable light tote that folds into a pocket.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }], { price: 29 }),
  p(41, "Executive Brief", "Bags", "Formal briefcase for client meetings.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "medium" }, { name: "occasion", value: "formal" }], { price: 179 }),
  p(42, "HydraPack Vest", "Bags", "Breathable outdoor hydration vest for trail runs.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }]),
  // Accessories 43-52
  p(43, "Merino Beanie", "Accessories", "Warm soft beanie for cool highland nights.", [{ name: "warmth", value: "high" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "wool" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }], { price: 35 }),
  p(44, "UV Cap Breeze", "Accessories", "Breathable cap for hot weather street walks.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }], { price: 25 }),
  p(45, "Rain Mitt Packable", "Accessories", "Packable waterproof mittens for sudden rain.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "commute" }]),
  p(46, "Silk Office Scarf", "Accessories", "Formal light scarf for air-conditioned offices.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "formal" }]),
  p(47, "Trail Gaiters", "Accessories", "Durable outdoor gaiters for muddy trails.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }]),
  p(48, "Commute Umbrella Nano", "Accessories", "Compact umbrella for rainy city commuting.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "commute" }], { price: 32 }),
  p(49, "Fleece Neck Gaiter", "Accessories", "Cozy fleece neck gaiter for cool evenings.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "fleece" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }]),
  p(50, "Leather Belt Classic", "Accessories", "Formal belt for office trousers.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "false" }, { name: "material", value: "wool" }, { name: "weight", value: "light" }, { name: "occasion", value: "formal" }]),
  p(51, "Sport Wristband Pair", "Accessories", "Breathable wristbands for hot weather workouts.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }], { price: 15 }),
  p(52, "Pack Rain Cover", "Accessories", "Waterproof pack cover for monsoon hikes.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "true" }, { name: "breathable", value: "false" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }]),
  // Basics 53-60
  p(53, "AirKnit Tee", "Basics", "Breathable tee for hot weather everyday wear.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }], { price: 28 }),
  p(54, "Merino Base Longsleeve", "Basics", "Warm merino base layer for cool trips.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "wool" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }], { price: 68 }),
  p(55, "Oxford Office Shirt", "Basics", "Formal breathable oxford for humid offices.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "formal" }]),
  p(56, "Everyday Chino", "Basics", "Casual chinos for weekend and smart-casual commute.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "medium" }, { name: "occasion", value: "casual" }]),
  p(57, "Trail Short 7in", "Basics", "Light breathable shorts for hot outdoor days.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }]),
  p(58, "Soft Lounge Pant", "Basics", "Soft cotton lounge pants for cozy evenings.", [{ name: "warmth", value: "medium" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "medium" }, { name: "occasion", value: "casual" }]),
  p(59, "Cooling Tank", "Basics", "Ultra-breathable tank for hot weather training.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "nylon" }, { name: "weight", value: "light" }, { name: "occasion", value: "outdoor" }], { price: 22 }),
  p(60, "Travel Zip Polo", "Basics", "Packable polo suitable as a light gift.", [{ name: "warmth", value: "low" }, { name: "waterproof", value: "false" }, { name: "breathable", value: "true" }, { name: "material", value: "cotton" }, { name: "weight", value: "light" }, { name: "occasion", value: "casual" }], { price: 42 }),
];

export type SeedCustomer = {
  id: string;
  name: string;
  segment: "New" | "Loyal" | "VIP" | "At-risk";
  lifetime_value: number;
  join_date: string;
  churn_risk: number;
  region: RegionName;
};

const FIRST = ["Aisha", "Ben", "Chi", "Dewi", "Eun", "Farid", "Gita", "Hiro", "Ivy", "Johan", "Kai", "Lina", "Marc", "Nina", "Omar", "Priya", "Quinn", "Rafi", "Siti", "Tom"];
const LAST = ["Tan", "Nguyen", "Santos", "Wong", "Lim", "Reyes", "Chen", "Putri", "Kim", "Cruz"];

export const CUSTOMERS: SeedCustomer[] = Array.from({ length: 40 }, (_, i) => {
  const region = REGIONS[i % REGIONS.length];
  const segment =
    i < 4 ? "At-risk" : i < 12 ? "VIP" : i < 28 ? "Loyal" : "New";
  const churn =
    segment === "At-risk"
      ? 0.55 + (i % 5) * 0.05
      : segment === "New"
        ? 0.2 + (i % 4) * 0.03
        : 0.08 + (i % 5) * 0.02;
  const year = 2022 + (i % 3);
  const month = String((i % 12) + 1).padStart(2, "0");
  return {
    id: `CUST-${String(i + 1).padStart(3, "0")}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
    segment,
    lifetime_value:
      segment === "VIP"
        ? 2500 + i * 40
        : segment === "Loyal"
          ? 800 + i * 25
          : segment === "At-risk"
            ? 600 + i * 20
            : 150 + i * 10,
    join_date: `${year}-${month}-15`,
    churn_risk: Math.min(0.85, Math.round(churn * 100) / 100),
    region,
  };
});

import { DEMO_CHURN_CUSTOMER_ID } from "../lib/demo-constants";

/** Flagship at-risk customer used in the ingest cancellation-email payoff. */
export { DEMO_CHURN_CUSTOMER_ID };

export const STORES: Array<{ id: string; name: string; region: RegionName }> = [
  { id: "ST-SG-01", name: "Orchard Flagship", region: "Singapore" },
  { id: "ST-SG-02", name: "Jewel Changi", region: "Singapore" },
  { id: "ST-TH-01", name: "Siam Centre", region: "Thailand" },
  { id: "ST-TH-02", name: "Chiang Mai Gate", region: "Thailand" },
  { id: "ST-MY-01", name: "KLCC Pavilion", region: "Malaysia" },
  { id: "ST-MY-02", name: "Penang Gurney", region: "Malaysia" },
  { id: "ST-PH-01", name: "Makati Greenbelt", region: "Philippines" },
  { id: "ST-PH-02", name: "Cebu IT Park", region: "Philippines" },
  { id: "ST-VN-01", name: "D1 Landmark", region: "Vietnam" },
  { id: "ST-VN-02", name: "Hanoi Hoan Kiem", region: "Vietnam" },
];

export type SeedOrder = {
  id: string;
  customerId: string;
  date: string;
  total: number;
  channel: "online" | "store";
  productSkus: string[];
};

export type SeedReview = {
  id: string;
  customerId: string;
  productSku: string;
  rating: number;
  text: string;
  sentiment: "positive" | "neutral" | "negative";
  created_at: string;
  concepts: string[];
};

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

export function buildOrders(): SeedOrder[] {
  const orders: SeedOrder[] = [];
  for (let i = 0; i < 120; i++) {
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const nItems = 1 + Math.floor(rng() * 3);
    const skus: string[] = [];
    for (let j = 0; j < nItems; j++) {
      const prod = PRODUCTS[Math.floor(rng() * PRODUCTS.length)];
      if (!skus.includes(prod.sku)) skus.push(prod.sku);
    }
    // Bias: at-risk CUST-001 bought the AeroLite Shell (light rain jacket — "windbreaker-like")
    if (i < 3) {
      skus[0] = "SKU-0004";
    }
    const total = skus.reduce((sum, sku) => {
      const prod = PRODUCTS.find((p) => p.sku === sku)!;
      return sum + prod.price;
    }, 0);
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 28);
    orders.push({
      id: `ORD-${String(i + 1).padStart(4, "0")}`,
      customerId: i < 3 ? DEMO_CHURN_CUSTOMER_ID : customer.id,
      date: `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      total,
      channel: rng() > 0.45 ? "online" : "store",
      productSkus: skus,
    });
  }
  return orders;
}

export function buildReviews(): SeedReview[] {
  const templates: Array<{
    rating: number;
    sentiment: SeedReview["sentiment"];
    text: string;
    concepts: string[];
    sku?: string;
    customerId?: string;
  }> = [
    { rating: 5, sentiment: "positive", text: "Kept me dry on my rainy commute — perfect waterproof jacket.", concepts: ["waterproof", "rainy", "commute", "jacket"], sku: "SKU-0001" },
    { rating: 2, sentiment: "negative", text: "Ran a size small and the sleeves felt tight.", concepts: ["sizing"], sku: "SKU-0004", customerId: DEMO_CHURN_CUSTOMER_ID },
    { rating: 3, sentiment: "negative", text: "Not warm enough for Baguio — expected more insulation.", concepts: ["warm", "insulated"], sku: "SKU-0010" },
    { rating: 5, sentiment: "positive", text: "Super light and breathable for hot weather in Bangkok.", concepts: ["light", "breathable", "hot"], sku: "SKU-0014" },
    { rating: 4, sentiment: "positive", text: "Cozy fleece for cool evenings, soft hand-feel.", concepts: ["cozy", "fleece", "soft", "warm"], sku: "SKU-0002" },
    { rating: 2, sentiment: "negative", text: "Sizing was inconsistent — exchange hassle.", concepts: ["sizing"], sku: "SKU-0022" },
    { rating: 5, sentiment: "positive", text: "Gore-Tex shell handled monsoon trails without leaking.", concepts: ["goretex", "monsoon", "waterproof", "trail"], sku: "SKU-0009" },
    { rating: 4, sentiment: "positive", text: "Great urban commute bag, stayed dry in the rain.", concepts: ["commute", "urban", "rainy", "waterproof"], sku: "SKU-0033" },
    { rating: 1, sentiment: "negative", text: "Disappointed — claimed waterproof but soaked through.", concepts: ["waterproof", "rainy"], sku: "SKU-0003" },
    { rating: 5, sentiment: "positive", text: "Breathable tee that survives Singapore humidity.", concepts: ["breathable", "hot"], sku: "SKU-0053" },
    { rating: 4, sentiment: "positive", text: "Warm beanie, perfect gift for highland trips.", concepts: ["warm", "gift"], sku: "SKU-0043" },
    { rating: 3, sentiment: "neutral", text: "Decent casual overshirt, nothing special.", concepts: ["casual"], sku: "SKU-0019" },
    { rating: 2, sentiment: "negative", text: "Too heavy for hot weather commuting.", concepts: ["hot", "commute"], sku: "SKU-0006", customerId: DEMO_CHURN_CUSTOMER_ID },
    { rating: 5, sentiment: "positive", text: "Packable shell stuffed into my bag — light and ready.", concepts: ["packable", "light"], sku: "SKU-0004" },
    { rating: 4, sentiment: "positive", text: "Office blazer looks formal without overheating.", concepts: ["formal", "office", "breathable"], sku: "SKU-0008" },
  ];

  const reviews: SeedReview[] = [];
  for (let i = 0; i < 80; i++) {
    const t = templates[i % templates.length];
    const customerId =
      t.customerId ?? CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)].id;
    const productSku =
      t.sku ?? PRODUCTS[Math.floor(rng() * PRODUCTS.length)].sku;
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 28);
    reviews.push({
      id: `REV-${String(i + 1).padStart(4, "0")}`,
      customerId,
      productSku,
      rating: t.rating,
      text: t.text,
      sentiment: t.sentiment,
      created_at: `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      concepts: t.concepts,
    });
  }
  return reviews;
}

/**
 * Inventory: qty per product per store.
 * Deliberately overstock Outerwear in Thailand & Malaysia, understock in Philippines.
 */
export function buildInventory(): Array<{
  sku: string;
  storeId: string;
  qty: number;
}> {
  const rows: Array<{ sku: string; storeId: string; qty: number }> = [];
  for (const product of PRODUCTS) {
    for (const store of STORES) {
      let qty = 20 + Math.floor(rng() * 30);
      const isOuterwear = ["Jackets", "Raincoats", "Fleeces", "Outerwear"].includes(
        product.category
      );
      if (isOuterwear && (store.region === "Thailand" || store.region === "Malaysia")) {
        qty = 80 + Math.floor(rng() * 40); // overstocked
      }
      if (isOuterwear && store.region === "Philippines") {
        qty = 2 + Math.floor(rng() * 5); // understocked
      }
      if (store.region === "Vietnam" && product.category === "Footwear") {
        qty = 70 + Math.floor(rng() * 20); // footwear overstock VN
      }
      rows.push({ sku: product.sku, storeId: store.id, qty });
    }
  }
  return rows;
}
