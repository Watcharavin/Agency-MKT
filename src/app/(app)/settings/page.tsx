"use client";

import { useEffect, useState, useCallback } from "react";

type Account = {
  id: string;
  platform: string;
  platformAccountId: string | null;
  platformAccountName: string | null;
  isActive: number | null;
  createdAt: string | null;
};

type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; name: string; username: string };
};

const META_PLATFORMS = new Set(["facebook", "instagram"]);

const PLATFORMS = [
  {
    id: "line" as const,
    label: "LINE OA",
    color: "bg-green-600",
    desc: "Broadcast ไปหาผู้ติดตามทั้งหมด",
    tokenType: "Channel Access Token",
    guide: [
      "1. ไปที่ LINE Developers Console",
      "2. เลือก Provider → Channel (Messaging API)",
      "3. กด Issue ที่ Channel access token (long-lived)",
      "4. Copy token มาวางด้านล่าง",
    ],
  },
  {
    id: "facebook" as const,
    label: "Facebook Page",
    color: "bg-blue-600",
    desc: "โพสต์ไปหน้า Facebook Page",
    tokenType: null,
    guide: [],
  },
  {
    id: "instagram" as const,
    label: "Instagram",
    color: "bg-pink-600",
    desc: "โพสต์ไป Instagram Business",
    tokenType: null,
    guide: [],
  },
];

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({});
  const [nameInputs, setNameInputs] = useState<Record<string, string>>({});
  const [showGuide, setShowGuide] = useState<string | null>(null);
  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [defaultPostTime, setDefaultPostTime] = useState("09:00");
  const [savingTime, setSavingTime] = useState(false);
  const [timeSaved, setTimeSaved] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/social-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch {
      // DB table may not exist yet — show empty state
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/brand")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.defaultPostTime) setDefaultPostTime(data.defaultPostTime); })
      .catch(() => {});

    fetchAccounts();

    const params = new URLSearchParams(window.location.search);

    if (params.get("meta_pages") === "1") {
      fetch("/api/auth/meta/pages")
        .then(r => r.json())
        .then(data => {
          setMetaPages(data.pages || []);
          // Auto-open first relevant card
          if ((data.pages || []).length > 0) setShowGuide("facebook");
        });
      window.history.replaceState({}, "", "/settings");
    }

    if (params.get("meta_error")) {
      setMetaError(params.get("meta_error"));
      window.history.replaceState({}, "", "/settings");
    }
  }, [fetchAccounts]);

  async function handleConnect(platformId: string) {
    const token = tokenInputs[platformId]?.trim();
    if (!token) return;

    setConnecting(platformId);
    await fetch("/api/social-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: platformId,
        accessToken: token,
        platformAccountId: null,
        platformAccountName: nameInputs[platformId] || PLATFORMS.find(p => p.id === platformId)?.label || platformId,
      }),
    });

    setTokenInputs(prev => ({ ...prev, [platformId]: "" }));
    setNameInputs(prev => ({ ...prev, [platformId]: "" }));
    setShowGuide(null);
    setConnecting(null);
    fetchAccounts();
  }

  async function connectMetaPage(page: MetaPage) {
    setConnecting("facebook");
    await fetch("/api/social-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "facebook",
        accessToken: page.access_token,
        platformAccountId: page.id,
        platformAccountName: page.name,
      }),
    });
    setConnecting(null);
    setShowGuide(null);
    fetchAccounts();
  }

  async function connectMetaIG(page: MetaPage) {
    if (!page.instagram_business_account) return;
    const ig = page.instagram_business_account;
    setConnecting("instagram");
    await fetch("/api/social-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "instagram",
        accessToken: page.access_token,
        platformAccountId: ig.id,
        platformAccountName: ig.name || `@${ig.username}`,
      }),
    });
    setConnecting(null);
    setShowGuide(null);
    fetchAccounts();
  }

  async function handleSavePostTime() {
    setSavingTime(true);
    await fetch("/api/brand/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultPostTime }),
    });
    setSavingTime(false);
    setTimeSaved(true);
    setTimeout(() => setTimeSaved(false), 2000);
  }

  async function handleDisconnect(id: string) {
    await fetch(`/api/social-accounts?id=${id}`, { method: "DELETE" });
    fetchAccounts();
  }

  const getConnected = (platformId: string) =>
    accounts.filter(a => a.platform === platformId && Number(a.isActive) === 1);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Settings</p>
        <h1 className="text-xl font-semibold text-foreground mt-0.5">Autopost Connections</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          เชื่อมต่อ Social Media เพื่อโพสต์อัตโนมัติเมื่อถึงเวลา Schedule
        </p>
      </div>

      {metaError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          เชื่อมต่อ Meta ไม่สำเร็จ ({metaError}) — กรุณาลองใหม่อีกครั้ง
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-4">
          {PLATFORMS.map((platform) => {
            const connectedList = getConnected(platform.id);
            const isMeta = META_PLATFORMS.has(platform.id);

            return (
              <div key={platform.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-md ${platform.color} flex items-center justify-center text-white text-xs font-bold`}>
                      {platform.label[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{platform.label}</p>
                      <p className="text-xs text-muted-foreground">{platform.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGuide(showGuide === platform.id ? null : platform.id)}
                    className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-card hover:opacity-80 transition-opacity"
                  >
                    {connectedList.length > 0 ? "+ Add" : "Connect"}
                  </button>
                </div>

                {/* Connected accounts list */}
                {connectedList.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {connectedList.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          <span className="text-xs text-foreground">{acc.platformAccountName}</span>
                        </div>
                        <button
                          onClick={() => handleDisconnect(acc.id)}
                          className="text-xs text-red-500 hover:text-red-400 transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showGuide === platform.id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    {isMeta ? (
                      metaPages.length > 0 ? (
                        // Page / IG selector after OAuth
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-foreground">
                            {platform.id === "facebook" ? "เลือก Facebook Page:" : "เลือก Instagram Business Account:"}
                          </p>
                          {platform.id === "facebook" ? (
                            metaPages.map(page => (
                              <button
                                key={page.id}
                                onClick={() => connectMetaPage(page)}
                                disabled={connecting === "facebook"}
                                className="w-full text-left rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                              >
                                <span className="font-medium">{page.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">ID: {page.id}</span>
                              </button>
                            ))
                          ) : (
                            metaPages.some(p => p.instagram_business_account) ? (
                              metaPages
                                .filter(p => p.instagram_business_account)
                                .map(page => (
                                  <button
                                    key={page.instagram_business_account!.id}
                                    onClick={() => connectMetaIG(page)}
                                    disabled={connecting === "instagram"}
                                    className="w-full text-left rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                                  >
                                    <span className="font-medium">
                                      {page.instagram_business_account!.name || `@${page.instagram_business_account!.username}`}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-2">via {page.name}</span>
                                  </button>
                                ))
                            ) : (
                              <div className="rounded-md bg-secondary/50 p-3 space-y-1">
                                <p className="text-xs text-muted-foreground">ไม่พบ Instagram Business Account ที่เชื่อมกับ Facebook Page ของคุณ</p>
                                <p className="text-xs text-muted-foreground">กรุณาเชื่อม IG Business กับ FB Page ใน Meta Business Suite ก่อน แล้วลองใหม่</p>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        // OAuth entry point
                        <div className="space-y-3">
                          <div className="rounded-md bg-secondary/50 p-3 space-y-1">
                            <p className="text-xs font-medium text-foreground">วิธีเชื่อมต่อผ่าน Meta Business Portfolio:</p>
                            <p className="text-xs text-muted-foreground">1. กด "Connect with Facebook" ด้านล่าง</p>
                            <p className="text-xs text-muted-foreground">2. เลือกอนุมัติ Permission ที่ขอ (Pages, Instagram)</p>
                            <p className="text-xs text-muted-foreground">3. เลือก Page หรือ IG Account ที่ต้องการเชื่อมต่อ</p>
                            <p className="text-xs text-yellow-500 mt-1">* Facebook และ Instagram ใช้การเชื่อมต่อเดียวกัน — เชื่อม Facebook ก่อน แล้วเชื่อม Instagram ตามได้เลย</p>
                          </div>
                          <a
                            href="/api/auth/meta"
                            className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                          >
                            Connect with Facebook
                          </a>
                        </div>
                      )
                    ) : (
                      // Token-based flow (LINE)
                      <>
                        <div className="rounded-md bg-secondary/50 p-3">
                          <p className="text-xs font-medium text-foreground mb-1">วิธีหา Token:</p>
                          {platform.guide.map((step, i) => (
                            <p key={i} className="text-xs text-muted-foreground">{step}</p>
                          ))}
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground">{platform.tokenType}</label>
                          <input
                            type="password"
                            value={tokenInputs[platform.id] || ""}
                            onChange={e => setTokenInputs(prev => ({ ...prev, [platform.id]: e.target.value }))}
                            placeholder="Paste token here..."
                            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground">ชื่อบัญชี (optional)</label>
                          <input
                            type="text"
                            value={nameInputs[platform.id] || ""}
                            onChange={e => setNameInputs(prev => ({ ...prev, [platform.id]: e.target.value }))}
                            placeholder="ร้าน ABC, @mybrand..."
                            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                          />
                        </div>

                        <button
                          onClick={() => handleConnect(platform.id)}
                          disabled={!tokenInputs[platform.id]?.trim() || connecting === platform.id}
                          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity disabled:opacity-40"
                        >
                          {connecting === platform.id ? "Connecting..." : "Save Connection"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Default Post Time */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">เวลาโพสต์อัตโนมัติ</p>
          <p className="text-xs text-muted-foreground mt-0.5">ระบบจะโพสต์ตามเวลานี้เมื่อถึงวัน Schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={defaultPostTime}
            onChange={e => setDefaultPostTime(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          <button
            onClick={handleSavePostTime}
            disabled={savingTime}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {timeSaved ? "บันทึกแล้ว ✓" : savingTime ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground mb-2">Autopost ทำงานอย่างไร?</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>1. สร้าง Campaign และ Generate content</p>
          <p>2. Schedule วัน-เวลาที่ต้องการโพสต์ใน Content Calendar</p>
          <p>3. เมื่อถึงเวลา ระบบจะโพสต์ไปยัง Platform ที่เชื่อมต่อไว้อัตโนมัติ</p>
          <p>4. ดูผลการโพสต์ได้ที่หน้า Campaign Detail</p>
        </div>
      </div>
    </div>
  );
}
