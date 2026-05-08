"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/db/schema";

// ── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week" | "list";

const CHANNEL_ICON: Record<string, string> = {
  Facebook: "FB", Instagram: "IG", LINE: "LN", TikTok: "TK",
};

const CHANNEL_COLOR: Record<string, string> = {
  Facebook:  "bg-blue-100 text-blue-700 border-blue-200",
  Instagram: "bg-pink-100 text-pink-700 border-pink-200",
  LINE:      "bg-green-100 text-green-700 border-green-200",
  TikTok:    "bg-purple-100 text-purple-700 border-purple-200",
};

const STATUS_DOT: Record<string, string> = {
  draft:      "bg-gray-400",
  generating: "bg-yellow-400",
  generated:  "bg-green-400",
  scheduled:  "bg-blue-400",
  published:  "bg-foreground",
};

const FILTERS = ["ทั้งหมด", "Facebook", "Instagram", "LINE", "TikTok"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatThaiDate(d: Date) {
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function formatThaiMonth(d: Date) {
  return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

function getWeekDays(d: Date): Date[] {
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}

function getMonthCalendarDays(d: Date): Date[] {
  const first = startOfMonth(d);
  const last = endOfMonth(d);
  const startDay = first.getDay(); // 0 = Sunday
  const days: Date[] = [];
  // Fill in days from previous month
  for (let i = startDay - 1; i >= 0; i--) {
    const prev = new Date(first);
    prev.setDate(first.getDate() - i - 1);
    days.push(prev);
  }
  // Current month days
  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(d.getFullYear(), d.getMonth(), i));
  }
  // Fill remaining to complete 6 rows (42 cells) or at least complete the last row
  while (days.length % 7 !== 0) {
    const next = new Date(days[days.length - 1]);
    next.setDate(next.getDate() + 1);
    days.push(next);
  }
  return days;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ContentCalendar({ campaigns: initialCampaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Campaign[]>(initialCampaigns);
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<string>("ทั้งหมด");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const today = new Date();

  const filtered = filter === "ทั้งหมด"
    ? items
    : items.filter((c) => c.channel === filter);

  function getCampaignsForDay(day: Date) {
    return filtered.filter((c) => {
      const d = c.scheduledAt ? new Date(c.scheduledAt) : null;
      return d && isSameDay(d, day);
    });
  }

  // Unscheduled campaigns
  const unscheduled = filtered.filter((c) => !c.scheduledAt);

  // ── Navigation ──

  function goNext() {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === "month") next.setMonth(d.getMonth() + 1);
      else next.setDate(d.getDate() + 7);
      return next;
    });
  }

  function goPrev() {
    setCurrentDate((d) => {
      const prev = new Date(d);
      if (view === "month") prev.setMonth(d.getMonth() - 1);
      else prev.setDate(d.getDate() - 7);
      return prev;
    });
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  // ── Drag & Drop ──

  async function handleDrop(e: React.DragEvent, targetDate: Date) {
    const cId = e.dataTransfer.getData("text/plain");
    if (!cId) return;
    setDraggingId(null);

    // Optimistic update — move campaign to target date immediately
    setItems((prev) =>
      prev.map((c) =>
        c.id === cId ? { ...c, scheduledAt: targetDate, status: "scheduled" as const } : c
      )
    );

    try {
      await fetch(`/api/campaigns/${cId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: targetDate.toISOString(),
          status: "scheduled",
        }),
      });
      router.refresh();
    } catch {
      router.refresh();
    }
  }

  // ── Campaign card (used in all views) ──

  const didDrag = useRef(false);

  function CampaignCard({ c, compact }: { c: Campaign; compact?: boolean }) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", c.id);
          setDraggingId(c.id);
          didDrag.current = true;
        }}
        onDragEnd={() => setDraggingId(null)}
        onClick={() => {
          // Only navigate if not dragging
          if (!didDrag.current) {
            router.push(`/campaigns/${c.id}`);
          }
          didDrag.current = false;
        }}
        className={cn(
          "block rounded-md border px-2 py-1.5 transition-all cursor-grab active:cursor-grabbing select-none",
          compact ? "text-[10px]" : "text-xs",
          CHANNEL_COLOR[c.channel] ?? "bg-secondary text-foreground border-border",
          draggingId === c.id && "opacity-40 scale-95",
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[c.status ?? "draft"])} />
          <span className="font-medium truncate">{c.topic}</span>
        </div>
        {!compact && (
          <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-70">
            <span className="font-mono">{CHANNEL_ICON[c.channel]}</span>
            <span>{c.slideCount} slides</span>
          </div>
        )}
      </div>
    );
  }

  // ── Drop zone wrapper ──

  function DropZone({ date, children, className }: { date: Date; children: React.ReactNode; className?: string }) {
    const [over, setOver] = useState(false);
    return (
      <div
        className={cn(className, over && "bg-primary/5 ring-2 ring-primary/20")}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handleDrop(e, date); }}
      >
        {children}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Nav */}
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-secondary transition-colors">&lt;</button>
          <button onClick={goToday} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary transition-colors">วันนี้</button>
          <button onClick={goNext} className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-secondary transition-colors">&gt;</button>
          <h2 className="text-sm font-semibold text-foreground ml-2">
            {view === "month" ? formatThaiMonth(currentDate)
              : view === "week" ? `สัปดาห์ ${formatThaiDate(getWeekDays(currentDate)[0])} - ${formatThaiDate(getWeekDays(currentDate)[6])}`
              : "รายการทั้งหมด"}
          </h2>
        </div>

        {/* View toggle + filter */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
                  filter === f ? "bg-foreground text-card" : "bg-secondary text-foreground hover:bg-border"
                )}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-border overflow-hidden">
            {(["month", "week", "list"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("px-3 py-1.5 text-[11px] font-medium transition-colors",
                  view === v ? "bg-foreground text-card" : "bg-background text-foreground hover:bg-secondary"
                )}>
                {v === "month" ? "เดือน" : v === "week" ? "สัปดาห์" : "List"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Unscheduled campaigns (drag source) ── */}
      {unscheduled.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            ยังไม่ได้ schedule ({unscheduled.length})  — ลากไปวางในปฏิทิน
          </p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((c) => (
              <CampaignCard key={c.id} c={c} compact />
            ))}
          </div>
        </div>
      )}

      {/* ══ MONTH VIEW ══ */}
      {view === "month" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-2 border-r border-border last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {getMonthCalendarDays(currentDate).map((day, i) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, today);
              const dayCampaigns = getCampaignsForDay(day);

              return (
                <DropZone key={i} date={day}
                  className={cn(
                    "min-h-[100px] border-r border-b border-border last:border-r-0 p-1.5 transition-colors",
                    !isCurrentMonth && "bg-secondary/30",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-[11px] font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-foreground text-card" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                    )}>
                      {day.getDate()}
                    </span>
                    {isCurrentMonth && (
                      <Link
                        href={`/campaigns/new?type=platform&date=${day.toISOString().split("T")[0]}`}
                        className="text-[10px] text-muted-foreground/0 hover:text-muted-foreground transition-colors group-hover:text-muted-foreground"
                        title="สร้าง campaign วันนี้"
                      >
                        +
                      </Link>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayCampaigns.slice(0, 3).map((c) => (
                      <CampaignCard key={c.id} c={c} compact />
                    ))}
                    {dayCampaigns.length > 3 && (
                      <p className="text-[9px] text-muted-foreground text-center">+{dayCampaigns.length - 3} more</p>
                    )}
                  </div>
                </DropZone>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ WEEK VIEW ══ */}
      {view === "week" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7">
            {getWeekDays(currentDate).map((day, i) => {
              const isToday = isSameDay(day, today);
              const dayCampaigns = getCampaignsForDay(day);

              return (
                <DropZone key={i} date={day}
                  className={cn(
                    "min-h-[300px] border-r border-border last:border-r-0 transition-colors",
                    isToday && "bg-primary/5",
                  )}
                >
                  {/* Day header */}
                  <div className={cn(
                    "text-center py-3 border-b border-border",
                    isToday && "bg-foreground text-card",
                  )}>
                    <p className="text-[10px] font-medium">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][day.getDay()]}</p>
                    <p className={cn("text-lg font-semibold", isToday ? "text-card" : "text-foreground")}>{day.getDate()}</p>
                    <p className="text-[10px] opacity-60">{day.toLocaleDateString("th-TH", { month: "short" })}</p>
                  </div>
                  {/* Campaigns */}
                  <div className="p-2 space-y-1.5">
                    {dayCampaigns.map((c) => (
                      <CampaignCard key={c.id} c={c} />
                    ))}
                    {dayCampaigns.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/40 text-center pt-4">ว่าง</p>
                    )}
                  </div>
                </DropZone>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ LIST VIEW ══ */}
      {view === "list" && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">ยังไม่มี Campaign</p>
            </div>
          ) : (
            <>
              {/* Scheduled */}
              {filtered.filter((c) => c.scheduledAt).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()).map((c) => (
                <Link key={c.id} href={`/campaigns/${c.id}`}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-foreground/30 transition-colors"
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-mono font-bold border", CHANNEL_COLOR[c.channel])}>
                    {CHANNEL_ICON[c.channel]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.topic}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground">{c.channel}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground">{c.slideCount} slides</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground">{c.pillar}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-foreground">
                      {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 justify-end">
                      <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[c.status ?? "draft"])} />
                      <span className="text-[10px] text-muted-foreground">{c.status}</span>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Unscheduled in list */}
              {unscheduled.length > 0 && (
                <>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pt-3">ยังไม่ได้ schedule</p>
                  {unscheduled.map((c) => (
                    <Link key={c.id} href={`/campaigns/${c.id}`}
                      className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-card px-4 py-3 hover:border-foreground/30 transition-colors"
                    >
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-mono font-bold border", CHANNEL_COLOR[c.channel])}>
                        {CHANNEL_ICON[c.channel]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.topic}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-muted-foreground">{c.channel}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-[10px] text-muted-foreground">{c.slideCount} slides</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground italic shrink-0">ไม่มี schedule</span>
                    </Link>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
