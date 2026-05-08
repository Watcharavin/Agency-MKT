"use client";

import { useState, useRef, useCallback } from "react";
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

const CHANNEL_BG: Record<string, string> = {
  Facebook:  "bg-blue-500",
  Instagram: "bg-pink-500",
  LINE:      "bg-green-500",
  TikTok:    "bg-purple-500",
};

const STATUS_DOT: Record<string, string> = {
  draft:      "bg-gray-400",
  generating: "bg-yellow-400",
  generated:  "bg-green-400",
  scheduled:  "bg-blue-400",
  published:  "bg-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  draft:      "แบบร่าง",
  generating: "กำลังสร้าง",
  generated:  "สร้างแล้ว",
  scheduled:  "มี schedule",
  published:  "เผยแพร่แล้ว",
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
  const startDay = first.getDay();
  const days: Date[] = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const prev = new Date(first);
    prev.setDate(first.getDate() - i - 1);
    days.push(prev);
  }
  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(d.getFullYear(), d.getMonth(), i));
  }
  while (days.length % 7 !== 0) {
    const next = new Date(days[days.length - 1]);
    next.setDate(next.getDate() + 1);
    days.push(next);
  }
  return days;
}

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Inline card render ──────────────────────────────────────────────────────

function renderCard(
  c: Campaign,
  compact: boolean,
  draggingId: string | null,
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void,
  onDragEnd: () => void,
  onClick: (id: string) => void,
) {
  return (
    <div
      key={c.id}
      draggable
      onDragStart={(e) => onDragStart(e, c.id)}
      onDragEnd={onDragEnd}
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
  const [dropOverUnscheduled, setDropOverUnscheduled] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [popupDate, setPopupDate] = useState("");
  const [saving, setSaving] = useState(false);
  const didDragRef = useRef(false);

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

  // ── Drag handlers ──

  const handleCardDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setDraggingId(id);
    didDragRef.current = true;
  }, []);

  const handleCardDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropOverUnscheduled(false);
  }, []);

  const handleCardClick = useCallback((id: string) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    const c = items.find((x) => x.id === id);
    if (c) {
      setSelectedCampaign(c);
      setPopupDate(c.scheduledAt ? toDateInputValue(new Date(c.scheduledAt)) : "");
    }
  }, [items]);

  // ── Schedule/unschedule via API ──

  const patchCampaign = useCallback(async (cId: string, data: Record<string, unknown>) => {
    try {
      await fetch(`/api/campaigns/${cId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      router.refresh();
    } catch {
      router.refresh();
    }
  }, [router]);

  const handleDropOnDate = useCallback(async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDropOverDate(null);
    const cId = e.dataTransfer.getData("text/plain");
    if (!cId) return;
    setDraggingId(null);

    setItems((prev) =>
      prev.map((c) =>
        c.id === cId ? { ...c, scheduledAt: targetDate, status: "scheduled" as const } : c
      )
    );

    await patchCampaign(cId, { scheduledAt: targetDate.toISOString(), status: "scheduled" });
  }, [patchCampaign]);

  // Drop on unscheduled zone = remove schedule
  const handleDropOnUnscheduled = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDropOverUnscheduled(false);
    const cId = e.dataTransfer.getData("text/plain");
    if (!cId) return;
    setDraggingId(null);

    setItems((prev) =>
      prev.map((c) =>
        c.id === cId ? { ...c, scheduledAt: null, status: "draft" as const } : c
      )
    );

    await patchCampaign(cId, { scheduledAt: null, status: "draft" });
  }, [patchCampaign]);

  const handleDragOver = useCallback((e: React.DragEvent, dk: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropOverDate(dk);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropOverDate(null);
  }, []);

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  // ── Popup: save date change ──

  async function handlePopupSaveDate() {
    if (!selectedCampaign) return;
    setSaving(true);

    if (popupDate) {
      const newDate = new Date(popupDate + "T12:00:00");
      setItems((prev) =>
        prev.map((c) =>
          c.id === selectedCampaign.id ? { ...c, scheduledAt: newDate, status: "scheduled" as const } : c
        )
      );
      await patchCampaign(selectedCampaign.id, { scheduledAt: newDate.toISOString(), status: "scheduled" });
      setSelectedCampaign((prev) => prev ? { ...prev, scheduledAt: newDate, status: "scheduled" as const } : null);
    } else {
      setItems((prev) =>
        prev.map((c) =>
          c.id === selectedCampaign.id ? { ...c, scheduledAt: null, status: "draft" as const } : c
        )
      );
      await patchCampaign(selectedCampaign.id, { scheduledAt: null, status: "draft" });
      setSelectedCampaign((prev) => prev ? { ...prev, scheduledAt: null, status: "draft" as const } : null);
    }

    setSaving(false);
  }

  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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

      {/* ── Unscheduled pool (drag source + drop target to unschedule) ── */}
      <div
        className={cn(
          "rounded-lg border border-dashed p-3 transition-colors",
          dropOverUnscheduled
            ? "border-red-400 bg-red-50/50 ring-2 ring-red-200"
            : "border-border bg-secondary/30",
        )}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropOverUnscheduled(true); }}
        onDragLeave={() => setDropOverUnscheduled(false)}
        onDrop={handleDropOnUnscheduled}
      >
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          {dropOverUnscheduled
            ? "ปล่อยที่นี่เพื่อยกเลิก schedule"
            : `ยังไม่ได้ schedule (${unscheduled.length})  — ลากไปวางในปฏิทิน`
          }
        </p>
        {unscheduled.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((c) =>
              renderCard(c, true, draggingId, handleCardDragStart, handleCardDragEnd, handleCardClick)
            )}
          </div>
        ) : !dropOverUnscheduled ? (
          <p className="text-[10px] text-muted-foreground/50 italic">ทุก campaign มี schedule แล้ว</p>
        ) : null}
      </div>

      {/* ══ MONTH VIEW ══ */}
      {view === "month" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-2 border-r border-border last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {getMonthCalendarDays(currentDate).map((day, i) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, today);
              const dayCampaigns = getCampaignsForDay(day);
              const dk = dateKey(day);
              const isOver = dropOverDate === dk;

              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[100px] border-r border-b border-border last:border-r-0 p-1.5 transition-colors",
                    !isCurrentMonth && "bg-secondary/30",
                    isOver && "bg-primary/5 ring-2 ring-primary/20",
                  )}
                  onDragOver={(e) => handleDragOver(e, dk)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnDate(e, day)}
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
                        className="text-[10px] text-muted-foreground/0 hover:text-muted-foreground transition-colors"
                        title="สร้าง campaign วันนี้"
                      >
                        +
                      </Link>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayCampaigns.slice(0, 3).map((c) =>
                      renderCard(c, true, draggingId, handleCardDragStart, handleCardDragEnd, handleCardClick)
                    )}
                    {dayCampaigns.length > 3 && (
                      <p className="text-[9px] text-muted-foreground text-center">+{dayCampaigns.length - 3} more</p>
                    )}
                  </div>
                </div>
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
              const dk = dateKey(day);
              const isOver = dropOverDate === dk;

              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[300px] border-r border-border last:border-r-0 transition-colors",
                    isToday && "bg-primary/5",
                    isOver && "bg-primary/5 ring-2 ring-primary/20",
                  )}
                  onDragOver={(e) => handleDragOver(e, dk)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnDate(e, day)}
                >
                  <div className={cn(
                    "text-center py-3 border-b border-border",
                    isToday && "bg-foreground text-card",
                  )}>
                    <p className="text-[10px] font-medium">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][day.getDay()]}</p>
                    <p className={cn("text-lg font-semibold", isToday ? "text-card" : "text-foreground")}>{day.getDate()}</p>
                    <p className="text-[10px] opacity-60">{day.toLocaleDateString("th-TH", { month: "short" })}</p>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {dayCampaigns.map((c) =>
                      renderCard(c, false, draggingId, handleCardDragStart, handleCardDragEnd, handleCardClick)
                    )}
                    {dayCampaigns.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/40 text-center pt-4">ว่าง</p>
                    )}
                  </div>
                </div>
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
              {filtered.filter((c) => c.scheduledAt).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()).map((c) => (
                <div key={c.id} onClick={() => { setSelectedCampaign(c); setPopupDate(c.scheduledAt ? toDateInputValue(new Date(c.scheduledAt)) : ""); }}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-foreground/30 transition-colors cursor-pointer"
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
                </div>
              ))}

              {unscheduled.length > 0 && (
                <>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pt-3">ยังไม่ได้ schedule</p>
                  {unscheduled.map((c) => (
                    <div key={c.id} onClick={() => { setSelectedCampaign(c); setPopupDate(""); }}
                      className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-card px-4 py-3 hover:border-foreground/30 transition-colors cursor-pointer"
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
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ CAMPAIGN DETAIL POPUP ══ */}
      {selectedCampaign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedCampaign(null)}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className={cn("px-5 py-3 flex items-center justify-between", CHANNEL_BG[selectedCampaign.channel] ?? "bg-foreground")}>
              <div className="flex items-center gap-2">
                <span className="text-white text-xs font-mono font-bold">{CHANNEL_ICON[selectedCampaign.channel]}</span>
                <span className="text-white/80 text-[10px]">{selectedCampaign.channel}</span>
              </div>
              <button onClick={() => setSelectedCampaign(null)} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Topic */}
              <div>
                <h3 className="text-base font-semibold text-foreground">{selectedCampaign.topic}</h3>
                {selectedCampaign.brief && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{selectedCampaign.brief}</p>
                )}
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-secondary/50 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">Status</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[selectedCampaign.status ?? "draft"])} />
                    <span className="text-xs font-medium text-foreground">{STATUS_LABEL[selectedCampaign.status ?? "draft"] ?? selectedCampaign.status}</span>
                  </div>
                </div>
                <div className="rounded-md bg-secondary/50 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">Slides</p>
                  <p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.slideCount} slides</p>
                </div>
                {selectedCampaign.pillar && (
                  <div className="rounded-md bg-secondary/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase">Pillar</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.pillar}</p>
                  </div>
                )}
                {selectedCampaign.tone && (
                  <div className="rounded-md bg-secondary/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase">Tone</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.tone}</p>
                  </div>
                )}
                {selectedCampaign.goal && (
                  <div className="rounded-md bg-secondary/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase">Goal</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.goal}</p>
                  </div>
                )}
                {selectedCampaign.audience && (
                  <div className="rounded-md bg-secondary/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase">Audience</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{selectedCampaign.audience}</p>
                  </div>
                )}
              </div>

              {/* Date picker */}
              <div className="rounded-md border border-border p-3 space-y-2">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">Schedule วันที่</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={popupDate}
                    onChange={(e) => setPopupDate(e.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {popupDate && (
                    <button
                      onClick={() => setPopupDate("")}
                      className="rounded-md border border-border px-2 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                      title="ยกเลิก schedule"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
                {/* Show if date changed */}
                {(() => {
                  const origDate = selectedCampaign.scheduledAt ? toDateInputValue(new Date(selectedCampaign.scheduledAt)) : "";
                  const changed = popupDate !== origDate;
                  if (!changed) return null;
                  return (
                    <button
                      onClick={handlePopupSaveDate}
                      disabled={saving}
                      className="w-full rounded-md bg-foreground text-card py-2 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {saving ? "กำลังบันทึก..." : popupDate ? `ย้ายไป ${new Date(popupDate + "T12:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}` : "ยกเลิก schedule"}
                    </button>
                  );
                })()}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/campaigns/${selectedCampaign.id}`}
                  className="flex-1 text-center rounded-md border border-border py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  ดูรายละเอียดเต็ม
                </Link>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
