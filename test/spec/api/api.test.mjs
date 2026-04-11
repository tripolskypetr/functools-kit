import { test } from "worker-testbed";
import {
    distinctDocuments,
    filterDocuments,
    iterateDocuments,
    iterateList,
    iteratePromise,
    iterateUnion,
    mapDocuments,
    paginateDocuments,
    pickDocuments,
    resolveDocuments,
} from "../../../build/index.mjs";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function collect(gen) {
    const result = [];
    for await (const v of gen) result.push(v);
    return result;
}

async function* fromArray(arr) {
    yield arr;
}

async function* fromItems(arr) {
    for (const item of arr) yield item;
}

// ═══════════════════════════════════════════════════════════════════════════════
// resolveDocuments
// ═══════════════════════════════════════════════════════════════════════════════

test("resolveDocuments: flattens array chunks", async (t) => {
    const gen = (async function* () {
        yield [1, 2];
        yield [3, 4];
    })();
    const result = await resolveDocuments(gen);
    if (result.join(',') === '1,2,3,4') t.pass();
    else t.fail(`got ${result}`);
});

test("resolveDocuments: single items", async (t) => {
    const result = await resolveDocuments(fromItems([10, 20, 30]));
    if (result.join(',') === '10,20,30') t.pass();
    else t.fail(`got ${result}`);
});

test("resolveDocuments: empty generator", async (t) => {
    const result = await resolveDocuments((async function* () {})());
    if (result.length === 0) t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// distinctDocuments
// ═══════════════════════════════════════════════════════════════════════════════

test("distinctDocuments: removes duplicates by id", async (t) => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 1 }, { id: 3 }];
    const result = await collect(distinctDocuments(fromItems(rows)));
    if (result.map(r => r.id).join(',') === '1,2,3') t.pass();
    else t.fail(`got ${result.map(r => r.id)}`);
});

test("distinctDocuments: custom getId", async (t) => {
    const rows = [{ key: 'a' }, { key: 'b' }, { key: 'a' }];
    const result = await collect(distinctDocuments(fromItems(rows), r => r.key));
    if (result.map(r => r.key).join(',') === 'a,b') t.pass();
    else t.fail(`got ${result.map(r => r.key)}`);
});

test("distinctDocuments: array chunks deduped", async (t) => {
    const gen = (async function* () {
        yield [{ id: 1 }, { id: 2 }];
        yield [{ id: 2 }, { id: 3 }];
    })();
    const result = await collect(distinctDocuments(gen));
    if (result.map(r => r.id).join(',') === '1,2,3') t.pass();
    else t.fail(`got ${result.map(r => r.id)}`);
});

