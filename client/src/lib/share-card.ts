// ── Share-card rendering & clipboard utils (DOM-coupled, no JSX) ──
import type { ShareStory } from "./climate-types";

export function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapText(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[,.!?;:]?$/, "")}...`;
  }
  return lines;
}

export function svgTextLines(lines: string[], x: number, y: number, size: number, fill: string, weight = 700, lineHeight = Math.round(size * 1.22)): string {
  return lines.map((line, index) =>
    `<text x="${x}" y="${y + index * lineHeight}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeSvgText(line)}</text>`,
  ).join("");
}

export function buildShareImageSvg(story: ShareStory, shareUrl: string): string {
  const headline = wrapText(story.headline, 38, 3);
  const metric = wrapText(story.metricLine, 76, 2);
  const driver = wrapText(story.driverLine, 62, 2);
  const twin = wrapText(story.analogLine, 62, 2);
  const caveat = wrapText(story.caveat, 92, 2);
  const urlLabel = shareUrl.replace(/^https?:\/\//, "");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="0.55" stop-color="#102033"/>
      <stop offset="1" stop-color="#162011"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#67e8f9"/>
      <stop offset="0.5" stop-color="#f59e0b"/>
      <stop offset="1" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1020" cy="82" r="170" fill="#67e8f9" opacity="0.08"/>
  <circle cx="1090" cy="510" r="230" fill="#f59e0b" opacity="0.08"/>
  <path d="M58 488 C190 418 326 474 454 404 S719 303 871 350 S1084 317 1142 256" fill="none" stroke="url(#line)" stroke-width="9" stroke-linecap="round" opacity="0.88"/>
  <path d="M58 536 C198 474 330 512 456 466 S740 397 866 429 S1069 408 1142 366" fill="none" stroke="#67e8f9" stroke-width="3" stroke-linecap="round" opacity="0.28"/>
  <rect x="48" y="48" width="1104" height="534" rx="28" fill="rgba(5,10,18,0.58)" stroke="rgba(255,255,255,0.15)"/>
  <text x="82" y="98" font-size="30" font-weight="900" fill="#67e8f9">fupit</text>
  <text x="166" y="98" font-size="18" font-weight="700" fill="rgba(255,255,255,0.68)">grounded climate projection</text>
  ${svgTextLines(headline, 82, 180, 48, "#ffffff", 900, 58)}
  ${svgTextLines(metric, 82, 356, 24, "rgba(255,255,255,0.82)", 700, 32)}
  <rect x="82" y="424" width="486" height="86" rx="18" fill="rgba(245,158,11,0.12)" stroke="rgba(245,158,11,0.35)"/>
  <text x="108" y="456" font-size="15" font-weight="900" fill="#f59e0b">TOP LOCAL DRIVER</text>
  ${svgTextLines(driver, 108, 482, 18, "rgba(255,255,255,0.84)", 700, 24)}
  <rect x="608" y="424" width="486" height="86" rx="18" fill="rgba(168,85,247,0.12)" stroke="rgba(168,85,247,0.35)"/>
  <text x="634" y="456" font-size="15" font-weight="900" fill="#a855f7">CLIMATE TWIN</text>
  ${svgTextLines(twin, 634, 482, 18, "rgba(255,255,255,0.84)", 700, 24)}
  ${svgTextLines(caveat, 82, 554, 15, "rgba(255,255,255,0.58)", 600, 20)}
  <text x="1118" y="554" text-anchor="end" font-size="15" font-weight="800" fill="rgba(255,255,255,0.74)">${escapeSvgText(urlLabel)}</text>
</svg>`;
}

export function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas_unavailable"));
        return;
      }
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("png_blob_unavailable"));
      }, "image/png", 0.92);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("share_image_render_failed"));
    };
    image.src = url;
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}
