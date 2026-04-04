"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface CoverArt {
  id: string;
  occasion_code: string;
  cycle: string;
  source: string;
  image_url: string | null;
  storage_path: string | null;
}

interface CoverArtPickerProps {
  occasionCode: string;
  cycle: string;
}

export default function CoverArtPicker({
  occasionCode,
  cycle,
}: CoverArtPickerProps) {
  const [covers, setCovers] = useState<CoverArt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/cover-art?occasionCode=${encodeURIComponent(occasionCode)}`)
      .then((r) => r.json())
      .then((data) => {
        setCovers(data.covers || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [occasionCode]);

  const currentCover = covers.find((c) => c.cycle === cycle || c.cycle === "all");

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        // Upload to Supabase storage via the songs resource upload pattern
        const formData = new FormData();
        formData.append("file", file);
        formData.append("occasionCode", occasionCode);
        formData.append("cycle", cycle);

        const uploadRes = await fetch("/api/cover-art/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          // Create cover art record
          await fetch("/api/cover-art", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              occasionCode,
              cycle,
              source: "uploaded",
              storagePath: data.storagePath,
              imageUrl: data.publicUrl,
            }),
          });

          // Refresh
          const refreshRes = await fetch(
            `/api/cover-art?occasionCode=${encodeURIComponent(occasionCode)}`
          );
          const refreshData = await refreshRes.json();
          setCovers(refreshData.covers || []);
        }
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [occasionCode, cycle]
  );

  const handleSetGradient = useCallback(async () => {
    await fetch("/api/cover-art", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occasionCode,
        cycle,
        source: "gradient",
      }),
    });

    const res = await fetch(
      `/api/cover-art?occasionCode=${encodeURIComponent(occasionCode)}`
    );
    const data = await res.json();
    setCovers(data.covers || []);
  }, [occasionCode, cycle]);

  const handleRemove = useCallback(
    async (id: string) => {
      await fetch(`/api/cover-art?id=${id}`, { method: "DELETE" });
      setCovers((prev) => prev.filter((c) => c.id !== id));
    },
    []
  );

  if (loading) {
    return <div className="text-xs text-stone-400">Loading cover art...</div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-stone-700">Cover Art</h3>

      {currentCover ? (
        <div className="flex items-center gap-3">
          {currentCover.image_url ? (
            <img
              src={currentCover.image_url}
              alt="Cover"
              className="w-20 h-28 object-cover rounded border border-stone-200"
            />
          ) : (
            <div className="w-20 h-28 rounded border border-stone-200 bg-gradient-to-br from-stone-300 to-stone-500 flex items-center justify-center text-white text-xs">
              Gradient
            </div>
          )}
          <div className="space-y-1">
            <div className="text-xs text-stone-500">
              Source: {currentCover.source} &bull; Cycle: {currentCover.cycle}
            </div>
            <button
              onClick={() => handleRemove(currentCover.id)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-stone-400">No cover art set for this occasion.</div>
      )}

      <div className="flex gap-2">
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleUpload}
            className="hidden"
          />
          <span className="inline-block text-xs px-3 py-1.5 border border-stone-300 text-stone-600 rounded-md hover:bg-stone-50">
            {uploading ? "Uploading..." : "Upload Image"}
          </span>
        </label>
        <button
          onClick={handleSetGradient}
          className="text-xs px-3 py-1.5 border border-stone-300 text-stone-600 rounded-md hover:bg-stone-50"
        >
          Use Gradient
        </button>
      </div>
    </div>
  );
}
