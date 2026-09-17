import { describe, expect, it } from "vitest";
import { firstName, initials, joinNames } from "./people";

describe("people helpers", () => {
  it("takes initials from up to two words", () => {
    expect(initials("Lucas")).toBe("L");
    expect(initials("Jerusha Akka")).toBe("JA");
    expect(initials("Mary Ann Smith")).toBe("MA");
  });

  it("joins names like a spoken list", () => {
    expect(joinNames(["Lucas"])).toBe("Lucas");
    expect(joinNames(["Lucas", "Daniel"])).toBe("Lucas and Daniel");
    expect(joinNames(["Lucas", "Jerusha Akka", "Daniel"])).toBe("Lucas, Jerusha Akka and Daniel");
  });

  it("uses the first word for walk-up copy", () => {
    expect(firstName("Jerusha Akka")).toBe("Jerusha");
  });
});
