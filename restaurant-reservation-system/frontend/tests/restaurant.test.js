import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeTables, formatLocation, mapEmbedUrl, parseOpeningHours, phoneLink } from "../src/utils/restaurant.js";

describe("opening hours", () => {
  it("reads the common simple forms", () => {
    assert.deepEqual(parseOpeningHours("Mo-Su 10:00-22:00"), [{ days: "Every day", hours: "10:00 AM to 10:00 PM" }]);
    assert.deepEqual(parseOpeningHours("Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off"), [
      { days: "Mon to Fri", hours: "9:00 AM to 6:00 PM" },
      { days: "Sat", hours: "10:00 AM to 2:00 PM" },
      { days: "Sun", hours: "Closed" },
    ]);
    assert.deepEqual(parseOpeningHours("Mo,We,Fr 08:00-12:00, 13:00-17:00"), [
      { days: "Mon, Wed, Fri", hours: "8:00 AM to 12:00 PM, 1:00 PM to 5:00 PM" },
    ]);
  });

  it("handles midnight, noon, and times without days", () => {
    assert.equal(parseOpeningHours("00:00-12:00")[0].hours, "12:00 AM to 12:00 PM");
    assert.equal(parseOpeningHours("24/7")[0].hours, "Open 24 hours");
  });

  it("returns null for anything it cannot read, so the original text is shown instead", () => {
    for (const text of ["Mo-Su sunrise-sunset", "Mo-Fr 09:00-18:00; PH off", "by appointment", "", null, undefined, "Xx 10:00-12:00"]) {
      assert.equal(parseOpeningHours(text), null, String(text));
    }
  });
});

describe("restaurant display helpers", () => {
  it("joins the parts of a location and skips missing ones", () => {
    assert.equal(formatLocation({ barangay: "Fixture", city: "Lipa City", province: "Batangas" }), "Fixture, Lipa City, Batangas");
    assert.equal(formatLocation({ city: "Lipa City" }), "Lipa City");
    assert.equal(formatLocation({}), "");
  });

  it("describes tables honestly, including when none are set up", () => {
    assert.equal(describeTables({ count: 0, seats: 0, capacities: [] }), "Tables not set up for online booking yet");
    assert.equal(describeTables(undefined), "Tables not set up for online booking yet");
    assert.equal(describeTables({ count: 1, seats: 4, capacities: [4] }), "1 table · seats 4");
    assert.equal(describeTables({ count: 5, seats: 20, capacities: [2, 4, 8] }), "5 tables · seats 2 to 8");
  });

  it("makes a phone link from digits only", () => {
    assert.equal(phoneLink("+63 (43) 000-0000"), "tel:+63430000000");
    assert.equal(phoneLink("call us"), null);
  });

  it("builds an OpenStreetMap embed centred on the marker", () => {
    const url = mapEmbedUrl(13.94, 121.16);
    assert.match(url, /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=/);
    assert.match(url, /marker=13\.94%2C121\.16$/);
  });
});
