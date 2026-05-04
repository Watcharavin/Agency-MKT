import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { eq } from "drizzle-orm";
import { OnboardingForm } from "@/components/shared/OnboardingForm";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.userId, userId))
    .limit(1);

  if (existing.length > 0) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-base font-bold text-white">
          F
        </div>
        <span className="text-base font-semibold text-white">Full Agency</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        {/* Intro text — above the form */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-white">ตั้งค่าแบรนด์ของคุณ</h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI จะใช้ข้อมูลนี้ทุกครั้งที่สร้าง Content — ทำแค่ครั้งเดียว
          </p>
        </div>

        <OnboardingForm />
      </div>

      <p className="mt-5 text-center text-xs text-zinc-700">
        แก้ไขได้ภายหลังใน Brand DNA Settings
      </p>
    </div>
  );
}
