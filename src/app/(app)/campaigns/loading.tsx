export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 rounded bg-secondary" />
        <div className="h-9 w-28 rounded-md bg-secondary" />
      </div>
      {[0,1,2,3].map((i) => <div key={i} className="h-20 rounded-lg bg-secondary" />)}
    </div>
  );
}
