import { describe, expect, test } from "bun:test";
import { hasRole } from "./permissions";

describe("hasRole", () => {
  test("should allow when the user role is the same as the required role", () => {
    expect(hasRole("viewer", "viewer")).toBe(true);
    expect(hasRole("manager", "manager")).toBe(true);
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("owner", "owner")).toBe(true);
  });

  test("should allow when the user role is higher than the required role", () => {
    expect(hasRole("owner", "viewer")).toBe(true);
    expect(hasRole("owner", "manager")).toBe(true);
    expect(hasRole("owner", "admin")).toBe(true);
    expect(hasRole("admin", "manager")).toBe(true);
    expect(hasRole("admin", "viewer")).toBe(true);
    expect(hasRole("manager", "viewer")).toBe(true);
  });

  test("should block when the user role is lower than the required role", () => {
    expect(hasRole("viewer", "manager")).toBe(false);
    expect(hasRole("viewer", "admin")).toBe(false);
    expect(hasRole("viewer", "owner")).toBe(false);
    expect(hasRole("manager", "admin")).toBe(false);
    expect(hasRole("manager", "owner")).toBe(false);
    expect(hasRole("admin", "owner")).toBe(false);
  });

  test("should block when the user role is not a known role", () => {
    expect(hasRole("guest", "viewer")).toBe(false);
    expect(hasRole("", "viewer")).toBe(false);
    expect(hasRole("OWNER", "viewer")).toBe(false);
  });
});
