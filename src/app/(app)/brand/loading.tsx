export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-secondary" />
          <div className="h-6 w-32 rounded bg-secondary" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded-md bg-secondary" />
          <div className="h-9 w-28 rounded-md bg-secondary" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[0,1,2,3].map((i) => <div key={i} className="h-64 rounded-lg bg-secondary" />)}
      </div>
    </div>
  );
}
