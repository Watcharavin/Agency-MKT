"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/db/schema";

const FILTERS = ["ทั้งหมด", "Facebook", "Instagram", "LINE", "TikTok"] as const;

const CHANNEL_ICON: Record<string, string> = {
  Facebook: "f",
  Instagram: "ig",
  LINE: "L",
  TikTok: "tt",
};

const STATUS_STYLE: Record<string, string> = {
  draft:      "bg-secondary text-muted-foreground",
  generating: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  generated:  "bg-green-50 text-green-700 border border-green-200",
  scheduled:  "bg-blue-50 text-blue-700 border border-blue-200",
  published:  "bg-foreground text-card",
};

export function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const [filter, setFilter] = useState<string>("ทั้งหมด");

  const filtered = filter === "ทั้งหมด"
    ? campaigns
    : campaigns.filter((c) => c.channel === filter);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f ? "bg-foreground text-card" : "bg-secondary text-foreground hover:bg-border"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-2xl mb-3">◑</p>
          <p className="text-sm text-foreground font-medium">
            {filter === "ทั้งหมด" ? "ยังไม่มี Campaign" : `ไม่มี Campaign ใน ${filter}`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            AI สร้างรูป carousel + caption + hashtags ให้อัตโนมัติ
          </p>
          <Link
            href="/campaigns/new?type=platform"
            className="mt-5 inline-block rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            สร้าง Campaign แรก
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-foreground/30 transition-colors group"
            >
              {/* Channel badge */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-mono font-bold text-foreground uppercase">
                {CHANNEL_ICON[c.channel] ?? c.channel[0]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.topic}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{c.channel}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground">{c.slideCount} slides</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{c.language}</span>
                </div>
              </div>

              {/* Status */}
              <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium shrink-0", STATUS_STYLE[c.status ?? "draft"])}>
                {c.status ?? "draft"}
              </span>

              {/* Date */}
              <span className="text-[10px] text-muted-foreground shrink-0">
                {c.createdAt ? new Date(c.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "—"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
