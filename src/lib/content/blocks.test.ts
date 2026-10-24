import { describe, expect, it } from "vitest";
import {
  bodyFromFields,
  formatTable,
  localized,
  paragraphs,
  parseOptions,
  parseTable,
  readBody,
} from "./blocks";

describe("parseTable", () => {
  it("splits rows by line and cells by |, padding short rows", () => {
    expect(parseTable("ا | alif\nب | ba | b\n\n")).toEqual([
      ["ا", "alif", ""],
      ["ب", "ba", "b"],
    ]);
  });

  it("round-trips through formatTable", () => {
    const rows = [["a", "b"], ["c", "d"]];
    expect(parseTable(formatTable(rows))).toEqual(rows);
  });
});

describe("bodyFromFields", () => {
  it("builds text bodies and rejects empty ones", () => {
    expect(bodyFromFields("makhraj", { text: "  Горло  " })).toEqual({ text: "Горло" });
    expect(bodyFromFields("text", { text: "   " })).toBeNull();
  });

  it("requires Arabic text for arabic blocks", () => {
    expect(bodyFromFields("arabic", { arabic: "بِسْمِ ٱللَّهِ", note: "" })).toEqual({
      arabic: "بِسْمِ ٱللَّهِ",
      note: "",
    });
    expect(bodyFromFields("arabic", { arabic: "", note: "x" })).toBeNull();
  });

  it("builds tables with a header flag", () => {
    expect(bodyFromFields("table", { table: "a|b", header: true })).toEqual({
      rows: [["a", "b"]],
      header: true,
    });
    expect(bodyFromFields("table", { table: "" })).toBeNull();
  });
});

describe("readBody", () => {
  it("tolerates malformed stored bodies", () => {
    expect(readBody("text", null)).toEqual({ kind: "text", text: "" });
    expect(readBody("table", { rows: "nope" })).toEqual({ kind: "table", rows: [], header: false });
    expect(readBody("table", { rows: [["a", 1]], header: true })).toEqual({
      kind: "table",
      rows: [["a", "1"]],
      header: true,
    });
  });
});

describe("helpers", () => {
  it("splits paragraphs on blank lines", () => {
    expect(paragraphs("one\nline\n\n two \n \nthree")).toEqual(["one\nline", "two", "three"]);
  });

  it("parses 2-10 options", () => {
    expect(parseOptions("a\n\nb\n")).toEqual(["a", "b"]);
    expect(parseOptions("only one")).toBeNull();
  });

  it("falls back to the Russian title", () => {
    expect(localized("ar", "Урок", "")).toBe("Урок");
    expect(localized("ar", "Урок", "الدرس")).toBe("الدرس");
    expect(localized("ru", "Урок", "الدرس")).toBe("Урок");
  });
});
