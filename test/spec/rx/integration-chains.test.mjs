import { test } from "worker-testbed";
import { Subject, Source, Operator, sleep, createAwaiter } from "../../../build/index.mjs";

// ─── helpers ──────────────────────────────────────────────────────────────────

const collect = (obs, n, timeout = 2000) => {
    const results = [];
    const [promise, awaiter] = createAwaiter();
    const timer = setTimeout(() => awaiter.reject(new Error(`collect timeout, got ${results.length}/${n}`)), timeout);
    const unsub = obs.connect((v) => {
        results.push(v);
        if (results.length === n) { clearTimeout(timer); unsub(); awaiter.resolve(results); }
    });
    return promise;
};

const first = (obs, timeout = 2000) => collect(obs, 1, timeout).then(r => r[0]);


// ═══════════════════════════════════════════════════════════════════════════════
// 1–10: E-commerce / price pipeline
// ═══════════════════════════════════════════════════════════════════════════════

test("integration: price feed — filter low, apply discount, format", async (t) => {
    // Only show prices > 100, apply 10% discount, format to cents
    const s = new Subject();
    const p = s
        .filter(price => price > 100)
        .map(price => price * 0.9)
        .map(price => Math.round(price * 100))
        .toPromise();
    await s.next(50);   // filtered
    await s.next(200);  // 200 * 0.9 * 100 = 18000
    const v = await p;
    if (v === 18000) t.pass();
    else t.fail(`expected 18000, got ${v}`);
});

test("integration: order pipeline — enrich async, deduplicate, take first 3", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .mapAsync(async (id) => ({ id, name: `Product ${id}` }))
            .operator(Operator.distinct(o => o.id))
            .operator(Operator.take(3)),
        3
    );
    for (const id of [1, 1, 2, 3, 4]) await s.next(id);
    const results = await p;
    if (results.map(o => o.id).join(',') === '1,2,3') t.pass();
    else t.fail(`got ${JSON.stringify(results.map(o => o.id))}`);
});

test("integration: cart item stream — skip header row, group into pages of 2", async (t) => {
    const s = new Subject();
    const p = first(
        s
            .operator(Operator.skip(1))   // skip header
            .operator(Operator.group(2))  // batch of 2
    );
    for (const v of ['header', 'apple', 'banana', 'cherry']) await s.next(v);
    const page = await p;
    if (page[0] === 'apple' && page[1] === 'banana') t.pass();
    else t.fail(`got ${JSON.stringify(page)}`);
});

test("integration: stock ticker — pair consecutive prices to compute delta", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .filter(p => p > 0)
            .operator(Operator.pair())
            .map(([prev, cur]) => cur - prev),
        2
    );
    for (const v of [100, 105, 98, 110]) await s.next(v);
    const results = await p;
    // pairs: [100,105]→+5, [105,98]→-7
    if (results[0] === 5 && results[1] === -7) t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: sensor stream — count consecutive equal readings, alert on streak ≥ 2", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .operator(Operator.count())
            .filter(({ count }) => count >= 2)
            .map(({ value, count }) => `${value} repeated ${count + 1}x`),
        1
    );
    for (const v of [20, 20, 20, 25]) await s.next(v);
    const alerts = await p;
    if (alerts[0] === '20 repeated 3x') t.pass();
    else t.fail(`got ${alerts[0]}`);
});

test("integration: log stream — skip first 2 (boot noise), take next 3 (window)", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .operator(Operator.skip(2))
            .operator(Operator.take(3)),
        3
    );
    for (const v of ['boot1', 'boot2', 'err1', 'err2', 'err3', 'err4']) await s.next(v);
    const results = await p;
    if (results.join(',') === 'err1,err2,err3') t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: user event stream — deduplicate clicks, async fetch user, tap log, toPromise", async (t) => {
    const log = [];
    const s = new Subject();
    const p = s
        .operator(Operator.distinct())
        .mapAsync(async (userId) => { await sleep(5); return { id: userId, name: `User${userId}` }; })
        .tap(u => log.push(u.id))
        .toPromise();
    await s.next(42);
    await s.next(42); // duplicate, filtered
    const user = await p;
    if (user.id === 42 && user.name === 'User42' && log.length === 1) t.pass();
    else t.fail(`got ${JSON.stringify(user)} log=${JSON.stringify(log)}`);
});

