export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-40 rounded-md bg-secondary" />
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2].map((i) => <div key={i} className="h-24 rounded-lg bg-secondary" />)}
      </div>
      <div className="h-5 w-32 rounded-md bg-secondary" />
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2].map((i) => <div key={i} className="h-28 rounded-lg bg-secondary" />)}
      </div>
    </div>
  );
}
