import type { HistoryEntry } from "@/components/SessionHistoryPanel";

// Minimal PDF generator (no deps) — mirrors the format used by the previous
// backend report so the look stays familiar. Helvetica + Helvetica-Bold only.

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 50;
const TOP = 756;
const BOTTOM = 60;
const LINE_H = 14;

type Run = { text: string; bold?: boolean; size?: number; color?: [number, number, number]; dx?: number };
type Line = { runs: Run[]; gap?: number };

const TITLE_COLOR: [number, number, number] = [0.10, 0.16, 0.24];
const TEXT_COLOR: [number, number, number] = [0.12, 0.18, 0.25];
const OK_COLOR: [number, number, number] = [0.07, 0.47, 0.24];
const BAD_COLOR: [number, number, number] = [0.72, 0.18, 0.18];

function esc(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // strip non-WinAnsi safe chars (keep ascii + common punctuation)
    .replace(/[^\x20-\x7E]/g, "");
}

// Approximate Helvetica char width (avg) for wrapping. Helvetica avg ~ 0.5 em.
function textWidth(text: string, size: number, bold: boolean): number {
  const avg = bold ? 0.56 : 0.52;
  return text.length * size * avg;
}

function wrapText(text: string, size: number, bold: boolean, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, size, bold) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function labelLine(label: string, value: string, size = 11): Line[] {
  // wrap long values
  const maxWidth = PAGE_W - MARGIN_X * 2;
  const full = `${label}: ${value}`;
  const wrapped = wrapText(full, size, false, maxWidth);
  return wrapped.map((t) => ({ runs: [{ text: t, size }] }));
}

function buildLinesForEntry(entry: HistoryEntry, idx: number): Line[] {
  const { word, attempt, result } = entry;
  const correct = !!result.correctness?.isCorrect;
  const lines: Line[] = [];

  // Header line: "#1  word - Correct/Incorrect"
  lines.push({
    runs: [
      { text: `#${idx + 1} `, bold: true, size: 11, color: correct ? OK_COLOR : BAD_COLOR },
      { text: word.word, bold: true, size: 13 },
      { text: " - ", size: 11 },
      { text: correct ? "Correct" : "Incorrect", bold: true, size: 11, color: correct ? OK_COLOR : BAD_COLOR },
    ],
  });

  if (word.origin) lines.push(...labelLine("Origin", word.origin));
  if (word.definition) lines.push(...labelLine("Definition", word.definition));
  if (word.exampleSentence) lines.push(...labelLine("Usage sentence", word.exampleSentence));
  if (word.partOfSpeech) lines.push(...labelLine("Part of speech", word.partOfSpeech));

  if (!correct && attempt) {
    lines.push(...labelLine("Attempt", attempt));
  }

  // Miss Analysis (only if incorrect)
  if (!correct) {
    const miss = result.missAnalysis;
    if (miss?.summary) lines.push(...labelLine("Miss analysis", miss.summary));
    if (miss?.primaryErrorFocus) lines.push(...labelLine("Primary focus", miss.primaryErrorFocus));
    if (miss?.errorTypes?.length) lines.push(...labelLine("Error types", miss.errorTypes.join(", ")));
    if (miss && "likelyWrongWordInterpretation" in miss) {
      lines.push(...labelLine("Wrong word interpretation", miss.likelyWrongWordInterpretation ? "Yes" : "No"));
    }
    if (miss && "usedMeaningDisambiguationWell" in miss) {
      lines.push(...labelLine("Used meaning disambiguation", miss.usedMeaningDisambiguationWell ? "Yes" : "No"));
    }
  }

  // Concept labels (morphology labels)
  const morph = result.conceptLabels?.morphologyLabels;
  if (morph?.length) lines.push(...labelLine("Concept labels", morph.join(", ")));

  // Memory tip
  const tip = result.coachingText?.memoryTip;
  if (tip) lines.push(...labelLine("Memory tip", tip));

  // trailing blank
  lines.push({ runs: [{ text: "" }], gap: 6 });

  return lines;
}

function emitTextOps(line: Line, y: number): string {
  // Render runs left-to-right, tracking x using textWidth approx.
  let x = MARGIN_X;
  let out = "";
  for (const r of line.runs) {
    const size = r.size ?? 11;
    const font = r.bold ? "F2" : "F1";
    const color = r.color ?? TEXT_COLOR;
    out += "BT\n";
    out += `/${font} ${size} Tf\n`;
    out += `${color[0]} ${color[1]} ${color[2]} rg\n`;
    out += `${x.toFixed(2)} ${y.toFixed(2)} Td\n`;
    out += `(${esc(r.text)}) Tj\n`;
    out += "ET\n";
    x += textWidth(r.text, size, !!r.bold);
  }
  return out;
}

function header(totalLines: Line[], generatedAt: string, totals: { total: number; correct: number; incorrect: number }) {
  totalLines.push({
    runs: [{ text: "AI Spelling Coach - Session Report", bold: true, size: 13, color: TITLE_COLOR }],
  });
  totalLines.push({ runs: [{ text: `Generated: ${generatedAt}`, size: 11 }] });
  totalLines.push({
    runs: [{ text: `Total practiced: ${totals.total} | Correct: ${totals.correct} | Incorrect: ${totals.incorrect}`, size: 11 }],
  });
  totalLines.push({ runs: [{ text: "" }] });
}

export function buildSessionReportPdf(history: HistoryEntry[]): Blob {
  const totals = {
    total: history.length,
    correct: history.filter((h) => h.result.correctness?.isCorrect).length,
    incorrect: history.filter((h) => !h.result.correctness?.isCorrect).length,
  };
  const generatedAt = new Date().toLocaleString();

  const allLines: Line[] = [];
  header(allLines, generatedAt, totals);
  history.forEach((e, i) => {
    allLines.push(...buildLinesForEntry(e, i));
  });

  // Paginate
  const pages: string[] = [];
  let y = TOP;
  let pageStream = "";
  for (const line of allLines) {
    const needed = LINE_H + (line.gap ?? 0);
    if (y - needed < BOTTOM) {
      pages.push(pageStream);
      pageStream = "";
      y = TOP;
    }
    pageStream += emitTextOps(line, y);
    y -= needed;
  }
  if (pageStream) pages.push(pageStream);
  if (pages.length === 0) pages.push("");

  // Build PDF objects
  // 1: Catalog, 2: Pages, 3: F1 (Helvetica), 4: F2 (Helvetica-Bold),
  // then for each page: Page object + Content stream.
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>"); // 1

  const pageObjNums: number[] = [];
  // Pages object inserted after we know kids; placeholder index 2.
  objects.push(""); // 2 placeholder
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); // 3
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"); // 4

  let next = 5;
  for (const stream of pages) {
    const pageObjNum = next++;
    const contentObjNum = next++;
    pageObjNums.push(pageObjNum);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  }

  objects[1] = `<< /Type /Pages /Count ${pageObjNums.length} /Kids [ ${pageObjNums.map((n) => `${n} 0 R`).join(" ")} ] >>`;

  // Assemble PDF with byte-accurate xref
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const off of offsets) {
    pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadSessionReport(history: HistoryEntry[]) {
  const blob = buildSessionReportPdf(history);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `ai-spelling-coach-session-${date}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
