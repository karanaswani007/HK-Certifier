import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractVariables, replaceVariables } from "./variables";

describe("replaceVariables", () => {
  it("replaces known tokens", () => {
    const out = replaceVariables("Hello {{ student_name }} from {{college}}", {
      student_name: "Asha Rao",
      college: "NITK",
    });
    assert.equal(out, "Hello Asha Rao from NITK");
  });

  it("replaces missing tokens with empty string", () => {
    assert.equal(replaceVariables("ID {{certificate_id}}", {}), "ID ");
  });

  it("extracts unique variable names", () => {
    const vars = extractVariables("{{a}} {{b}} {{ a }}");
    assert.deepEqual(vars.sort(), ["a", "b"]);
  });
});
