import { PDFDocument, degrees } from "pdf-lib";
import type { FoldFormat, ImpositionOptions, SheetPlan, Placement } from "./types";
import { buildSheetPlans } from "./pageOrdering";
import { applySaddleStitchCreep } from "./creep";
import { drawMarksForSheetSide } from "./marks";

function ensureRotation(r: number): asserts r is 0 | 90 | 180 | 270 {
  if (r !== 0 && r !== 90 && r !== 180 && r !== 270) {
    throw new Error(`Unsupported rotation: ${r}`);
  }
}

function computeDrawArgs(params: {
  placement: Placement;
  srcWidth: number;
  srcHeight: number;
}): { x: number; y: number; xScale: number; yScale: number; rotate?: ReturnType<typeof degrees> } {
  const { placement, srcWidth, srcHeight } = params;
  ensureRotation(placement.rotation);
  const rot = placement.rotation;

  if (rot === 0) {
    return { x: placement.x, y: placement.y, xScale: placement.width / srcWidth, yScale: placement.height / srcHeight };
  }
  if (rot === 180) {
    return { x: placement.x + placement.width, y: placement.y + placement.height, xScale: placement.width / srcWidth, yScale: placement.height / srcHeight, rotate: degrees(180) };
  }
  if (rot === 90) {
    return { x: placement.x + placement.width, y: placement.y, xScale: placement.width / srcHeight, yScale: placement.height / srcWidth, rotate: degrees(90) };
  }
  // 270
  return { x: placement.x, y: placement.y + placement.height, xScale: placement.width / srcHeight, yScale: placement.height / srcWidth, rotate: degrees(270) };
}

async function loadSinglePage(docBytes: Uint8Array, strict: boolean) {
  const doc = await PDFDocument.load(docBytes);
  const pages = doc.getPages();
  if (pages.length !== 1 && strict) {
    throw new Error(`Expected single-page PDF, got ${pages.length}`);
  }
  const { width, height } = pages[0].getSize();
  return { doc, width, height };
}

function maybeRotateBackside(plan: SheetPlan, rotate: boolean): SheetPlan {
  if (!rotate) return plan;

  const rot = (p: Placement): Placement => ({
    ...p,
    x: plan.sheetWidth - (p.x + p.width),
    y: plan.sheetHeight - (p.y + p.height),
    rotation: (((p.rotation ?? 0) + 180) % 360) as 0 | 90 | 180 | 270,
  });

  return {
    ...plan,
    back: { ...plan.back, placements: plan.back.placements.map(rot), foldX: undefined, foldY: undefined },
  };
}

/**
 * Main entry point: imposes single-page PDFs into print-ready sheets.
 */
export async function generateImposedPDF(
  pages: Uint8Array[],
  format: FoldFormat,
  options: ImpositionOptions = {},
): Promise<Uint8Array> {
  const strict = options.strictSinglePageInput ?? true;

  let plans = buildSheetPlans(format, pages.length);

  // Creep compensation (saddle-stitch only)
  const creepEnabled = options.creep?.enabled ?? (format === "HALF_LETTER_SADDLE_STITCH");
  if (creepEnabled && format === "HALF_LETTER_SADDLE_STITCH") {
    plans = applySaddleStitchCreep(plans, {
      paperThicknessIn: options.creep?.paperThicknessIn ?? 0.004,
      multiplier: options.creep?.multiplier ?? 1.0,
    });
  }

  // Duplex backside rotation
  const rotateBack = options.duplex?.rotateBackside180 ?? false;
  plans = plans.map((p) => maybeRotateBackside(p, rotateBack));

  // Source page cache
  const cache = new Map<number, { srcDoc: PDFDocument; srcWidth: number; srcHeight: number }>();

  async function getSource(pageNum: number) {
    const cached = cache.get(pageNum);
    if (cached) return cached;
    const buf = pages[pageNum - 1];
    if (!buf) throw new Error(`Missing buffer for page ${pageNum}`);
    const loaded = await loadSinglePage(buf, strict);
    const entry = { srcDoc: loaded.doc, srcWidth: loaded.width, srcHeight: loaded.height };
    cache.set(pageNum, entry);
    return entry;
  }

  const outDoc = await PDFDocument.create();

  for (const sheet of plans) {
    for (const sidePlan of [sheet.front, sheet.back] as const) {
      const outPage = outDoc.addPage([sheet.sheetWidth, sheet.sheetHeight]);

      for (const pl of sidePlan.placements) {
        if (pl.pageNumber == null) continue;

        const src = await getSource(pl.pageNumber);
        const [embedded] = await outDoc.embedPdf(await src.srcDoc.save(), [0]);

        const args = computeDrawArgs({ placement: pl, srcWidth: src.srcWidth, srcHeight: src.srcHeight });
        outPage.drawPage(embedded, { x: args.x, y: args.y, xScale: args.xScale, yScale: args.yScale, rotate: args.rotate });
      }

      if (options.marks?.enabled ?? true) {
        drawMarksForSheetSide({
          page: outPage,
          sheetWidth: sheet.sheetWidth,
          sheetHeight: sheet.sheetHeight,
          sidePlan,
          placements: sidePlan.placements,
          options: options.marks,
        });
      }
    }
  }

  return await outDoc.save();
}
