import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UNLIMITED, assertWithinLimit } from "./limits";

describe("plan limits", () => {
  it("blocks generation past the monthly cap", () => {
    const check = assertWithinLimit(25, 25, 1, "Monthly certificates");
    assert.equal(check.ok, false);
  });

  it("allows remaining capacity", () => {
    const check = assertWithinLimit(10, 25, 5, "Monthly certificates");
    assert.equal(check.ok, true);
  });

  it("treats unlimited as always ok", () => {
    const check = assertWithinLimit(999999, UNLIMITED, 1000, "Certificates");
    assert.equal(check.ok, true);
  });
});
