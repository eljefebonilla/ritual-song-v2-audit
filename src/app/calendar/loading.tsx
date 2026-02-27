export default function CalendarLoading() {
  return (
    <div className="flex flex-col h-screen animate-pulse">
      <div className="border-b border-stone-200 p-4">
        <div className="h-6 w-32 bg-stone-200 rounded mb-3" />
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-stone-100 rounded" />
          <div className="h-8 w-20 bg-stone-100 rounded" />
          <div className="h-8 w-20 bg-stone-100 rounded" />
        </div>
      </div>
      <div className="flex-1 p-4 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border border-stone-200 rounded-lg p-4 h-32 bg-stone-50" />
        ))}
      </div>
    </div>
  );
}
