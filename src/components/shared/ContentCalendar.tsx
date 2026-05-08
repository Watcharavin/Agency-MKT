"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/db/schema";

// ── Constants ────────────────────────────────────────────────────────────────

type ViewMode = "month" | "timeline" | "board" | "list";

const CHANNEL_ICON: Record<string, string> = {
  Facebook: "FB", Instagram: "IG", LINE: "LN", TikTok: "TK",
};
const CHANNEL_COLOR: Record<string, string> = {
  Facebook: "bg-blue-100 text-blue-700 border-blue-200",
  Instagram: "bg-pink-100 text-pink-700 border-pink-200",
  LINE: "bg-green-100 text-green-700 border-green-200",
  TikTok: "bg-purple-100 text-purple-700 border-purple-200",
};
const CHANNEL_BG: Record<string, string> = {
  Facebook: "bg-blue-500", Instagram: "bg-pink-500", LINE: "bg-green-500", TikTok: "bg-purple-500",
};
const CHANNEL_BORDER_LEFT: Record<string, string> = {
  Facebook: "border-l-blue-500", Instagram: "border-l-pink-500", LINE: "border-l-green-500", TikTok: "border-l-purple-500",
};
const STATUS_DOT: Record<string, string> = {
  draft: "bg-gray-400", generating: "bg-yellow-400", generated: "bg-green-400", scheduled: "bg-blue-400", published: "bg-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "แบบร่าง", generating: "กำลังสร้าง", generated: "สร้างแล้ว", scheduled: "มี schedule", published: "เผยแพร่แล้ว",
};
const STATUS_COLUMNS = ["draft", "generated", "scheduled", "published"] as const;
const STATUS_COL_LABEL: Record<string, string> = {
  draft: "แบบร่าง", generated: "สร้างแล้ว", scheduled: "มี Schedule", published: "เผยแพร่แล้ว",
};

const FILTERS = ["ทั้งหมด", "Facebook", "Instagram", "LINE", "TikTok"] as const;
const DAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function formatThaiDate(d: Date) { return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }); }
function formatThaiMonth(d: Date) { return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" }); }

function getWeekDays(d: Date): Date[] {
  const day = d.getDay();
  const start = new Date(d); start.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => { const date = new Date(start); date.setDate(start.getDate() + i); return date; });
}

function getMonthCalendarDays(d: Date): Date[] {
  const first = startOfMonth(d); const last = endOfMonth(d); const startDay = first.getDay(); const days: Date[] = [];
  for (let i = startDay - 1; i >= 0; i--) { const prev = new Date(first); prev.setDate(first.getDate() - i - 1); days.push(prev); }
  for (let i = 1; i <= last.getDate(); i++) days.push(new Date(d.getFullYear(), d.getMonth(), i));
  while (days.length % 7 !== 0) { const next = new Date(days[days.length - 1]); next.setDate(next.getDate() + 1); days.push(next); }
  return days;
}

