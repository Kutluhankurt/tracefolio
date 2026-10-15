export function esc(text: string | undefined | null): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow http(s) and mailto links in generated pages. */
export function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return /^(https?:|mailto:)/i.test(url) ? url : undefined;
}

/** Render a summary that may be a "- item" list into HTML. */
export function summaryHtml(summary: string): string {
  const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.every((l) => /^[-*] /.test(l))) {
    return `<ul>${lines.map((l) => `<li>${esc(l.slice(2))}</li>`).join("")}</ul>`;
  }
  return `<p>${esc(lines.join(" "))}</p>`;
}
