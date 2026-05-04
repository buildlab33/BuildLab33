import { describe, it, expect } from "vitest";
import { checkPasswordPolicy, type PasswordCheck } from "@/lib/passwordPolicy";

describe("checkPasswordPolicy", () => {
  it("returns all passing for a valid password", () => {
    const result = checkPasswordPolicy("Secure1!");
    expect(result.every((c) => c.pass)).toBe(true);
  });

  it("fails minLength for short password", () => {
    const result = checkPasswordPolicy("Ab1!");
    const min = result.find((c) => c.id === "minLength")!;
    expect(min.pass).toBe(false);
  });

  it("fails uppercase check", () => {
    const result = checkPasswordPolicy("secure1!");
    const up = result.find((c) => c.id === "uppercase")!;
    expect(up.pass).toBe(false);
  });

  it("fails digit check", () => {
    const result = checkPasswordPolicy("SecureAA!");
    const dig = result.find((c) => c.id === "digit")!;
    expect(dig.pass).toBe(false);
  });

  it("fails special check", () => {
    const result = checkPasswordPolicy("Secure123");
    const sp = result.find((c) => c.id === "special")!;
    expect(sp.pass).toBe(false);
  });

  it("returns 4 checks", () => {
    expect(checkPasswordPolicy("x")).toHaveLength(4);
  });
});
