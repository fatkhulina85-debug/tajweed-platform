import type { Database, Json } from "@/lib/supabase/database.types";

export type BlockType = Database["public"]["Enums"]["block_type"];

export const blockTypes: readonly BlockType[] = [
  "text",
  "arabic",
  "table",
  "makhraj",
  "sifat",
  "mastery",
];

/** Body shapes stored in lesson_blocks.body, one per block type. */
export type BlockBody =
  | { kind: "text"; text: string }
  | { kind: "arabic"; arabic: string; note: string }
  | { kind: "table"; rows: string[][]; header: boolean };

/** Which body shape a block type uses. */
export function bodyKind(type: BlockType): BlockBody["kind"] {
  if (type === "arabic") return "arabic";
  if (type === "table") return "table";
  return "text";
}

const MAX_TEXT = 20_000;

/**
 * Parses table text: one row per line, cells separated by `|`.
 * Empty lines are skipped; rows are padded to the widest row.
 */
export function parseTable(input: string): string[][] {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((cell) => cell.trim()));
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => [...row, ...Array(width - row.length).fill("")]);
}

export function formatTable(rows: string[][]): string {
  return rows.map((row) => row.join(" | ")).join("\n");
}

/** Builds and validates a block body from form fields; null when invalid. */
export function bodyFromFields(
  type: BlockType,
  fields: { text?: string; arabic?: string; note?: string; table?: string; header?: boolean },
): { [key: string]: Json } | null {
  switch (bodyKind(type)) {
    case "arabic": {
      const arabic = (fields.arabic ?? "").trim();
      const note = (fields.note ?? "").trim();
      if (!arabic || arabic.length > MAX_TEXT || note.length > MAX_TEXT) return null;
      return { arabic, note };
    }
    case "table": {
      const rows = parseTable(fields.table ?? "");
      if (rows.length === 0 || rows.length > 200 || rows[0].length > 12) return null;
      return { rows, header: Boolean(fields.header) };
    }
    default: {
      const text = (fields.text ?? "").trim();
      if (!text || text.length > MAX_TEXT) return null;
      return { text };
    }
  }
}

/** Reads a stored body defensively (old or hand-edited rows must not crash a page). */
export function readBody(type: BlockType, body: unknown): BlockBody {
  const value = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const str = (key: string) => (typeof value[key] === "string" ? (value[key] as string) : "");

  switch (bodyKind(type)) {
    case "arabic":
      return { kind: "arabic", arabic: str("arabic"), note: str("note") };
    case "table": {
      const rows = Array.isArray(value.rows)
        ? value.rows.filter(Array.isArray).map((row) => row.map((cell: unknown) => String(cell ?? "")))
        : [];
      return { kind: "table", rows, header: value.header === true };
    }
    default:
      return { kind: "text", text: str("text") };
  }
}

/** Splits text into paragraphs on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** One option per line, 2 to 10 options. */
export function parseOptions(input: string): string[] | null {
  const options = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return options.length >= 2 && options.length <= 10 ? options : null;
}

/** Picks the localized title, falling back to the Russian one. */
export function localized(locale: string, title: string, titleAr: string): string {
  return locale === "ar" && titleAr.trim() ? titleAr : title;
}
