import { readFileSync } from "fs";
import { join } from "path";
import type { BrandConfig, FontAsset } from "./types";
import { buildFontFaceCss } from "./pdf-renderer";

const TEMPLATES_DIR = join(process.cwd(), "src", "templates");

/**
 * Load an HTML template file from src/templates/.
 */
export function loadTemplate(
  category: "setlist" | "worship-aid" | "mobile",
  name: string
): string {
  const filePath = join(TEMPLATES_DIR, category, name);
  return readFileSync(filePath, "utf-8");
}

/**
 * Load the base CSS for a template category.
 */
export function loadBaseCss(
  category: "setlist" | "worship-aid" | "mobile"
): string {
  const filePath = join(TEMPLATES_DIR, category, "base.css");
  return readFileSync(filePath, "utf-8");
}

/**
 * Inject brand config as CSS custom properties into an HTML template.
 * Replaces the {{BRAND_CSS}} placeholder with a <style> block.
 */
export function injectBrandCss(
  html: string,
  brand: BrandConfig,
  fonts: FontAsset[] = []
): string {
  const fontFaceCss = fonts.length > 0 ? buildFontFaceCss(fonts) : "";

  const cssVars = `
${fontFaceCss}

:root {
  --brand-primary: ${brand.primaryColor};
  --brand-secondary: ${brand.secondaryColor};
  --brand-accent: ${brand.accentColor};
  --brand-heading-font: "${brand.headingFont}", serif;
  --brand-body-font: "${brand.bodyFont}", sans-serif;
  --brand-logo-url: url("${brand.logoUrl ?? ""}");
  --brand-parish-name: "${brand.parishDisplayName}";
}`;

  const styleBlock = `<style>${cssVars}</style>`;

  if (html.includes("{{BRAND_CSS}}")) {
    return html.replace("{{BRAND_CSS}}", styleBlock);
  }

  // Inject before </head> if no placeholder
  return html.replace("</head>", `${styleBlock}\n</head>`);
}

/**
 * Inject data variables into an HTML template.
 * Replaces {{VAR_NAME}} placeholders with values from the data object.
 */
export function injectData(
  html: string,
  data: Record<string, string>
): string {
  let result = html;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    result = result.replaceAll(placeholder, escapeHtml(value));
  }
  return result;
}

/**
 * Apply a layout preset class to the root <html> or <body> element.
 */
export function applyLayoutPreset(
  html: string,
  preset: BrandConfig["layoutPreset"]
): string {
  const presetClass = `preset-${preset}`;

  // Add to <body> class
  if (html.includes('class="')) {
    return html.replace(
      /<body([^>]*?)class="([^"]*?)"/,
      `<body$1class="$2 ${presetClass}"`
    );
  }

  return html.replace("<body", `<body class="${presetClass}"`);
}

/**
 * Build a complete HTML document ready for Puppeteer rendering.
 * Combines template + base CSS + brand CSS + data injection + layout preset.
 */
export function buildHtml(params: {
  category: "setlist" | "worship-aid" | "mobile";
  templateName: string;
  brand: BrandConfig;
  fonts?: FontAsset[];
  data: Record<string, string>;
}): string {
  let html = loadTemplate(params.category, params.templateName);
  const baseCss = loadBaseCss(params.category);

  // Inject base CSS
  if (html.includes("{{BASE_CSS}}")) {
    html = html.replace("{{BASE_CSS}}", `<style>${baseCss}</style>`);
  } else {
    html = html.replace("</head>", `<style>${baseCss}</style>\n</head>`);
  }

  // Inject brand CSS + fonts
  html = injectBrandCss(html, params.brand, params.fonts);

  // Apply layout preset
  html = applyLayoutPreset(html, params.brand.layoutPreset);

  // Inject data variables
  html = injectData(html, params.data);

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
