export function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

export function printPDF(title: string, rows: (string | number)[][]) {
  const w = window.open("", "_blank"); if (!w) return;
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const [head, ...body] = rows;
  w.document.write(`<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:'Hind Siliguri',sans-serif;padding:24px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#e6f0ea}</style></head>
<body><h2>${esc(title)}</h2><table><tr>${(head ?? []).map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>
<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
