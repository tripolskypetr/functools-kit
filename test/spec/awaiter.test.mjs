import { test } from "worker-testbed";
import { awaiter } from "../../build/index.mjs";

test("awaiter: sync function returns value → Promise resolves", async (t) => {
  const fn = awaiter((x) => x * 2);
  const result = await fn(21);
  if (result === 42) {
    t.pass();
  } else {
    t.fail(`expected 42, got ${result}`);
  }
});

test("awaiter: sync function throws → Promise rejects", async (t) => {
  const err = new Error("sync boom");
  const fn = awaiter(() => { throw err; });
  try {
    await fn();
    t.fail("should have rejected");
  } catch (e) {
    if (e === err) {
      t.pass();
    } else {
      t.fail(`expected original error, got ${e}`);
    }
  }
});

test("awaiter: async function resolves → Promise resolves", async (t) => {
  const fn = awaiter(async (x) => x + 1);
  const result = await fn(41);
  if (result === 42) {
    t.pass();
  } else {
    t.fail(`expected 42, got ${result}`);
  }
});

test("awaiter: async function rejects → Promise rejects", async (t) => {
  const err = new Error("async boom");
  const fn = awaiter(async () => { throw err; });
  try {
    await fn();
    t.fail("should have rejected");
  } catch (e) {
    if (e === err) {
      t.pass();
    } else {
      t.fail(`expected original error, got ${e}`);
    }
  }
});

test("awaiter: arguments are passed through correctly", async (t) => {
  const fn = awaiter((a, b, c) => a + b + c);
  const result = await fn(1, 2, 3);
  if (result === 6) {
    t.pass();
  } else {
    t.fail(`expected 6, got ${result}`);
  }
});
