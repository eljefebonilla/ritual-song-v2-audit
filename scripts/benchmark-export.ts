/**
 * Benchmark: Full PDF export pipeline (Puppeteer + imposition)
 * Run: npx tsx scripts/benchmark-export.ts
 */

import { migrateV1ToV2 } from "../src/utils/migrateV1ToV2";
import { elementToHTML } from "../src/utils/elementToCSS";
import { SEASON_COLORS } from "../src/core/design-system/tokens/colors";
import { generateImposedPDF } from "../src/imposition/impose";
import puppeteer from "puppeteer-core";
import type { WorshipAidPage } from "../src/lib/worship-aid/types";

async function main() {
  // Build a realistic 16-page v2 doc (cover + 13 songs + reading + giving)
  const v1Pages: WorshipAidPage[] = [];
  v1Pages.push({
    id: "c", type: "cover", title: "Palm Sunday", position: "",
    coverData: { parishName: "St. Monica Catholic Church", occasionName: "Palm Sunday of the Passion of the Lord", date: "April 13, 2026", seasonColor: "#C62D25" },
    content: "", removed: false,
  } as WorshipAidPage);

  for (let i = 0; i < 13; i++) {
    v1Pages.push({
      id: "s" + i, type: "song", title: "Song " + i, position: "Gathering",
      songData: { title: "All Are Welcome " + i, composer: "Marty Haugen", reprintUrl: "", lyrics: "Let us build a house where love can dwell\nAnd all can safely live,\nA place where saints and children tell\nHow hearts learn to forgive.", positionLabel: ["Gathering", "Communion", "Sending"][i % 3] },
      content: "", removed: false,
    } as WorshipAidPage);
  }

  v1Pages.push({
    id: "r", type: "reading", title: "Readings", position: "",
    readingData: { readings: [
      { type: "First Reading", citation: "Isaiah 50:4-7", summary: "The Lord God sustains me" },
      { type: "Responsorial Psalm", citation: "Psalm 22:8-9, 17-20, 23-24", summary: "My God, my God, why have you abandoned me?" },
      { type: "Second Reading", citation: "Philippians 2:6-11", summary: "He emptied himself, taking the form of a slave" },
      { type: "Gospel", citation: "Luke 22:14-23:56", summary: "The Passion of our Lord Jesus Christ" },
    ] },
    content: "", removed: false,
  } as WorshipAidPage);

  v1Pages.push({
    id: "g", type: "giving", title: "Give", position: "", content: "", removed: false,
  } as WorshipAidPage);

  // Migrate to v2
  const doc = migrateV1ToV2(v1Pages, { occasionId: "palm-sunday-c", ensembleId: "generations", season: "lent" });
  console.log(`Document: ${doc.pages.length} pages, ${doc.pages.reduce((s, p) => s + p.elements.length, 0)} total elements`);

  // Generate HTML for each page
  function themeCss(season: string): string {
    const c = SEASON_COLORS[season] ?? SEASON_COLORS["ordinary-time"];
    return `:root { --wa-primary: ${c.primary}; --wa-secondary: ${c.secondary}; --wa-text-accent: ${c.text}; }`;
  }

  function pageToHtml(page: typeof doc.pages[0], season: string): string {
    const elements = page.elements.filter(el => el.visible).sort((a, b) => a.zIndex - b.zIndex).map(elementToHTML).join("\n");
    return `<!DOCTYPE html><html><head><style>
${themeCss(season)}
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600&display=swap');
body { width: ${page.pageSize.width}mm; height: ${page.pageSize.height}mm; position: relative; overflow: hidden; background: white; font-family: 'Crimson Pro', Georgia, serif; }
div, img { break-inside: avoid; }
</style></head><body>${elements}</body></html>`;
  }

  // Launch Chrome
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  console.log("\n=== Rendering pages to PDF (reuse single tab) ===");
  const renderStart = performance.now();
  const pagePdfs: Uint8Array[] = [];
  const tab = await browser.newPage();

  for (let i = 0; i < doc.pages.length; i++) {
    const pageStart = performance.now();
    const html = pageToHtml(doc.pages[i], doc.globalStyles.season);
    await tab.setContent(html, { waitUntil: ["load"] });
    const pdf = await tab.pdf({
      printBackground: true,
      width: `${doc.pages[i].pageSize.width}mm`,
      height: `${doc.pages[i].pageSize.height}mm`,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    pagePdfs.push(new Uint8Array(pdf));
    const pageTime = performance.now() - pageStart;
    process.stdout.write(`  Page ${i + 1}/${doc.pages.length}: ${pageTime.toFixed(0)}ms\n`);
  }
  await tab.close();

  const renderTime = performance.now() - renderStart;
  console.log(`\nPuppeteer render total: ${(renderTime / 1000).toFixed(2)}s`);

  // Flat PDF merge
  console.log("\n=== Flat PDF merge ===");
  const flatStart = performance.now();
  const { PDFDocument } = await import("pdf-lib");
  const outDoc = await PDFDocument.create();
  for (const buf of pagePdfs) {
    const srcDoc = await PDFDocument.load(buf);
    const [copied] = await outDoc.copyPages(srcDoc, [0]);
    outDoc.addPage(copied);
  }
  const flatPdf = await outDoc.save();
  const flatTime = performance.now() - flatStart;
  console.log(`Flat merge: ${(flatTime / 1000).toFixed(2)}s (${(flatPdf.length / 1024).toFixed(0)} KB)`);

  // Imposed PDF (saddle-stitch)
  console.log("\n=== Saddle-stitch imposition ===");
  const impStart = performance.now();
  const imposed = await generateImposedPDF(pagePdfs, "HALF_LETTER_SADDLE_STITCH", {
    marks: { enabled: true, drawPanelCropMarks: true, drawFoldMarks: true, drawRegistration: true },
    creep: { enabled: true, paperThicknessIn: 0.004 },
  });
  const impTime = performance.now() - impStart;
  console.log(`Imposition: ${(impTime / 1000).toFixed(2)}s (${(imposed.length / 1024).toFixed(0)} KB)`);

  await browser.close();

  // Summary
  const totalFlat = renderTime + flatTime;
  const totalImposed = renderTime + impTime;
  console.log("\n=== SUMMARY ===");
  console.log(`Pages: ${doc.pages.length}`);
  console.log(`Render: ${(renderTime / 1000).toFixed(2)}s`);
  console.log(`Flat export total: ${(totalFlat / 1000).toFixed(2)}s`);
  console.log(`Imposed export total: ${(totalImposed / 1000).toFixed(2)}s`);
  console.log(`\nPDF export <10s for ${doc.pages.length} pages: ${totalImposed < 10000 ? "PASS" : "FAIL"} (${(totalImposed / 1000).toFixed(2)}s)`);
  console.log(`Imposition adds <2s: ${impTime < 2000 ? "PASS" : "FAIL"} (${(impTime / 1000).toFixed(2)}s)`);
}

main().catch(console.error);