function toDateInputValue(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

// Generate 14 days starting from a date (for timeline)
function getTimelineDays(d: Date): Date[] {
  return Array.from({ length: 14 }, (_, i) => { const date = new Date(d); date.setDate(d.getDate() + i); return date; });
}

function getWeekNumber(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

// ── Inline card render ──────────────────────────────────────────────────────

function renderCard(
  c: Campaign, compact: boolean, draggingId: string | null,
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void,
  onDragEnd: () => void, onClick: (id: string) => void,
) {
  return (
    <div key={c.id} draggable
      onDragStart={(e) => onDragStart(e, c.id)} onDragEnd={onDragEnd}
      onClick={(e) => { e.stopPropagation(); onClick(c.id); }}
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

// ── Component ────────────────────────────────────────────────────────────────

export function ContentCalendar({ campaigns: initialCampaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Campaign[]>(initialCampaigns);
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<string>("ทั้งหมด");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropOverDate, setDropOverDate] = useState<string | null>(null);
  const [dropOverStatus, setDropOverStatus] = useState<string | null>(null);
  const [dropOverUnscheduled, setDropOverUnscheduled] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [popupDate, setPopupDate] = useState("");
  const [saving, setSaving] = useState(false);
  const didDragRef = useRef(false);

  const today = new Date();
  const filtered = filter === "ทั้งหมด" ? items : items.filter((c) => c.channel === filter);
  const unscheduled = filtered.filter((c) => !c.scheduledAt);
  const scheduled = filtered.filter((c) => c.scheduledAt);

  function getCampaignsForDay(day: Date) {
    return filtered.filter((c) => { const d = c.scheduledAt ? new Date(c.scheduledAt) : null; return d && isSameDay(d, day); });
  }

  // ── Navigation ──
  function goNext() {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === "month") next.setMonth(d.getMonth() + 1);
      else if (view === "timeline") next.setDate(d.getDate() + 14);
      return next;
    });
  }
  function goPrev() {
    setCurrentDate((d) => {
      const prev = new Date(d);
      if (view === "month") prev.setMonth(d.getMonth() - 1);
      else if (view === "timeline") prev.setDate(d.getDate() - 14);
      return prev;
    });
  }
  function goToday() { setCurrentDate(new Date()); }

  function getHeaderTitle() {
    if (view === "month") return formatThaiMonth(currentDate);
    if (view === "timeline") {
      const days = getTimelineDays(currentDate);
      return `${formatThaiDate(days[0])} — ${formatThaiDate(days[13])}`;
    }
    if (view === "board") return "Board";
    return "รายการทั้งหมด";
  }

  // ── Drag handlers ──
  const handleCardDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id);
    setDraggingId(id); didDragRef.current = true;
  }, []);
  const handleCardDragEnd = useCallback(() => { setDraggingId(null); setDropOverUnscheduled(false); setDropOverStatus(null); }, []);

  const handleCardClick = useCallback((id: string) => {
    if (didDragRef.current) { didDragRef.current = false; return; }
    const c = items.find((x) => x.id === id);
    if (c) { setSelectedCampaign(c); setPopupDate(c.scheduledAt ? toDateInputValue(new Date(c.scheduledAt)) : ""); }
  }, [items]);

  const openPopup = useCallback((c: Campaign) => {
    setSelectedCampaign(c); setPopupDate(c.scheduledAt ? toDateInputValue(new Date(c.scheduledAt)) : "");
  }, []);

  const patchCampaign = useCallback(async (cId: string, data: Record<string, unknown>) => {
    try { await fetch(`/api/campaigns/${cId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); router.refresh(); }
    catch { router.refresh(); }
  }, [router]);

  const handleDropOnDate = useCallback(async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault(); setDropOverDate(null);
    const cId = e.dataTransfer.getData("text/plain"); if (!cId) return; setDraggingId(null);
    setItems((prev) => prev.map((c) => c.id === cId ? { ...c, scheduledAt: targetDate, status: "scheduled" as const } : c));
    await patchCampaign(cId, { scheduledAt: targetDate.toISOString(), status: "scheduled" });
  }, [patchCampaign]);

  const handleDropOnUnscheduled = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDropOverUnscheduled(false);
    const cId = e.dataTransfer.getData("text/plain"); if (!cId) return; setDraggingId(null);
    setItems((prev) => prev.map((c) => c.id === cId ? { ...c, scheduledAt: null, status: "draft" as const } : c));
    await patchCampaign(cId, { scheduledAt: null, status: "draft" });
  }, [patchCampaign]);

  // Board: drop on status column
  const handleDropOnStatus = useCallback(async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault(); setDropOverStatus(null);
    const cId = e.dataTransfer.getData("text/plain"); if (!cId) return; setDraggingId(null);
    setItems((prev) => prev.map((c) => c.id === cId ? { ...c, status: targetStatus as Campaign["status"] } : c));
    await patchCampaign(cId, { status: targetStatus });
  }, [patchCampaign]);

  const handleDragOver = useCallback((e: React.DragEvent, dk: string) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropOverDate(dk); }, []);
  const handleDragLeave = useCallback(() => { setDropOverDate(null); }, []);

  // ── Popup: save date ──
  async function handlePopupSaveDate() {
    if (!selectedCampaign) return; setSaving(true);
    if (popupDate) {
      const newDate = new Date(popupDate + "T12:00:00");
      setItems((prev) => prev.map((c) => c.id === selectedCampaign.id ? { ...c, scheduledAt: newDate, status: "scheduled" as const } : c));
      await patchCampaign(selectedCampaign.id, { scheduledAt: newDate.toISOString(), status: "scheduled" });
      setSelectedCampaign((prev) => prev ? { ...prev, scheduledAt: newDate, status: "scheduled" as const } : null);
    } else {
      setItems((prev) => prev.map((c) => c.id === selectedCampaign.id ? { ...c, scheduledAt: null, status: "draft" as const } : c));
      await patchCampaign(selectedCampaign.id, { scheduledAt: null, status: "draft" });
      setSelectedCampaign((prev) => prev ? { ...prev, scheduledAt: null, status: "draft" as const } : null);
    }
    setSaving(false);
  }

  const channelCounts = ["Facebook", "Instagram", "LINE", "TikTok"].map((ch) => ({ ch, count: filtered.filter((c) => c.channel === ch).length })).filter((x) => x.count > 0);

  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">

      {/* ── View Switcher ── */}
      <div className="flex items-center justify-center gap-1 rounded-lg border border-border bg-secondary/30 p-1">
        {(["month", "timeline", "board", "list"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={cn("rounded-md px-5 py-2 text-sm font-medium transition-all",
              view === v ? "bg-foreground text-card shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}>
            {{ month: "ปฏิทิน", timeline: "Timeline", board: "Board", list: "รายการ" }[v]}
          </button>
        ))}
      </div>

      {/* ── Nav + Filters ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {(view === "month" || view === "timeline") && (
            <>
              <button onClick={goPrev} className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-secondary transition-colors">&lt;</button>
              <button onClick={goToday} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary transition-colors">วันนี้</button>
              <button onClick={goNext} className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-secondary transition-colors">&gt;</button>
            </>
          )}
          <h2 className="text-sm font-semibold text-foreground ml-1">{getHeaderTitle()}</h2>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
                filter === f ? "bg-foreground text-card" : "bg-secondary text-foreground hover:bg-border"
              )}>{f}</button>
          ))}
        </div>
      </div>

      {/* ── Unscheduled pool (hide on board view — board has its own draft column) ── */}
      {view !== "board" && (
        <div className={cn("rounded-lg border border-dashed p-3 transition-colors",
          dropOverUnscheduled ? "border-red-400 bg-red-50/50 ring-2 ring-red-200" : "border-border bg-secondary/30")}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropOverUnscheduled(true); }}
          onDragLeave={() => setDropOverUnscheduled(false)} onDrop={handleDropOnUnscheduled}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            {dropOverUnscheduled ? "ปล่อยที่นี่เพื่อยกเลิก schedule" : `ยังไม่ได้ schedule (${unscheduled.length})  — ลากไปวางในปฏิทิน`}
          </p>
          {unscheduled.length > 0 ? (
            <div className="flex flex-wrap gap-2">{unscheduled.map((c) => renderCard(c, true, draggingId, handleCardDragStart, handleCardDragEnd, handleCardClick))}</div>
          ) : !dropOverUnscheduled ? (
            <p className="text-[10px] text-muted-foreground/50 italic">ทุก campaign มี schedule แล้ว</p>
          ) : null}
        </div>
      )}

      {/* ══ MONTH VIEW ══ */}
      {view === "month" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-2 border-r border-border last:border-r-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {getMonthCalendarDays(currentDate).map((day, i) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, today);
              const dayCampaigns = getCampaignsForDay(day);
              const dk = dateKey(day); const isOver = dropOverDate === dk;
              return (
                <div key={i} className={cn("min-h-[100px] border-r border-b border-border last:border-r-0 p-1.5 transition-colors",
                  !isCurrentMonth && "bg-secondary/30", isOver && "bg-primary/5 ring-2 ring-primary/20")}
                  onDragOver={(e) => handleDragOver(e, dk)} onDragLeave={handleDragLeave} onDrop={(e) => handleDropOnDate(e, day)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-[11px] font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-foreground text-card" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50")}>{day.getDate()}</span>
                    {isCurrentMonth && (
                      <Link href={`/campaigns/new?type=platform&date=${day.toISOString().split("T")[0]}`}
                        className="text-[10px] text-muted-foreground/0 hover:text-muted-foreground transition-colors" title="สร้าง campaign วันนี้">+</Link>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayCampaigns.slice(0, 3).map((c) => renderCard(c, true, draggingId, handleCardDragStart, handleCardDragEnd, handleCardClick))}
                    {dayCampaigns.length > 3 && <p className="text-[9px] text-muted-foreground text-center">+{dayCampaigns.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TIMELINE VIEW ══ */}
      {view === "timeline" && (() => {
        const days = getTimelineDays(currentDate);
        // Group campaigns by channel for rows
        const channels = [...new Set(filtered.map((c) => c.channel))];

        return (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Timeline header — dates */}
              <div className="grid border-b border-border" style={{ gridTemplateColumns: `120px repeat(${days.length}, 1fr)` }}>
                <div className="px-3 py-2 border-r border-border bg-secondary/30">
                  <p className="text-[10px] font-mono uppercase text-muted-foreground">แพลตฟอร์ม</p>
                </div>
                {days.map((day, i) => {
                  const isToday = isSameDay(day, today);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div key={i} className={cn(
                      "text-center py-2 border-r border-border last:border-r-0 text-[10px]",
                      isToday && "bg-foreground text-card", isWeekend && !isToday && "bg-secondary/30",
                    )}>
                      <p className="font-medium">{DAY_NAMES[day.getDay()]}</p>
                      <p className={cn("text-sm font-semibold", !isToday && "text-foreground")}>{day.getDate()}</p>
                      <p className="opacity-60">{day.toLocaleDateString("th-TH", { month: "short" })}</p>
                    </div>
                  );
                })}
              </div>

              {/* Channel rows */}
              {channels.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-muted-foreground">ไม่มี campaign</p>
                </div>
              ) : channels.map((channel) => (
                <div key={channel} className="grid border-b border-border last:border-b-0"
                  style={{ gridTemplateColumns: `120px repeat(${days.length}, 1fr)` }}>
                  {/* Channel label */}
                  <div className="px-3 py-3 border-r border-border flex items-center gap-2 bg-secondary/10">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", CHANNEL_BG[channel])} />
                    <span className="text-xs font-medium text-foreground">{channel}</span>
                    <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border", CHANNEL_COLOR[channel])}>{CHANNEL_ICON[channel]}</span>
                  </div>

                  {/* Day cells */}
                  {days.map((day, i) => {
                    const dk = dateKey(day); const isOver = dropOverDate === dk;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const dayCampaigns = filtered.filter((c) =>
                      c.channel === channel && c.scheduledAt && isSameDay(new Date(c.scheduledAt), day)
                    );

                    return (
                      <div key={i} className={cn(
                        "min-h-[70px] border-r border-border last:border-r-0 p-1 transition-colors",
                        isWeekend && "bg-secondary/10", isOver && "bg-primary/5 ring-2 ring-primary/20",
                      )}
                        onDragOver={(e) => handleDragOver(e, dk)} onDragLeave={handleDragLeave} onDrop={(e) => handleDropOnDate(e, day)}
                      >
                        <div className="space-y-1">
                          {dayCampaigns.map((c) => (
                            <div key={c.id} draggable
                              onDragStart={(e) => handleCardDragStart(e, c.id)} onDragEnd={handleCardDragEnd}
                              onClick={(e) => { e.stopPropagation(); handleCardClick(c.id); }}
                              className={cn(
                                "rounded px-1.5 py-1 text-[9px] font-medium truncate cursor-grab active:cursor-grabbing select-none border transition-all",
                                CHANNEL_COLOR[c.channel], draggingId === c.id && "opacity-40 scale-95",
                              )}
                            >
                              <div className="flex items-center gap-1">
                                <span className={cn("w-1 h-1 rounded-full shrink-0", STATUS_DOT[c.status ?? "draft"])} />
                                <span className="truncate">{c.topic}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* "All" row for unscheduled visual hint */}
              {unscheduled.length > 0 && (
                <div className="px-4 py-2 bg-secondary/20 border-t border-border">
                  <p className="text-[10px] text-muted-foreground">{unscheduled.length} campaign ยังไม่ได้ schedule — ลากจากด้านบนมาวางใน timeline</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ══ BOARD VIEW (Kanban) ══ */}
      {view === "board" && (
        <div className="grid grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((status) => {
            const colCampaigns = filtered.filter((c) => {
              const s = c.status ?? "draft";
              if (status === "draft") return s === "draft" || s === "generating";
              return s === status;
            });
            const isOver = dropOverStatus === status;

            return (
              <div key={status}
                className={cn("rounded-lg border bg-card flex flex-col min-h-[400px] transition-colors",
                  isOver ? "border-primary ring-2 ring-primary/20" : "border-border")}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropOverStatus(status); }}
                onDragLeave={() => setDropOverStatus(null)}
                onDrop={(e) => handleDropOnStatus(e, status)}
              >
                {/* Column header */}
                <div className="px-3 py-3 border-b border-border flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT[status])} />
                    <span className="text-xs font-semibold text-foreground">{STATUS_COL_LABEL[status]}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{colCampaigns.length}</span>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {colCampaigns.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/40 text-center pt-8">ว่าง</p>
                  ) : colCampaigns.map((c) => (
                    <div key={c.id} draggable
                      onDragStart={(e) => handleCardDragStart(e, c.id)} onDragEnd={handleCardDragEnd}
                      onClick={(e) => { e.stopPropagation(); handleCardClick(c.id); }}
                      className={cn(
                        "rounded-lg border p-3 transition-all cursor-grab active:cursor-grabbing select-none hover:shadow-md border-l-4",
                        CHANNEL_BORDER_LEFT[c.channel] ?? "border-l-border",
                        "bg-card border-border",
                        draggingId === c.id && "opacity-40 scale-95",
                      )}
                    >
                      <p className="text-xs font-semibold text-foreground truncate">{c.topic}</p>
                      {c.brief && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{c.brief}</p>}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium border", CHANNEL_COLOR[c.channel])}>
                          {CHANNEL_ICON[c.channel]} {c.channel}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{c.slideCount} slides</span>
                        {c.scheduledAt && (
                          <span className="text-[9px] text-muted-foreground bg-secondary rounded px-1 py-0.5">
                            {new Date(c.scheduledAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ LIST VIEW ══ */}
      {view === "list" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">ทั้งหมด</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{filtered.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">มี schedule</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{scheduled.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">ยังไม่ schedule</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{unscheduled.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">แพลตฟอร์ม</p>
              <div className="flex items-center gap-1.5 mt-1">
                {channelCounts.map(({ ch, count }) => (
                  <span key={ch} className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium border", CHANNEL_COLOR[ch])}>{CHANNEL_ICON[ch]} {count}</span>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">ยังไม่มี Campaign</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_80px_80px_100px] gap-2 px-4 py-2.5 border-b border-border bg-secondary/30">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Campaign</p>
                <p className="text-[10px] font-mono uppercase text-muted-foreground">แพลตฟอร์ม</p>
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Slides</p>
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Status</p>
                <p className="text-[10px] font-mono uppercase text-muted-foreground text-right">วันที่</p>
              </div>
              {(() => {
                const sorted = [...scheduled].sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
                const groups: { label: string; items: Campaign[] }[] = [];
                let currentWeek = -1;
                for (const c of sorted) {
                  const d = new Date(c.scheduledAt!); const wk = getWeekNumber(d);
                  if (wk !== currentWeek) {
                    const ws = getWeekDays(d);
                    groups.push({ label: `สัปดาห์ ${formatThaiDate(ws[0])} - ${formatThaiDate(ws[6])}`, items: [] });
                    currentWeek = wk;
                  }
                  groups[groups.length - 1].items.push(c);
                }
                return groups.map((g, gi) => (
                  <div key={gi}>
                    <div className="px-4 py-1.5 bg-secondary/20 border-b border-border">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{g.label} · {g.items.length} campaigns</p>
                    </div>
                    {g.items.map((c) => (
                      <div key={c.id} onClick={() => openPopup(c)}
                        className="grid grid-cols-[1fr_100px_80px_80px_100px] gap-2 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors cursor-pointer items-center">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("w-1 h-8 rounded-full shrink-0", CHANNEL_BG[c.channel] ?? "bg-border")} />
                          <div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{c.topic}</p>{c.pillar && <p className="text-[10px] text-muted-foreground">{c.pillar}</p>}</div>
                        </div>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border w-fit", CHANNEL_COLOR[c.channel])}>{CHANNEL_ICON[c.channel]} {c.channel}</span>
                        <span className="text-xs text-muted-foreground">{c.slideCount} slides</span>
                        <div className="flex items-center gap-1"><span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[c.status ?? "draft"])} /><span className="text-[10px] text-muted-foreground">{STATUS_LABEL[c.status ?? "draft"]}</span></div>
                        <p className="text-xs font-medium text-foreground text-right">{new Date(c.scheduledAt!).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</p>
                      </div>
                    ))}
                  </div>
                ));
              })()}
              {unscheduled.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-secondary/20 border-b border-border border-t">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">ยังไม่ได้ schedule · {unscheduled.length} campaigns</p>
                  </div>
                  {unscheduled.map((c) => (
                    <div key={c.id} onClick={() => openPopup(c)}
                      className="grid grid-cols-[1fr_100px_80px_80px_100px] gap-2 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors cursor-pointer items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-1 h-8 rounded-full shrink-0 opacity-40", CHANNEL_BG[c.channel] ?? "bg-border")} />
                        <div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{c.topic}</p>{c.pillar && <p className="text-[10px] text-muted-foreground">{c.pillar}</p>}</div>
                      </div>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border w-fit", CHANNEL_COLOR[c.channel])}>{CHANNEL_ICON[c.channel]} {c.channel}</span>
                      <span className="text-xs text-muted-foreground">{c.slideCount} slides</span>
                      <div className="flex items-center gap-1"><span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[c.status ?? "draft"])} /><span className="text-[10px] text-muted-foreground">{STATUS_LABEL[c.status ?? "draft"]}</span></div>
                      <p className="text-xs text-muted-foreground italic text-right">—</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ CAMPAIGN DETAIL POPUP ══ */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedCampaign(null)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className={cn("px-5 py-3 flex items-center justify-between", CHANNEL_BG[selectedCampaign.channel] ?? "bg-foreground")}>
              <div className="flex items-center gap-2">
                <span className="text-white text-xs font-mono font-bold">{CHANNEL_ICON[selectedCampaign.channel]}</span>
                <span className="text-white/80 text-[10px]">{selectedCampaign.channel}</span>
              </div>
              <button onClick={() => setSelectedCampaign(null)} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">{selectedCampaign.topic}</h3>
                {selectedCampaign.brief && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{selectedCampaign.brief}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-secondary/50 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">Status</p>
                  <div className="flex items-center gap-1.5 mt-0.5"><span className={cn("w-2 h-2 rounded-full", STATUS_DOT[selectedCampaign.status ?? "draft"])} /><span className="text-xs font-medium text-foreground">{STATUS_LABEL[selectedCampaign.status ?? "draft"]}</span></div>
                </div>
                <div className="rounded-md bg-secondary/50 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">Slides</p>
                  <p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.slideCount} slides</p>
                </div>
                {selectedCampaign.pillar && <div className="rounded-md bg-secondary/50 px-3 py-2"><p className="text-[10px] text-muted-foreground font-mono uppercase">Pillar</p><p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.pillar}</p></div>}
                {selectedCampaign.tone && <div className="rounded-md bg-secondary/50 px-3 py-2"><p className="text-[10px] text-muted-foreground font-mono uppercase">Tone</p><p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.tone}</p></div>}
                {selectedCampaign.goal && <div className="rounded-md bg-secondary/50 px-3 py-2"><p className="text-[10px] text-muted-foreground font-mono uppercase">Goal</p><p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.goal}</p></div>}
                {selectedCampaign.audience && <div className="rounded-md bg-secondary/50 px-3 py-2"><p className="text-[10px] text-muted-foreground font-mono uppercase">Audience</p><p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.audience}</p></div>}
              </div>
              <div className="rounded-md border border-border p-3 space-y-2">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">Schedule วันที่</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={popupDate} onChange={(e) => setPopupDate(e.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  {popupDate && <button onClick={() => setPopupDate("")} className="rounded-md border border-border px-2 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors">ล้าง</button>}
                </div>
                {(() => {
                  const origDate = selectedCampaign.scheduledAt ? toDateInputValue(new Date(selectedCampaign.scheduledAt)) : "";
                  if (popupDate === origDate) return null;
                  return (
                    <button onClick={handlePopupSaveDate} disabled={saving}
                      className="w-full rounded-md bg-foreground text-card py-2 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50">
                      {saving ? "กำลังบันทึก..." : popupDate ? `ย้ายไป ${new Date(popupDate + "T12:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}` : "ยกเลิก schedule"}
                    </button>
                  );
                })()}
              </div>
              <div className="flex gap-2">
                <Link href={`/campaigns/${selectedCampaign.id}`} className="flex-1 text-center rounded-md border border-border py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors">ดูรายละเอียดเต็ม</Link>
                <button onClick={() => setSelectedCampaign(null)} className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors">ปิด</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
