export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-secondary" />
          <div className="h-6 w-24 rounded bg-secondary" />
        </div>
        <div className="h-9 w-24 rounded-md bg-secondary" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2,3,4,5].map((i) => <div key={i} className="h-48 rounded-lg bg-secondary" />)}
      </div>
    </div>
  );
}
