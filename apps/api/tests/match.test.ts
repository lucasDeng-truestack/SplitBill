import { describe, expect, it } from "vitest";
import { matchItems, normalizeItemName } from "../src/domain/match.js";

const items = [
  { id: "1", name: "Roti telur" },
  { id: "2", name: "Roti kosong" },
  { id: "3", name: "Nasi lemak" },
];

describe("matchItems", () => {
  it("normalizes case, punctuation, and whitespace", () => {
    expect(normalizeItemName("  Roti-Telur!! ")).toBe("roti telur");
  });

  it("matches exact and near spellings", () => {
    expect(matchItems("roti telur", items)[0]?.id).toBe("1");
    expect(matchItems("Roti Telur", items)[0]?.id).toBe("1");
    expect(matchItems("roti telor", items)[0]?.id).toBe("1");
  });
});
