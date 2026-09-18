import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "../src/config.js";

describe("CORS origins", () => {
  it("allows missing origin for health checks", () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it("allows configured localhost", () => {
    expect(isAllowedOrigin("http://localhost:3030")).toBe(true);
  });

  it("rejects unknown hosts", () => {
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
  });
});
