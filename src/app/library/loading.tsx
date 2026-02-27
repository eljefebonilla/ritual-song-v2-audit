export default function LibraryLoading() {
  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 animate-pulse">
      <div className="h-7 w-36 bg-stone-200 rounded mb-2" />
      <div className="h-4 w-48 bg-stone-100 rounded mb-6" />
      <div className="h-10 w-full bg-stone-100 rounded mb-4" />
      <div className="space-y-2">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="border border-stone-200 rounded-lg p-3 h-14 bg-stone-50" />
        ))}
      </div>
    </div>
  );
}
