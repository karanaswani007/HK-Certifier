import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readDefaultAdminConfig } from "./default-admin.ts";

describe("default admin config", () => {
  it("reads a configured admin from env", () => {
    const config = readDefaultAdminConfig({
      ADMIN_EMAIL: " admin@hksofttech.in ",
      ADMIN_PASSWORD: "StrongPass123",
      ADMIN_NAME: " HK Admin ",
    });

    assert.deepEqual(config, {
      email: "admin@hksofttech.in",
      password: "StrongPass123",
      name: "HK Admin",
    });
  });

  it("returns undefined when no admin is configured", () => {
    assert.deepEqual(readDefaultAdminConfig({}), {
      email: undefined,
      password: undefined,
      name: "Platform Admin",
    });
  });
});
