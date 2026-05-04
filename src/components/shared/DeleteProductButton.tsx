"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteProductButton({ productId }: { productId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    if (res.ok) {
      window.location.reload();
    } else {
      setLoading(false);
      setConfirm(false);
      alert("ลบไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  if (confirm) {
    return (
      <div className="flex gap-1">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex-1 rounded bg-red-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "ลบ"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="flex-1 rounded bg-secondary px-2 py-1 text-[10px] font-medium text-foreground hover:bg-border transition-colors"
        >
          ยกเลิก
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); setConfirm(true); }}
      className="w-full rounded bg-secondary px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
    >
      ลบ
    </button>
  );
}
