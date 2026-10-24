import { describe, expect, it } from "vitest";
import { hasLocale, negotiateLocale, switchLocalePath } from "./config";
import ar from "./dictionaries/ar";
import ru from "./dictionaries/ru";

describe("hasLocale", () => {
  it("accepts supported locales only", () => {
    expect(hasLocale("ru")).toBe(true);
    expect(hasLocale("ar")).toBe(true);
    expect(hasLocale("en")).toBe(false);
    expect(hasLocale(undefined)).toBe(false);
  });
});

describe("negotiateLocale", () => {
  it("prefers a valid saved cookie", () => {
    expect(negotiateLocale("ar", "ru-RU,ru;q=0.9")).toBe("ar");
  });

  it("ignores an invalid cookie", () => {
    expect(negotiateLocale("xx", "ar-SA")).toBe("ar");
  });

  it("respects Accept-Language weights", () => {
    expect(negotiateLocale(undefined, "en;q=1, ar;q=0.5, ru;q=0.8")).toBe("ru");
  });

  it("falls back to Russian", () => {
    expect(negotiateLocale(undefined, "en-US,en;q=0.9")).toBe("ru");
    expect(negotiateLocale(undefined, null)).toBe("ru");
  });
});

describe("switchLocalePath", () => {
  it("replaces an existing locale prefix", () => {
    expect(switchLocalePath("/ru/student/course", "ar")).toBe("/ar/student/course");
    expect(switchLocalePath("/ru", "ar")).toBe("/ar");
  });

  it("adds a prefix when missing", () => {
    expect(switchLocalePath("/", "ar")).toBe("/ar");
    expect(switchLocalePath("/login", "ru")).toBe("/ru/login");
  });
});

describe("dictionaries", () => {
  it("have identical keys in every locale", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
      value && typeof value === "object"
        ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}.${k}`))
        : [prefix];
    expect(keys(ar)).toEqual(keys(ru));
  });
});
