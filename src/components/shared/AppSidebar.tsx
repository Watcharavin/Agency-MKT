"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const NAV = [
  {
    group: "WORKSPACE",
    items: [
      { href: "/dashboard", label: "Home",         icon: "●" },
      { href: "/brand",     label: "Brand DNA",    icon: "◇" },
      { href: "/content",   label: "Content Plan", icon: "▦" },
    ],
  },
  {
    group: "CATALOG",
    items: [
      { href: "/products", label: "Product", icon: "□" },
      { href: "/store",    label: "Store",   icon: "□" },
    ],
  },
  {
    group: "DISTRIBUTION",
    items: [
      { href: "/super-aff", label: "Super AFF",  icon: "●" },
      { href: "/campaigns", label: "Campaigns",  icon: "◑" },
    ],
    sub: "vouchers\nline · fb · ig · tt",
  },
  {
    group: "CREATE",
    items: [
      { href: "/vouchers/new",                label: "New Voucher", icon: "📦" },
      { href: "/campaigns/new?type=platform", label: "To Platform", icon: "↗" },
    ],
  },
  {
    group: "SETTINGS",
    items: [
      { href: "/settings", label: "Autopost", icon: "⚡" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <aside className="flex h-full w-[220px] flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-xs font-bold text-card">
          F
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-none">Full Agency</p>
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest mt-0.5">WORKSPACE</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((section) => (
          <div key={section.group} className="mb-4">
            <p className="px-4 mb-1 text-[10px] font-mono font-medium tracking-widest text-muted-foreground">
              {section.group}
            </p>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "?") ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href.split("?")[0]));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-foreground text-card font-medium"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span className="text-xs w-3 text-center shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
            {section.sub && (
              <p className="px-4 pt-0.5 text-[10px] font-mono text-muted-foreground whitespace-pre">
                {section.sub}
              </p>
            )}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-card shrink-0">
          {user?.firstName?.[0] ?? "U"}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">
            {user?.firstName ?? "User"}
          </p>
          <p className="text-[10px] text-muted-foreground">Pro plan</p>
        </div>
      </div>
    </aside>
  );
}
