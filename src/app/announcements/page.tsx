export default function AnnouncementsPage() {
  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Announcements</h1>
      <p className="text-sm text-stone-500 mb-8">
        Weekly announcements and updates for the music ministry.
      </p>

      <div className="border border-dashed border-stone-300 rounded-lg p-8 text-center">
        <p className="text-stone-400 text-sm">
          No announcements yet. Check back soon.
        </p>
      </div>
    </div>
  );
}
