export default function PlannerLoading() {
  return (
    <div className="flex flex-col h-screen animate-pulse">
      <div className="border-b border-stone-200 p-4">
        <div className="flex gap-3">
          <div className="h-8 w-24 bg-stone-200 rounded" />
          <div className="h-8 w-24 bg-stone-100 rounded" />
          <div className="h-8 w-24 bg-stone-100 rounded" />
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="h-full bg-stone-50 rounded-lg border border-stone-200" />
      </div>
    </div>
  );
}
