import { describe, expect, it } from "vitest";
import { filterItemsByQuery, itemMatchesQuery, shouldOfferItemFind } from "./filter-items";

const items = [
  { name: "Roti Telur Bawang" },
  { name: "Nasi Goreng Kampung" },
  { name: "Nasi Kandar" },
  { name: "Ais Kosong" },
  { name: "Chicken 65" },
];

describe("filterItemsByQuery", () => {
  it("returns everything when the query is blank", () => {
    expect(filterItemsByQuery(items, "  ")).toEqual(items);
  });

  it("filters by a word anywhere in the name", () => {
    expect(filterItemsByQuery(items, "nasi").map((item) => item.name)).toEqual([
      "Nasi Goreng Kampung",
      "Nasi Kandar",
    ]);
  });

  it("matches a near spelling like telor for telur", () => {
    expect(itemMatchesQuery("Roti Telur Bawang", "roti telor")).toBe(true);
  });

  it("only offers find on long slips", () => {
    expect(shouldOfferItemFind(7)).toBe(false);
    expect(shouldOfferItemFind(8)).toBe(true);
  });
});
