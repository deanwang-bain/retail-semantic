import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { StatusBadges } from "@/components/layout/status-badges";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Retail Ontology & Semantic Layer Demo",
  description:
    "Interactive demo of a retail knowledge graph, fuzzy NL querying, and a living semantic layer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${serif.variable} font-sans antialiased`}
      >
        <div className="flex h-screen overflow-hidden bg-background">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
              <p className="text-sm text-muted-foreground">
                Ontology · Semantic Layer · Living Graph
              </p>
              <StatusBadges />
            </header>
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