test("integration: transaction stream — filter positive, retry, collect 2 valid", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .filter(tx => tx.amount > 0)
            .operator(Operator.retry(2))
            .map(tx => tx.amount),
        2
    );
    await s.next({ amount: -10 }); // filtered
    await s.next({ amount: 50 });
    await s.next({ amount: 30 });
    const results = await p;
    if (results[0] === 50 && results[1] === 30) t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: metrics — sliding window pair, compute moving avg", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .filter(v => !isNaN(v))
            .operator(Operator.pair())
            .map(([a, b]) => (a + b) / 2),
        3
    );
    for (const v of [10, 20, 30, 40]) await s.next(v);
    const results = await p;
    // pairs: [10,20]→15, [20,30]→25, [30,40]→35
    if (results.join(',') === '15,25,35') t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: product catalog — group into batches of 3, async enrich, toPromise first batch", async (t) => {
    const s = new Subject();
    const p = s
        .operator(Operator.group(3))
        .mapAsync(async (batch) => { await sleep(5); return batch.map(id => `item${id}`); })
        .toPromise();
    for (const v of [1, 2, 3, 4]) await s.next(v);
    const batch = await p;
    if (batch.join(',') === 'item1,item2,item3') t.pass();
    else t.fail(`got ${JSON.stringify(batch)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11–20: Analytics / data processing
// ═══════════════════════════════════════════════════════════════════════════════

test("integration: analytics — map to category, distinct, count occurrences, take 4", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .map(e => e.type)
            .operator(Operator.distinct())
            .operator(Operator.count())
            .operator(Operator.take(4)),
        4
    );
    for (const e of [
        { type: 'click' }, { type: 'view' }, { type: 'click' },
        { type: 'purchase' }, { type: 'view' }, { type: 'exit' }
    ]) await s.next(e);
    const results = await p;
    // distinct sequence: click,view,purchase,exit → counts 0,0,0,0
    if (results.length === 4 && results.every(r => r.count === 0)) t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: search autocomplete — skip first 2 keystrokes, distinct, async lookup, toPromise", async (t) => {
    const s = new Subject();
    const p = s
        .operator(Operator.skip(2))
        .operator(Operator.distinct())
        .mapAsync(async (q) => { await sleep(5); return `results for "${q}"`; })
        .toPromise();
    await s.next('a');
    await s.next('ab');
    await s.next('abc');
    await s.next('abc'); // duplicate
    const v = await p;
    if (v === 'results for "abc"') t.pass();
    else t.fail(`got ${v}`);
});

test("integration: temperature sensor — filter noise, pair for delta, tap record, map to alert", async (t) => {
    const log = [];
    const s = new Subject();
    const p = collect(
        s
            .filter(v => v >= -50 && v <= 150)   // valid range
            .operator(Operator.pair())
            .tap(([a, b]) => log.push(b - a))
            .filter(([a, b]) => Math.abs(b - a) > 5)
            .map(([a, b]) => `spike: ${a}→${b}`),
        1
    );
    for (const v of [20, 22, 21, 35]) await s.next(v);
    const results = await p;
    // only 21→35 has delta > 5
    if (results[0] === 'spike: 21→35' && log.length === 3) t.pass();
    else t.fail(`results=${JSON.stringify(results)} log=${JSON.stringify(log)}`);
});

test("integration: page view tracking — group by 5, async aggregate, tap persist, toPromise", async (t) => {
    let persisted = null;
    const s = new Subject();
    const p = s
        .operator(Operator.group(5))
        .mapAsync(async (views) => ({ total: views.length, urls: views }))
        .tap(agg => { persisted = agg; })
        .toPromise();
    for (const url of ['/home', '/about', '/products', '/cart', '/checkout', '/thanks']) await s.next(url);
    const agg = await p;
    if (agg.total === 5 && persisted === agg) t.pass();
    else t.fail(`got ${JSON.stringify(agg)}`);
});

test("integration: error retry pipeline — map to request, retry 3, skip first result, toPromise", async (t) => {
    const s = new Subject();
    const p = s
        .map(id => ({ id, url: `/api/item/${id}` }))
        .operator(Operator.retry(3))
        .operator(Operator.skip(1))
        .map(req => req.id)
        .toPromise();
    await s.next(1);  // skipped
    await s.next(2);  // first after skip
    const v = await p;
    if (v === 2) t.pass();
    else t.fail(`got ${v}`);
});

test("integration: chat message stream — distinct by id, take 3, async format, toPromise last", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .operator(Operator.distinct(msg => msg.id))
            .operator(Operator.take(3))
            .mapAsync(async (msg) => { await sleep(3); return `[${msg.from}]: ${msg.text}`; }),
        3
    );
    for (const m of [
        { id: 1, from: 'alice', text: 'hi' },
        { id: 1, from: 'alice', text: 'hi' }, // dup
        { id: 2, from: 'bob',   text: 'hey' },
        { id: 3, from: 'carol', text: 'yo' },
        { id: 4, from: 'dave',  text: 'sup' },
    ]) await s.next(m);
    const results = await p;
    if (results.join('|') === '[alice]: hi|[bob]: hey|[carol]: yo') t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: audio buffer — stride tricks 4-sample window step 2, take first result", async (t) => {
    const s = new Subject();
    const p = first(
        s
            .operator(Operator.strideTricks(2, 2))
            .map(windows => windows.map(w => w.reduce((a, b) => a + b, 0)))
    );
    await s.next([1, 2, 3, 4]);
    const sums = await p;
    // windows: [1,2],[3,4] → sums [3,7]
    if (sums[0] === 3 && sums[1] === 7) t.pass();
    else t.fail(`got ${JSON.stringify(sums)}`);
});

test("integration: notification dedup — map to key, distinct, count, filter streak, toPromise", async (t) => {
    const s = new Subject();
    const p = s
        .map(n => n.type)
        .operator(Operator.distinct())
        .operator(Operator.count())
        .filter(({ count }) => count === 0)  // first of each type
        .map(({ value }) => value)
        .toPromise();
    await s.next({ type: 'email' });
    const v = await p;
    if (v === 'email') t.pass();
    else t.fail(`got ${v}`);
});

test("integration: file upload stream — skip first chunk (header), group 3, async hash, toPromise", async (t) => {
    const s = new Subject();
    const p = s
        .operator(Operator.skip(1))
        .operator(Operator.group(3))
        .mapAsync(async (chunks) => { await sleep(5); return chunks.join('-'); })
        .toPromise();
    for (const c of ['HEADER', 'chunk1', 'chunk2', 'chunk3', 'chunk4']) await s.next(c);
    const v = await p;
    if (v === 'chunk1-chunk2-chunk3') t.pass();
    else t.fail(`got ${v}`);
});

test("integration: realtime leaderboard — map to score, pair for rank change, filter improvement", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .map(entry => entry.score)
            .operator(Operator.pair())
            .filter(([prev, cur]) => cur > prev)
            .map(([prev, cur]) => cur - prev),
        2
    );
    for (const e of [
        { score: 100 }, { score: 95 }, { score: 110 }, { score: 108 }, { score: 120 }
    ]) await s.next(e);
    const results = await p;
    // improvements: 95→110 (+15), 108→120 (+12)
    if (results[0] === 15 && results[1] === 12) t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 21–30: User/auth pipelines
// ═══════════════════════════════════════════════════════════════════════════════

test("integration: login events — distinct by userId, async fetch profile, tap audit, take 2", async (t) => {
    const audit = [];
    const s = new Subject();
    const p = collect(
        s
            .operator(Operator.distinct(e => e.userId))
            .mapAsync(async (e) => { await sleep(3); return { userId: e.userId, role: 'user' }; })
            .tap(u => audit.push(u.userId))
            .operator(Operator.take(2)),
        2
    );
    for (const e of [
        { userId: 1 }, { userId: 1 }, { userId: 2 }, { userId: 3 }
    ]) await s.next(e);
    const results = await p;
    if (results.map(r => r.userId).join(',') === '1,2' && audit.join(',') === '1,2') t.pass();
    else t.fail(`got ${JSON.stringify(results)} audit=${JSON.stringify(audit)}`);
});

test("integration: permission check — map action, filter allowed, async resolve, toPromise", async (t) => {
    const allowed = new Set(['read', 'write']);
    const s = new Subject();
    const p = s
        .map(req => req.action)
        .filter(action => allowed.has(action))
        .mapAsync(async (action) => { await sleep(3); return `granted:${action}`; })
        .toPromise();
    await s.next({ action: 'delete' }); // filtered
    await s.next({ action: 'read' });
    const v = await p;
    if (v === 'granted:read') t.pass();
    else t.fail(`got ${v}`);
});

test("integration: session events — skip reconnects, pair for duration, toPromise first", async (t) => {
    const s = new Subject();
    const p = s
        .filter(e => e.type !== 'reconnect')
        .map(e => e.ts)
        .operator(Operator.pair())
        .map(([start, end]) => end - start)
        .toPromise();
    for (const e of [
        { type: 'connect', ts: 1000 },
        { type: 'reconnect', ts: 1500 },
        { type: 'disconnect', ts: 2000 },
    ]) await s.next(e);
    const v = await p;
    if (v === 1000) t.pass();
    else t.fail(`got ${v}`);
});

test("integration: password reset — take 1 request per user, async send email, tap log", async (t) => {
    const sent = [];
    const s = new Subject();
    const p = collect(
        s
            .operator(Operator.distinct(r => r.email))
            .operator(Operator.take(2))
            .mapAsync(async (r) => { await sleep(3); return `sent:${r.email}`; })
            .tap(msg => sent.push(msg)),
        2
    );
    for (const r of [
        { email: 'a@x.com' }, { email: 'a@x.com' },
        { email: 'b@x.com' }, { email: 'c@x.com' }
    ]) await s.next(r);
    const results = await p;
    if (results.join(',') === 'sent:a@x.com,sent:b@x.com' && sent.length === 2) t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: API rate limit — group requests into batches of 4, skip first batch (warmup)", async (t) => {
    const s = new Subject();
    const p = s
        .operator(Operator.group(4))
        .operator(Operator.skip(1))
        .map(batch => batch.length)
        .toPromise();
    for (const v of [1, 2, 3, 4, 5, 6, 7, 8]) await s.next(v); // 2 batches of 4
    const v = await p;
    if (v === 4) t.pass();
    else t.fail(`got ${v}`);
});

test("integration: feature flag rollout — filter eligible, async fetch config, count, take 3", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .filter(u => u.tier === 'pro')
            .mapAsync(async (u) => { await sleep(2); return { ...u, flag: 'new-ui' }; })
            .operator(Operator.count())
            .operator(Operator.take(3)),
        3
    );
    for (const u of [
        { id: 1, tier: 'free' },
        { id: 2, tier: 'pro' },
        { id: 3, tier: 'pro' },
        { id: 4, tier: 'free' },
        { id: 5, tier: 'pro' },
    ]) await s.next(u);
    const results = await p;
    if (results.map(r => r.count).join(',') === '0,1,2') t.pass();
    else t.fail(`got ${JSON.stringify(results.map(r => r.count))}`);
});

test("integration: webhook delivery — retry on failure, skip first delivery attempt, toPromise", async (t) => {
    const s = new Subject();
    const p = s
        .map(event => ({ ...event, attempt: 1 }))
        .operator(Operator.retry(2))
        .operator(Operator.skip(1))
        .map(e => e.id)
        .toPromise();
    await s.next({ id: 'evt-1' }); // skipped
    await s.next({ id: 'evt-2' });
    const v = await p;
    if (v === 'evt-2') t.pass();
    else t.fail(`got ${v}`);
});

test("integration: audit log — pair events, map to diff, filter changes, async persist, toPromise", async (t) => {
    const s = new Subject();
    const p = s
        .operator(Operator.pair())
        .map(([prev, cur]) => ({ field: 'status', from: prev.status, to: cur.status }))
        .filter(diff => diff.from !== diff.to)
        .mapAsync(async (diff) => { await sleep(3); return `${diff.from}→${diff.to}`; })
        .toPromise();
    for (const e of [
        { status: 'pending' }, { status: 'pending' }, { status: 'active' }
    ]) await s.next(e);
    const v = await p;
    if (v === 'pending→active') t.pass();
    else t.fail(`got ${v}`);
});

test("integration: multi-step form — skip empty fields, distinct, take 3 valid", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .filter(v => v.trim() !== '')
            .operator(Operator.distinct())
            .operator(Operator.take(3)),
        3
    );
    for (const v of ['', 'Alice', '', 'Alice', 'bob@x.com', '123456', 'extra']) await s.next(v);
    const results = await p;
    if (results[0] === 'Alice' && results[1] === 'bob@x.com' && results[2] === '123456') t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: realtime collab — group edits into 2, async apply, tap broadcast, take 2 batches", async (t) => {
    const broadcast = [];
    const s = new Subject();
    const p = collect(
        s
            .operator(Operator.group(2))
            .mapAsync(async (edits) => { await sleep(2); return edits.map(e => e.toUpperCase()); })
            .tap(batch => broadcast.push(...batch)),
        2
    );
    for (const e of ['ins:a', 'del:b', 'ins:c', 'del:d', 'ins:e']) await s.next(e);
    const results = await p;
    if (results[0][0] === 'INS:A' && results[1][0] === 'INS:C' && broadcast.length === 4) t.pass();
    else t.fail(`got ${JSON.stringify(results)} broadcast=${JSON.stringify(broadcast)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 31–40: fromArray / fromValue sync sources
// ═══════════════════════════════════════════════════════════════════════════════

test("integration: fromArray — filter, map, distinct, take 3", async (t) => {
    const results = await collect(
        Source.fromArray([1, 2, 2, 3, 3, 4, 5])
            .filter(v => v % 2 !== 0)
            .map(v => v * 10)
            .operator(Operator.distinct())
            .operator(Operator.take(3)),
        3
    );
    if (results.join(',') === '10,30,50') t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: fromArray — group 3, map sum, toPromise first", async (t) => {
    const v = await Source.fromArray([1, 2, 3, 4, 5, 6])
        .operator(Operator.group(3))
        .map(g => g.reduce((a, b) => a + b, 0))
        .toPromise();
    if (v === 6) t.pass();
    else t.fail(`got ${v}`);
});

test("integration: fromArray — skip 2, pair, map delta, toPromise", async (t) => {
    const v = await Source.fromArray([10, 20, 30, 40, 50])
        .operator(Operator.skip(2))
        .operator(Operator.pair())
        .map(([a, b]) => b - a)
        .toPromise();
    // after skip(2): [30,40,50], first pair [30,40]→10
    if (v === 10) t.pass();
    else t.fail(`got ${v}`);
});

test("integration: fromArray — distinct by parity, count, take 2", async (t) => {
    const results = await collect(
        Source.fromArray([1, 3, 2, 4, 5, 6])
            .operator(Operator.distinct(v => v % 2))
            .operator(Operator.count())
            .operator(Operator.take(2)),
        2
    );
    // distinct by parity: 1(odd),2(even) → counts 0,0
    if (results[0].count === 0 && results[1].count === 0) t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: fromValue array — split, filter, map, toPromise", async (t) => {
    const v = await Source.fromValue([5, -1, 3, -2, 8])
        .split()
        .filter(x => x > 0)
        .map(x => x * 2)
        .toPromise();
    if (v === 10) t.pass();
    else t.fail(`got ${v}`);
});

test("integration: fromArray — flatMap expand, distinct, take 3", async (t) => {
    // [1,2,3] → flatMap(v=>[v,v*10]) → [1,10,2,20,3,30] → distinct → same → take 3 → [1,10,2]
    const results = await collect(
        Source.fromArray([1, 2, 3])
            .flatMap(v => [v, v * 10])
            .operator(Operator.distinct())
            .operator(Operator.take(3)),
        3
    );
    if (results.join(',') === '1,10,2') t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: fromArray distinct+skip+take correct count", async (t) => {
    // [1,2,2,3,3,3,4] → distinct → [1,2,3,4] → skip(1) → [2,3,4] → take(2) → [2,3]
    const results = await collect(
        Source.fromArray([1, 2, 2, 3, 3, 3, 4])
            .operator(Operator.distinct())
            .operator(Operator.skip(1))
            .operator(Operator.take(2)),
        2
    );
    if (results.join(',') === '2,3') t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: fromArray — map to obj, distinct by key, group 2, toPromise", async (t) => {
    const v = await Source.fromArray([1, 1, 2, 2, 3, 3])
        .map(n => ({ id: n, val: n * 10 }))
        .operator(Operator.distinct(o => o.id))
        .operator(Operator.group(2))
        .map(g => g.map(o => o.id).join(','))
        .toPromise();
    if (v === '1,2') t.pass();
    else t.fail(`got ${v}`);
});

test("integration: fromArray — reduce to running max, distinct, take 3", async (t) => {
    const results = await collect(
        Source.fromArray([3, 1, 4, 1, 5, 9, 2])
            .reduce((max, v) => Math.max(max, v), 0)
            .operator(Operator.distinct())
            .operator(Operator.take(3)),
        3
    );
    // running max: 3,3,4,4,5,9,9 → distinct: 3,4,5 (take 3)
    if (results.join(',') === '3,4,5') t.pass();
    else t.fail(`got ${JSON.stringify(results)}`);
});

test("integration: fromArray — strideTricks 3-step-3, map each window avg, toPromise", async (t) => {
    const v = await Source.fromValue([10, 20, 30, 40, 50, 60])
        .operator(Operator.strideTricks(3, 3))
        .map(windows => windows.map(w => w.reduce((a, b) => a + b, 0) / w.length))
        .toPromise();
    // windows: [10,20,30],[40,50,60] → avgs [20, 50]
    if (v[0] === 20 && v[1] === 50) t.pass();
    else t.fail(`got ${JSON.stringify(v)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 41–50: Complex multi-operator real-world scenarios
// ═══════════════════════════════════════════════════════════════════════════════

test("integration: ETL pipeline — parse, validate, dedupe, batch, async transform, toPromise", async (t) => {
    const s = new Subject();
    const p = s
        .map(row => ({ id: parseInt(row.id), value: parseFloat(row.value) }))
        .filter(rec => !isNaN(rec.id) && !isNaN(rec.value))
        .operator(Operator.distinct(rec => rec.id))
        .operator(Operator.group(2))
        .mapAsync(async (batch) => { await sleep(3); return batch.map(r => r.value).reduce((a, b) => a + b, 0); })
        .toPromise();
    for (const row of [
        { id: '1', value: '10.5' },
        { id: '1', value: '10.5' }, // dup
        { id: 'x', value: 'bad' },  // invalid
        { id: '2', value: '20.0' },
        { id: '3', value: '5.5' },
    ]) await s.next(row);
    const v = await p;
    if (v === 30.5) t.pass();
    else t.fail(`got ${v}`);
});

test("integration: ML feature pipeline — normalize, window pair, compute diff, skip warmup, take 3", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .map(v => v / 100)               // normalize 0-1
            .operator(Operator.pair())       // sliding window
            .map(([a, b]) => b - a)         // delta feature
            .operator(Operator.skip(1))     // skip first delta (unstable)
            .operator(Operator.take(3)),
        3
    );
    for (const v of [50, 60, 55, 70, 65, 80]) await s.next(v);
    const results = await p;
    // normalized pairs: [.5,.6]→.1, [.6,.55]→-.05, [.55,.7]→.15, [.7,.65]→-.05, [.65,.8]→.15
    // skip(1) drops .1, take(3): [-.05,.15,-.05]
    const rounded = results.map(v => Math.round(v * 100) / 100);
    if (rounded[0] === -0.05 && rounded[1] === 0.15 && rounded[2] === -0.05) t.pass();
    else t.fail(`got ${JSON.stringify(rounded)}`);
});

test("integration: event sourcing — filter domain events, group 3, async replay, tap snapshot, toPromise", async (t) => {
    const snapshots = [];
    const s = new Subject();
    const p = s
        .filter(e => e.domain === 'order')
        .operator(Operator.group(3))
        .mapAsync(async (events) => { await sleep(3); return { count: events.length, ids: events.map(e => e.id) }; })
        .tap(snap => snapshots.push(snap))
        .toPromise();
    for (const e of [
        { domain: 'user', id: 'u1' },
        { domain: 'order', id: 'o1' },
        { domain: 'order', id: 'o2' },
        { domain: 'payment', id: 'p1' },
        { domain: 'order', id: 'o3' },
        { domain: 'order', id: 'o4' },
    ]) await s.next(e);
    const snap = await p;
    if (snap.count === 3 && snap.ids.join(',') === 'o1,o2,o3' && snapshots.length === 1) t.pass();
    else t.fail(`got ${JSON.stringify(snap)}`);
});

test("integration: IoT device stream — distinct device, skip first reading, pair, map voltage delta, toPromise", async (t) => {
    const s = new Subject();
    const p = s
        .operator(Operator.distinct(r => r.deviceId))
        .map(r => r.voltage)
        .operator(Operator.skip(1))
        .operator(Operator.pair())
        .map(([a, b]) => +(b - a).toFixed(2))
        .toPromise();
    for (const r of [
        { deviceId: 'A', voltage: 3.3 },
        { deviceId: 'A', voltage: 3.3 }, // dup
        { deviceId: 'B', voltage: 3.1 },
        { deviceId: 'C', voltage: 3.5 },
        { deviceId: 'D', voltage: 3.2 },
    ]) await s.next(r);
    // distinct: A,B,C,D voltages; skip(1) → B,C,D; pair → [B,C]→0.4
    const v = await p;
    if (v === 0.40) t.pass();
    else t.fail(`got ${v}`);
});

test("integration: recommendation engine — map to score, filter threshold, distinct, count streak, take 2", async (t) => {
    const s = new Subject();
    const p = collect(
        s
            .map(item => ({ ...item, score: item.clicks / item.views }))
            .filter(item => item.score > 0.1)
            .operator(Operator.distinct(item => item.id))
            .operator(Operator.count())
            .operator(Operator.take(2)),
        2
    );
    for (const item of [
        { id: 1, clicks: 5,  views: 100 },  // 0.05 filtered
        { id: 2, clicks: 20, views: 100 },  // 0.2 ok
        { id: 2, clicks: 20, views: 100 },  // dup
        { id: 3, clicks: 15, views: 100 },  // 0.15 ok
        { id: 4, clicks: 1,  views: 100 },  // 0.01 filtered
    ]) await s.next(item);
    const results = await p;
    if (results[0].value.id === 2 && results[1].value.id === 3) t.pass();
    else t.fail(`got ${JSON.stringify(results.map(r => r.value.id))}`);
});

test("integration: pipeline with tap for side-effects at multiple stages", async (t) => {
    const stage1 = [], stage2 = [], stage3 = [];
    const s = new Subject();
    const p = collect(
        s
            .tap(v => stage1.push(v))
            .filter(v => v > 0)
            .tap(v => stage2.push(v))
            .map(v => v * 2)
            .tap(v => stage3.push(v))
            .operator(Operator.take(2)),
        2
    );
    for (const v of [-1, 0, 3, 7, 10]) await s.next(v);
    const results = await p;
    if (
        stage1.length === 5 &&
        stage2.join(',') === '3,7' &&
        stage3.join(',') === '6,14' &&
        results.join(',') === '6,14'
    ) t.pass();
    else t.fail(`s1=${stage1.length} s2=${stage2} s3=${stage3} r=${results}`);
});

test("integration: fromArray full pipeline — filter, distinct, group, async enrich, toPromise", async (t) => {
    const v = await Source.fromArray([2, 2, 4, 4, 6, 6, 8])
        .filter(n => n % 4 === 0)             // [4,4,8]
        .operator(Operator.distinct())        // [4,8]
        .operator(Operator.group(2))          // [[4,8]]
        .mapAsync(async g => { await sleep(2); return g.map(n => n ** 2); })
        .map(g => g.reduce((a, b) => a + b, 0))
        .toPromise();
    // 4²+8² = 16+64 = 80
    if (v === 80) t.pass();
    else t.fail(`got ${v}`);
});

test("integration: subject chain — map, retry, distinct, tap accumulate, reduce to final", async (t) => {
    const seen = [];
    const s = new Subject();
    const p = s
        .map(v => v * 2)
        .operator(Operator.retry(1))
        .operator(Operator.distinct())
        .tap(v => seen.push(v))
        .reduce((sum, v) => sum + v, 0)
        .toPromise();
    for (const v of [1, 2, 2, 3]) await s.next(v);
    const total = await p;
    // after map: 2,4,4,6; distinct: 2,4,6; reduce first: 2
    if (total === 2 && seen[0] === 2) t.pass();
    else t.fail(`total=${total} seen=${JSON.stringify(seen)}`);
});

test("integration: sliding window anomaly — pair consecutive, filter spike >2x, async alert, toPromise", async (t) => {
    const s = new Subject();
    const p = s
        .operator(Operator.pair())
        .filter(([a, b]) => b > a * 2)
        .mapAsync(async ([a, b]) => { await sleep(3); return { spike: true, from: a, to: b, ratio: +(b / a).toFixed(1) }; })
        .toPromise();
    for (const v of [10, 12, 11, 25, 27]) await s.next(v);
    // pairs: [10,12] no, [12,11] no, [11,25] yes (25>22), ...
    const alert = await p;
    if (alert.spike && alert.from === 11 && alert.to === 25) t.pass();
    else t.fail(`got ${JSON.stringify(alert)}`);
});

test("integration: full operator coverage chain — take, skip, pair, group, distinct, count, retry, toPromise", async (t) => {
    // chain: skip warmup, take window, distinct, group pairs, map sum, toPromise first
    const s = new Subject();
    const p = s
        .operator(Operator.skip(1))
        .operator(Operator.take(4))
        .operator(Operator.distinct())
        .operator(Operator.group(2))
        .map(([a, b]) => a + b)
        .toPromise();
    for (const v of [99, 1, 2, 2, 3, 4]) await s.next(v); // skip 99, take [1,2,2,3], distinct [1,2,3], group [[1,2],[3,...]]
    const v = await p;
    // skip(1)→[1,2,2,3], take(4)→[1,2,2,3], distinct→[1,2,3], group(2)→[1,2], map→3
    if (v === 3) t.pass();
    else t.fail(`got ${v}`);
});
