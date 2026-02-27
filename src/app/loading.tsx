export default function Loading() {
  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-3xl animate-pulse">
      <div className="h-7 w-40 bg-stone-200 rounded mb-2" />
      <div className="h-4 w-64 bg-stone-100 rounded mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <div className="border border-stone-200 rounded-lg p-5 h-28 bg-stone-50" />
        <div className="border border-stone-200 rounded-lg p-5 h-28 bg-stone-50" />
      </div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border border-stone-200 rounded-lg h-16 bg-stone-50" />
        ))}
      </div>
    </div>
  );
}
