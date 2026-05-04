"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteVoucherButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/vouchers/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex gap-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 rounded-md bg-red-600 py-1.5 text-center text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {deleting ? "…" : "ยืนยัน"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-md border border-border py-1.5 text-center text-xs text-foreground hover:bg-secondary transition-colors"
        >
          ยกเลิก
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full rounded-md border border-border py-1.5 text-center text-xs text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
    >
      ลบ
    </button>
  );
}
