import { describe, expect, it } from "vitest";
import { primaryRole, routeDecision, safeNextPath } from "./routes";
import { isEmail, isStrongPassword } from "./validation";

describe("routeDecision", () => {
  it("sends guests from cabinets to login and keeps the target", () => {
    expect(routeDecision("/ru/student/course", false)).toEqual({
      redirectTo: "/ru/login?next=%2Fru%2Fstudent%2Fcourse",
    });
    expect(routeDecision("/ar/admin/users", false)?.redirectTo).toMatch(/^\/ar\/login/);
    expect(routeDecision("/ru/set-password", false)?.redirectTo).toMatch(/^\/ru\/login/);
  });

  it("lets guests open public pages", () => {
    expect(routeDecision("/ru", false)).toBeNull();
    expect(routeDecision("/ru/login", false)).toBeNull();
    expect(routeDecision("/ru/auth/confirm", false)).toBeNull();
  });

  it("sends signed-in users away from login", () => {
    expect(routeDecision("/ar/login", true)).toEqual({ redirectTo: "/ar/app" });
  });

  it("lets signed-in users into cabinets (roles are checked on the page)", () => {
    expect(routeDecision("/ru/teacher/dashboard", true)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("accepts local paths inside a locale", () => {
    expect(safeNextPath("/ru/student/lessons/abc-1", "ru")).toBe("/ru/student/lessons/abc-1");
    expect(safeNextPath("/ar/set-password", "ru")).toBe("/ar/set-password");
  });

  it("rejects open redirects and junk", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/ru//evil.com", "/en/x", "/ru/x?y=1", "", null]) {
      expect(safeNextPath(bad, "ru")).toBe("/ru/app");
    }
  });
});

describe("primaryRole", () => {
  it("prefers admin, then teacher, then student", () => {
    expect(primaryRole(["student", "admin"])).toBe("admin");
    expect(primaryRole(["student", "teacher"])).toBe("teacher");
    expect(primaryRole(["student"])).toBe("student");
    expect(primaryRole([])).toBeNull();
  });
});

describe("validation", () => {
  it("checks emails", () => {
    expect(isEmail("user@example.com")).toBe(true);
    expect(isEmail("user@example")).toBe(false);
    expect(isEmail("a b@example.com")).toBe(false);
  });

  it("requires 8+ characters with letters and digits", () => {
    expect(isStrongPassword("abcd1234")).toBe(true);
    expect(isStrongPassword("пароль12")).toBe(true);
    expect(isStrongPassword("abcdefgh")).toBe(false);
    expect(isStrongPassword("a1b2c3")).toBe(false);
  });
});
