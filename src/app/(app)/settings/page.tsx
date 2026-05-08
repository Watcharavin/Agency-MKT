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
    tokenType: "Page Access Token",
    guide: [
      "1. ไปที่ Facebook Graph API Explorer",
      "2. เลือก App → Get Page Access Token",
      "3. เลือก Page ที่ต้องการ",
      "4. Copy token มาวางด้านล่าง",
    ],
    extraFields: [{ key: "platformAccountId", label: "Page ID", placeholder: "123456789..." }],
  },
  {
    id: "instagram" as const,
    label: "Instagram",
    color: "bg-pink-600",
    desc: "โพสต์ไป Instagram Business",
    tokenType: "Page Access Token (เดียวกับ Facebook)",
    guide: [
      "1. IG Business ต้องเชื่อมกับ Facebook Page",
      "2. ใช้ Page Access Token เดียวกับ Facebook",
      "3. ใส่ Instagram Business Account ID",
    ],
    extraFields: [{ key: "platformAccountId", label: "IG Business Account ID", placeholder: "17841400..." }],
  },
];

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({});
  const [extraInputs, setExtraInputs] = useState<Record<string, string>>({});
  const [nameInputs, setNameInputs] = useState<Record<string, string>>({});
  const [showGuide, setShowGuide] = useState<string | null>(null);

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

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

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
        platformAccountId: extraInputs[platformId] || null,
        platformAccountName: nameInputs[platformId] || PLATFORMS.find(p => p.id === platformId)?.label || platformId,
      }),
    });

    setTokenInputs(prev => ({ ...prev, [platformId]: "" }));
    setExtraInputs(prev => ({ ...prev, [platformId]: "" }));
    setNameInputs(prev => ({ ...prev, [platformId]: "" }));
    setShowGuide(null);
    setConnecting(null);
    fetchAccounts();
  }

  async function handleDisconnect(id: string) {
    await fetch(`/api/social-accounts?id=${id}`, { method: "DELETE" });
    fetchAccounts();
  }

  const getConnected = (platformId: string) =>
    accounts.find(a => a.platform === platformId && Number(a.isActive) === 1);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Settings</p>
        <h1 className="text-xl font-semibold text-foreground mt-0.5">Autopost Connections</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          เชื่อมต่อ Social Media เพื่อโพสต์อัตโนมัติเมื่อถึงเวลา Schedule
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-4">
          {PLATFORMS.map((platform) => {
            const connected = getConnected(platform.id);
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

                  {connected ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-500 font-medium">Connected</span>
                      <span className="text-xs text-muted-foreground">
                        {connected.platformAccountName}
                      </span>
                      <button
                        onClick={() => { setShowGuide(platform.id); }}
                        className="rounded px-2 py-1 text-xs border border-border text-foreground hover:bg-secondary transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDisconnect(connected.id)}
                        className="rounded px-2 py-1 text-xs border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowGuide(showGuide === platform.id ? null : platform.id)}
                      className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-card hover:opacity-80 transition-opacity"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* Connect / Edit form */}
                {showGuide === platform.id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
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

                    {platform.extraFields?.map(field => (
                      <div key={field.key}>
                        <label className="text-xs font-medium text-foreground">{field.label}</label>
                        <input
                          type="text"
                          value={extraInputs[platform.id] || ""}
                          onChange={e => setExtraInputs(prev => ({ ...prev, [platform.id]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                        />
                      </div>
                    ))}

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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* How it works */}
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
