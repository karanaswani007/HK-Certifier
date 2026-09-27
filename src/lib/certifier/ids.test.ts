import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateCertificateId, programCodeFromName, slugify } from "./ids";

describe("certificate ids", () => {
  it("creates unique hard-to-guess public ids", () => {
    const a = generateCertificateId("IOT");
    const b = generateCertificateId("IOT");
    assert.match(a, /^HKC-\d{4}-IOT-[A-Z0-9]{8}$/);
    assert.notEqual(a, b);
  });

  it("slugifies organization names", () => {
    assert.equal(slugify("Demo Tech Institute"), "demo-tech-institute");
  });

  it("builds a program code", () => {
    assert.equal(programCodeFromName("10 Days IoT Internship"), "IOT");
  });
});
