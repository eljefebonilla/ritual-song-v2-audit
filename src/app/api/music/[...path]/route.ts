import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { join, extname } from "path";

const MUSIC_DIR = join(
  process.cwd(),
  "..",
  "Song Folders",
  "Music"
);

const PSALMS_DIR = join(process.cwd(), "..", "Organized Psalms");

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".txt": "text/plain",
  ".musx": "application/octet-stream",
  ".mxl": "application/vnd.recordare.musicxml",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const relativePath = pathSegments.join("/");

  // Security: prevent path traversal
  if (relativePath.includes("..") || relativePath.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Route _psalms/ paths to Organized Psalms directory
  let resolvedDir = MUSIC_DIR;
  let resolvedRelative = relativePath;
  if (relativePath.startsWith("_psalms/")) {
    resolvedDir = PSALMS_DIR;
    resolvedRelative = relativePath.slice("_psalms/".length);
  }

  const filePath = join(resolvedDir, decodeURIComponent(resolvedRelative));

  // Verify file is within the resolved directory
  if (!filePath.startsWith(resolvedDir)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 404 });
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // For audio files, support Range requests for streaming
    const rangeHeader = request.headers.get("range");
    if (rangeHeader && contentType.startsWith("audio/")) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const { readFileSync } = await import("fs");
      const buffer = Buffer.alloc(chunkSize);
      const fd = await import("fs").then((fs) => fs.openSync(filePath, "r"));
      await import("fs").then((fs) => fs.readSync(fd, buffer, 0, chunkSize, start));
      await import("fs").then((fs) => fs.closeSync(fd));

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
        },
      });
    }

    // Full file read
    const { readFileSync } = await import("fs");
    const fileBuffer = readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Content-Disposition": `inline; filename="${pathSegments[pathSegments.length - 1]}"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
