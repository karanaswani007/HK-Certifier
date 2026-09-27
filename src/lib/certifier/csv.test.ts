import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv, suggestMapping, validateStudentRow } from "./csv";

describe("csv import", () => {
  it("parses quoted commas", () => {
    const csv = `name,email,college\n"Rao, Asha",asha@nitk.edu,NITK\n`;
    const parsed = parseCsv(csv);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0]?.name, "Rao, Asha");
  });

  it("suggests mappings and validates rows", () => {
    const parsed = parseCsv("name,email,student_id\nAsha,bad,1\nAsha,asha@x.com,2\n");
    const mapping = suggestMapping(parsed.headers);
    assert.equal(mapping.full_name, "name");
    const bad = validateStudentRow(parsed.rows[0]!, mapping, 2);
    assert.equal(bad.errors[0]?.message, "Invalid email");
    const good = validateStudentRow(parsed.rows[1]!, mapping, 3);
    assert.equal(good.record?.fullName, "Asha");
  });
});
