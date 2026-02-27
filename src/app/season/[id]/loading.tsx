export default function SeasonLoading() {
  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-4xl animate-pulse">
      <div className="h-3 w-32 bg-stone-100 rounded mb-4" />
      <div className="w-12 h-1 bg-stone-200 rounded-full mb-3" />
      <div className="h-7 w-48 bg-stone-200 rounded mb-2" />
      <div className="h-4 w-24 bg-stone-100 rounded mb-8" />
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border border-stone-200 rounded-lg p-3 h-14 bg-stone-50" />
        ))}
      </div>
    </div>
  );
}
