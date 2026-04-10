import { test } from "tape";
import { awaiter } from "../../build/index.mjs";

test("awaiter: sync function returns value → Promise resolves", async (t) => {
  const fn = awaiter((x) => x * 2);
  const result = await fn(21);
  t.equal(result, 42, "resolves with correct value");
});

test("awaiter: sync function throws → Promise rejects", async (t) => {
  const err = new Error("sync boom");
  const fn = awaiter(() => { throw err; });
  try {
    await fn();
    t.fail("should have rejected");
  } catch (e) {
    t.equal(e, err, "rejects with the original error");
  }
});

test("awaiter: async function resolves → Promise resolves", async (t) => {
  const fn = awaiter(async (x) => x + 1);
  const result = await fn(41);
  t.equal(result, 42, "resolves with correct value");
});

test("awaiter: async function rejects → Promise rejects", async (t) => {
  const err = new Error("async boom");
  const fn = awaiter(async () => { throw err; });
  try {
    await fn();
    t.fail("should have rejected");
  } catch (e) {
    t.equal(e, err, "rejects with the original error");
  }
});

test("awaiter: arguments are passed through correctly", async (t) => {
  const fn = awaiter((a, b, c) => a + b + c);
  const result = await fn(1, 2, 3);
  t.equal(result, 6, "all arguments forwarded");
});
