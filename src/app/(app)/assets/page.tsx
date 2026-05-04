export default function AssetsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Assets</h1>
        <p className="text-zinc-400 text-sm mt-1">รูปภาพทั้งหมดที่ AI สร้างให้</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
        <div className="text-4xl mb-3">⊡</div>
        <p className="text-zinc-400 text-sm">ยังไม่มี asset</p>
        <p className="text-zinc-600 text-xs mt-1">
          รูปที่ AI สร้างจากทุก campaign จะแสดงที่นี่
        </p>
      </div>
    </div>
  );
}
