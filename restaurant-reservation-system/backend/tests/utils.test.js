import "./helpers.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCsrfToken, isGenuineCsrfToken, safeEqual } from "../src/utils/csrf.js";
import { hashPassword, verifyPassword } from "../src/utils/password.js";

const SECRET = "x".repeat(40);

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("CorrectHorse9");
    assert.equal(await verifyPassword("CorrectHorse9", hash), true);
    assert.equal(await verifyPassword("correcthorse9", hash), false);
  });

  it("never stores the password and uses a unique salt per hash", async () => {
    const first = await hashPassword("CorrectHorse9");
    const second = await hashPassword("CorrectHorse9");
    assert.ok(!first.includes("CorrectHorse9"));
    assert.notEqual(first, second);
  });

  it("returns false for malformed stored values instead of throwing", async () => {
    for (const stored of ["", "plain-text", "scrypt$only-one-part", undefined, "bcrypt$a$b"]) {
      assert.equal(await verifyPassword("anything", stored), false);
    }
  });
});

describe("csrf tokens", () => {
  it("accepts tokens the server issued", () => {
    assert.equal(isGenuineCsrfToken(createCsrfToken(SECRET), SECRET), true);
  });

  it("issues a different token each time", () => {
    assert.notEqual(createCsrfToken(SECRET), createCsrfToken(SECRET));
  });

  it("rejects forged, tampered, malformed, and wrong-secret tokens", () => {
    const token = createCsrfToken(SECRET);
    const [nonce] = token.split(".");
    assert.equal(isGenuineCsrfToken(`${nonce}.${"0".repeat(64)}`, SECRET), false);
    assert.equal(isGenuineCsrfToken(`${nonce}x.${token.split(".")[1]}`, SECRET), false);
    assert.equal(isGenuineCsrfToken("just-a-string", SECRET), false);
    assert.equal(isGenuineCsrfToken(`${token}.extra`, SECRET), false);
    assert.equal(isGenuineCsrfToken(undefined, SECRET), false);
    assert.equal(isGenuineCsrfToken(token, "y".repeat(40)), false);
  });

  it("compares strings safely, including different lengths", () => {
    assert.equal(safeEqual("abc", "abc"), true);
    assert.equal(safeEqual("abc", "abd"), false);
    assert.equal(safeEqual("abc", "abcd"), false);
  });
});
