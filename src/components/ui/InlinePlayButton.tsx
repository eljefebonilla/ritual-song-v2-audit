"use client";

import { useMedia } from "@/lib/media-context";

interface InlinePlayButtonProps {
  audioUrl?: string | null;
  audioType?: "audio" | "youtube" | null;
  title: string;
  subtitle?: string;
  songId?: string;
  recordedKey?: string;
  chartKeys?: string[];
  size?: "sm" | "md";
}

export default function InlinePlayButton({
  audioUrl,
  audioType,
  title,
  subtitle,
  songId,
  recordedKey,
  chartKeys,
  size = "md",
}: InlinePlayButtonProps) {
  const { play, stop, current } = useMedia();

  const hasAudio = !!(audioUrl && audioType);
  const isPlaying = hasAudio && current?.url === audioUrl;

  const dim = size === "sm" ? 20 : 24;
  const iconSize = size === "sm" ? 8 : 10;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hasAudio) return;
    if (isPlaying) {
      stop();
    } else {
      play({
        type: audioType!,
        url: audioUrl!,
        title,
        subtitle,
        songId,
        recordedKey,
        chartKeys,
      });
    }
  };

  if (isPlaying) {
    return (
      <button
        onClick={handleClick}
        className="shrink-0 flex items-center justify-center rounded-full transition-all active:scale-95"
        title="Stop"
        style={{
          width: dim,
          height: dim,
          background: "linear-gradient(145deg, #292524, #1c1917)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        }}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="3">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </button>
    );
  }

  if (hasAudio) {
    return (
      <button
        onClick={handleClick}
        className="shrink-0 flex items-center justify-center rounded-full transition-all active:scale-95"
        title="Play"
        style={{
          width: dim,
          height: dim,
          background: "#292524",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        }}
      >
        <svg
          width={iconSize + 2}
          height={iconSize + 2}
          viewBox="0 0 24 24"
          fill="white"
          stroke="white"
          strokeWidth="2.5"
          strokeLinejoin="round"
        >
          <polygon points="6,3 20,12 6,21" />
        </svg>
      </button>
    );
  }

  // No audio: grey button with strikethrough
  return (
    <span
      className="shrink-0 flex items-center justify-center rounded-full relative"
      title="No audio available"
      style={{
        width: dim,
        height: dim,
        background: "#d6d3d1",
      }}
    >
      <svg
        width={iconSize + 2}
        height={iconSize + 2}
        viewBox="0 0 24 24"
        fill="#a8a29e"
        stroke="#a8a29e"
        strokeWidth="2.5"
        strokeLinejoin="round"
      >
        <polygon points="6,3 20,12 6,21" />
      </svg>
      {/* Diagonal strikethrough */}
      <svg
        className="absolute inset-0"
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
      >
        <line
          x1={dim * 0.2}
          y1={dim * 0.8}
          x2={dim * 0.8}
          y2={dim * 0.2}
          stroke="#78716c"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