test("distinctDocuments: all unique — none dropped", async (t) => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = await collect(distinctDocuments(fromItems(rows)));
    if (result.length === 3) t.pass();
    else t.fail(`got ${result.length}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// filterDocuments
// ═══════════════════════════════════════════════════════════════════════════════

test("filterDocuments: sync predicate", async (t) => {
    const result = await collect(filterDocuments(fromItems([1, 2, 3, 4, 5]), v => v % 2 === 0));
    if (result.join(',') === '2,4') t.pass();
    else t.fail(`got ${result}`);
});

test("filterDocuments: async predicate", async (t) => {
    const result = await collect(filterDocuments(fromItems([1, 2, 3, 4]), async v => v > 2));
    if (result.join(',') === '3,4') t.pass();
    else t.fail(`got ${result}`);
});

test("filterDocuments: array chunks", async (t) => {
    const gen = (async function* () {
        yield [1, 2, 3];
        yield [4, 5, 6];
    })();
    const result = await collect(filterDocuments(gen, v => v % 3 === 0));
    if (result.join(',') === '3,6') t.pass();
    else t.fail(`got ${result}`);
});

test("filterDocuments: none pass", async (t) => {
    const result = await collect(filterDocuments(fromItems([1, 2, 3]), v => v > 10));
    if (result.length === 0) t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// mapDocuments
// ═══════════════════════════════════════════════════════════════════════════════

test("mapDocuments: sync transform", async (t) => {
    const result = await collect(mapDocuments(fromItems([1, 2, 3]), v => v * 10));
    if (result.join(',') === '10,20,30') t.pass();
    else t.fail(`got ${result}`);
});

test("mapDocuments: async transform", async (t) => {
    const result = await collect(mapDocuments(fromItems([1, 2, 3]), async v => v + 100));
    if (result.join(',') === '101,102,103') t.pass();
    else t.fail(`got ${result}`);
});

test("mapDocuments: array chunks", async (t) => {
    const gen = (async function* () {
        yield [1, 2];
        yield [3, 4];
    })();
    const result = await collect(mapDocuments(gen, v => v * 2));
    if (result.join(',') === '2,4,6,8') t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// pickDocuments
// ═══════════════════════════════════════════════════════════════════════════════

test("pickDocuments: limit and offset", (t) => {
    const pick = pickDocuments(2, 1);
    pick([10, 20, 30, 40]);
    const { rows, done } = pick();
    if (rows.join(',') === '20,30' && done) t.pass();
    else t.fail(`rows=${rows} done=${done}`);
});

test("pickDocuments: offset skips correctly", (t) => {
    const pick = pickDocuments(3, 2);
    pick([1, 2, 3, 4, 5]);
    const { rows } = pick();
    if (rows.join(',') === '3,4,5') t.pass();
    else t.fail(`got ${rows}`);
});

test("pickDocuments: done=false when limit not exhausted", (t) => {
    const pick = pickDocuments(5, 0);
    pick([1, 2]);
    const { rows, done } = pick();
    if (rows.join(',') === '1,2' && !done) t.pass();
    else t.fail(`rows=${rows} done=${done}`);
});

test("pickDocuments: incremental chunks", (t) => {
    const pick = pickDocuments(3, 0);
    pick([1, 2]);
    pick([3, 4, 5]);
    const { rows, done } = pick();
    if (rows.join(',') === '1,2,3' && done) t.pass();
    else t.fail(`rows=${rows} done=${done}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// paginateDocuments
// ═══════════════════════════════════════════════════════════════════════════════

test("paginateDocuments: limit and offset from generator", async (t) => {
    const gen = (async function* () {
        yield [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    })();
    const result = await paginateDocuments(gen, 3, 2);
    if (result.join(',') === '3,4,5') t.pass();
    else t.fail(`got ${result}`);
});

test("paginateDocuments: first page", async (t) => {
    const gen = fromItems([1, 2, 3, 4, 5]);
    const result = await paginateDocuments(gen, 2, 0);
    if (result.join(',') === '1,2') t.pass();
    else t.fail(`got ${result}`);
});

test("paginateDocuments: offset beyond data", async (t) => {
    const gen = fromItems([1, 2, 3]);
    const result = await paginateDocuments(gen, 5, 10);
    if (result.length === 0) t.pass();
    else t.fail(`got ${result}`);
});

test("paginateDocuments: chunked generator", async (t) => {
    const gen = (async function* () {
        yield [1, 2, 3];
        yield [4, 5, 6];
    })();
    const result = await paginateDocuments(gen, 2, 3);
    if (result.join(',') === '4,5') t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// iterateList
// ═══════════════════════════════════════════════════════════════════════════════

test("iterateList: yields each item", async (t) => {
    const result = await collect(iterateList([1, 2, 3]));
    if (result.join(',') === '1,2,3') t.pass();
    else t.fail(`got ${result}`);
});

test("iterateList: async map transform", async (t) => {
    const result = await collect(iterateList([1, 2, 3], async v => v * 5));
    if (result.join(',') === '5,10,15') t.pass();
    else t.fail(`got ${result}`);
});

test("iterateList: empty array", async (t) => {
    const result = await collect(iterateList([]));
    if (result.length === 0) t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// iteratePromise
// ═══════════════════════════════════════════════════════════════════════════════

test("iteratePromise: yields each item from promise", async (t) => {
    const result = await collect(iteratePromise(async () => [10, 20, 30]));
    if (result.join(',') === '10,20,30') t.pass();
    else t.fail(`got ${result}`);
});

test("iteratePromise: empty array", async (t) => {
    const result = await collect(iteratePromise(async () => []));
    if (result.length === 0) t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// iterateUnion
// ═══════════════════════════════════════════════════════════════════════════════

test("iterateUnion: merges two generators, dedupes by id", async (t) => {
    const a = fromItems([{ id: 1 }, { id: 2 }]);
    const b = fromItems([{ id: 2 }, { id: 3 }]);
    const result = await collect(iterateUnion([a, b])(10, 0));
    if (result.map(r => r.id).join(',') === '1,2,3') t.pass();
    else t.fail(`got ${result.map(r => r.id)}`);
});

test("iterateUnion: limit respected", async (t) => {
    const a = fromItems([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const b = fromItems([{ id: 4 }, { id: 5 }]);
    const result = await collect(iterateUnion([a, b])(2, 0));
    if (result.length === 2 && result[0].id === 1 && result[1].id === 2) t.pass();
    else t.fail(`got ${result.map(r => r.id)}`);
});

test("iterateUnion: offset respected", async (t) => {
    const a = fromItems([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
    const result = await collect(iterateUnion([a])(2, 2));
    if (result.map(r => r.id).join(',') === '3,4') t.pass();
    else t.fail(`got ${result.map(r => r.id)}`);
});

test("iterateUnion: custom getId", async (t) => {
    const a = fromItems([{ key: 'x' }, { key: 'y' }]);
    const b = fromItems([{ key: 'y' }, { key: 'z' }]);
    const result = await collect(iterateUnion([a, b], r => r.key)(10, 0));
    if (result.map(r => r.key).join(',') === 'x,y,z') t.pass();
    else t.fail(`got ${result.map(r => r.key)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// iterateDocuments
// ═══════════════════════════════════════════════════════════════════════════════

test("iterateDocuments: paginates until less-than-limit response", async (t) => {
    const pages = [
        [{ id: 1 }, { id: 2 }],
        [{ id: 3 }],
    ];
    let page = 0;
    const result = await resolveDocuments(iterateDocuments({
        totalDocuments: 100,
        limit: 2,
        delay: 0,
        createRequest: () => pages[page++] || [],
    }));
    if (result.map(r => r.id).join(',') === '1,2,3') t.pass();
    else t.fail(`got ${result.map(r => r.id)}`);
});

test("iterateDocuments: stops at totalDocuments", async (t) => {
    let calls = 0;
    const result = await resolveDocuments(iterateDocuments({
        totalDocuments: 4,
        limit: 2,
        delay: 0,
        createRequest: ({ offset }) => {
            calls++;
            return [{ id: offset + 1 }, { id: offset + 2 }];
        },
    }));
    if (result.length === 4) t.pass();
    else t.fail(`got ${result.length}`);
});

test("iterateDocuments: lastId passed to subsequent requests", async (t) => {
    const lastIds = [];
    await resolveDocuments(iterateDocuments({
        totalDocuments: 4,
        limit: 2,
        delay: 0,
        createRequest: ({ lastId, offset }) => {
            lastIds.push(lastId);
            return [{ id: offset + 1 }, { id: offset + 2 }];
        },
    }));
    if (lastIds[0] === null && lastIds[1] === 2) t.pass();
    else t.fail(`lastIds=${lastIds}`);
});

test("iterateDocuments: throws when response.length > limit", async (t) => {
    try {
        await resolveDocuments(iterateDocuments({
            totalDocuments: 100,
            limit: 2,
            delay: 0,
            createRequest: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
        }));
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message.includes('response.length > limit')) t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});
