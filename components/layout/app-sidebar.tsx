"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Network,
  Search,
  Users,
  BarChart3,
  Sparkles,
  Radio,
  LayoutDashboard,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const USE_CASES = [
  { href: "/search", label: "UC1 Search", icon: Search },
  { href: "/customers", label: "UC2 Customer 360", icon: Users },
  { href: "/merchandising", label: "UC3 Merchandising", icon: BarChart3 },
  { href: "/recommendations", label: "UC4 Recommendations", icon: Sparkles },
] as const;

const TOP_NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/ontology", label: "Ontology Explorer", icon: Network },
] as const;

const BOTTOM_NAV = [
  { href: "/ingest", label: "Automated Intelligence", icon: Radio },
  { href: "/demo", label: "Guided Demo", icon: BookOpen },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const ucActive = USE_CASES.some(({ href }) => pathname.startsWith(href));

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Retail Demo
        </p>
        <h1 className="mt-1 text-lg font-semibold leading-tight tracking-tight">
          Ontology &amp; Semantic Layer
        </h1>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {TOP_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Use Cases group */}
        <div className="mt-1">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
              ucActive
                ? "font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <ChevronDown className="h-3 w-3 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider">Use Cases</span>
          </div>
          <div className="ml-4 space-y-0.5 border-l border-border pl-2">
            {USE_CASES.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
        Concepts map language → attributes. That middle layer is the semantic layer.
      </div>
    </aside>
  );
}
