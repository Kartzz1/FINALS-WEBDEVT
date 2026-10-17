import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAreaQuery, buildBoundaryCheckQuery, createOsmProvider } from "../src/services/providers/osmOverpass.js";

const AREA = { key: "lipa", city: "Lipa City", province: "Batangas", osmName: "Lipa", adminLevel: 6 };
const ENDPOINT = "https://overpass.test/api/interpreter";

function fakeFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const impl = async (url, options) => {
    calls.push({ url, options });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return { status: next.status ?? 200, ok: (next.status ?? 200) < 400, json: async () => next.body ?? { elements: [] } };
  };
  return { impl, calls };
}

const provider = (fetchImpl, overrides = {}) =>
  createOsmProvider({ endpoints: [ENDPOINT], userAgent: "TestAgent/1.0", amenities: ["restaurant", "cafe"], fetchImpl, sleep: async () => {}, retries: 2, ...overrides });

const element = (id, name) => ({ type: "node", id, lat: 13.9, lon: 121.1, tags: { amenity: "restaurant", name } });

describe("Overpass query", () => {
  it("searches inside the city boundary inside the province", () => {
    const query = buildAreaQuery(AREA, ["restaurant", "cafe"]);
    assert.match(query, /\[out:json\]/);
    assert.match(query, /area\["boundary"="administrative"\]\["admin_level"="4"\]\["name"="Batangas"\]->\.province;/);
    assert.match(query, /rel\(area\.province\)\["boundary"="administrative"\]\["admin_level"="6"\]\["name"="Lipa"\];/);
    assert.match(query, /map_to_area->\.city;/);
    assert.match(query, /nwr\["amenity"~"\^\(restaurant\|cafe\)\$"\]\["name"\]\(area\.city\);/);
    assert.match(query, /out center;/);
  });

  it("only allows known amenity types, so nothing else can reach the query", () => {
    assert.throws(() => buildAreaQuery(AREA, ['restaurant"]; evil;']), /No valid amenity/);
    assert.doesNotMatch(buildAreaQuery(AREA, ["restaurant", "bad|value"]), /bad/);
  });

  it("escapes quotes in place names", () => {
    const query = buildBoundaryCheckQuery({ ...AREA, osmName: 'Odd "Name"' });
    assert.match(query, /\["name"="Odd \\"Name\\""\]/);
  });
});

describe("Overpass provider", () => {
  it("posts the query politely and normalizes what comes back", async () => {
    const { impl, calls } = fakeFetch([{ body: { elements: [element(1, "Fixture One"), { type: "node", id: 2, lat: 1, lon: 1, tags: { amenity: "restaurant" } }] } }]);
    const result = await provider(impl).fetchArea(AREA);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.skipped, 1);
    assert.equal(result.candidates[0].externalPlaceId, "osm:node/1");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["User-Agent"], "TestAgent/1.0");
    assert.match(decodeURIComponent(calls[0].options.body), /^data=\[out:json\]/);
  });

  it("waits and retries when the server says it is busy", async () => {
    const { impl, calls } = fakeFetch([{ status: 429 }, { status: 504 }, { body: { elements: [element(1, "Fixture One")] } }]);
    const result = await provider(impl).fetchArea(AREA);
    assert.equal(result.candidates.length, 1);
    assert.equal(calls.length, 3);
  });

  it("gives up after the retries and reports why", async () => {
    const { impl } = fakeFetch([{ status: 429 }, { status: 429 }, { status: 429 }]);
    await assert.rejects(provider(impl).fetchArea(AREA), /busy \(HTTP 429\)/);
  });

  it("tries the fallback server when the first keeps failing", async () => {
    const calls = [];
    const impl = async (url) => {
      calls.push(url);
      if (url === ENDPOINT) throw new Error("connection refused");
      return { status: 200, ok: true, json: async () => ({ elements: [element(1, "Fixture One")] }) };
    };
    const result = await provider(impl, { endpoints: [ENDPOINT, "https://backup.test/api"], retries: 0 }).fetchArea(AREA);
    assert.equal(result.candidates.length, 1);
    assert.deepEqual(calls, [ENDPOINT, "https://backup.test/api"]);
  });

  it("does not retry a rejected query", async () => {
    const { impl, calls } = fakeFetch([{ status: 400 }]);
    await assert.rejects(provider(impl).fetchArea(AREA), /rejected the query/);
    assert.equal(calls.length, 1);
  });

  it("reports an Overpass runtime error returned with HTTP 200", async () => {
    const { impl } = fakeFetch([{ body: { remark: "runtime error: Query timed out", elements: [] } }]);
    await assert.rejects(provider(impl).fetchArea(AREA), /Query timed out/);
  });

  it("keeps partial results but flags them", async () => {
    const { impl } = fakeFetch([{ body: { remark: "runtime remark", elements: [element(1, "Fixture One")] } }]);
    assert.equal((await provider(impl).fetchArea(AREA)).partial, true);
  });

  it("tells a missing boundary apart from a place with no restaurants", async () => {
    const missing = fakeFetch([{ body: { elements: [] } }, { body: { elements: [] } }]);
    await assert.rejects(provider(missing.impl).fetchArea(AREA), /Could not find the OpenStreetMap boundary "Lipa"/);
    const empty = fakeFetch([{ body: { elements: [] } }, { body: { elements: [{ type: "relation", id: 9 }] } }]);
    assert.deepEqual((await provider(empty.impl).fetchArea(AREA)).candidates, []);
  });
});
