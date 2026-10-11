import { describe, it, expect } from "vitest";
import { money, pollingMilliseconds, terminal } from "../src/lib/utils";
describe("Presentation contracts", () => {
  it("formats INR totals without fractional rupees", () =>
    expect(money(4380)).toBe("₹4,380"));
  it("follows Picker fractional polling durations", () =>
    expect(pollingMilliseconds("3.5s")).toBe(3500));
  it("does not busy-poll malformed durations", () =>
    expect(pollingMilliseconds("bad")).toBe(5000));
  it("stops polling for failed and cancelled jobs", () => {
    expect(terminal("failed")).toBe(true);
    expect(terminal("cancelled")).toBe(true);
    expect(terminal("running")).toBe(false);
  });
});
