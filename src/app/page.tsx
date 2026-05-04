import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-xl font-bold text-card">
              F
            </div>
          </div>
          <div className="space-y-1">
            <div className="inline-block rounded-full border border-border px-3 py-1 text-xs font-mono text-muted-foreground">
              AI Marketing Workspace
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Full Agency</h1>
            <p className="text-muted-foreground text-base">
              สร้าง Content ขาย สำหรับทุก Platform
              <br />
              ด้วย AI ที่รู้จักแบรนด์ของคุณ
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/sign-up"
            className="w-full rounded-lg bg-foreground px-6 py-3 text-sm font-semibold text-card hover:opacity-90 transition-opacity"
          >
            เริ่มต้นใช้งาน — ฟรี
          </Link>
          <Link
            href="/sign-in"
            className="w-full rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            เข้าสู่ระบบ
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2 text-xs text-muted-foreground border-t border-border">
          {[
            { icon: "◈", label: "Brand DNA" },
            { icon: "✦", label: "AI Image Gen" },
            { icon: "◧", label: "Content Plan" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1.5 pt-4">
              <span className="text-xl text-foreground">{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
