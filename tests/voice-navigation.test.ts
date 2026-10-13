import { describe, expect, it } from "vitest";
import {
  isVoiceDestination,
  voiceHistory,
  type VoicePage,
} from "../src/lib/voice-navigation";

describe("voice page navigation", () => {
  it("returns from a preview to its actual origin without duplicate history", () => {
    let history: VoicePage[] = ["inventory"];
    history = voiceHistory(history, "fitting");
    history = voiceHistory(history, "fitting");
    expect(history).toEqual(["inventory", "fitting"]);
    expect(voiceHistory(history, "back")).toEqual(["inventory"]);
    expect(voiceHistory(["stylist"], "back")).toEqual(["stylist"]);
    expect(voiceHistory([], "back")).toEqual(["stylist"]);
  });
  it("preserves the starting screen across long journeys and named destinations", () => {
    let history: VoicePage[] = ["stylist"];
    for (let i = 0; i < 40; i++)
      history = voiceHistory(history, i % 2 ? "inventory" : "wardrobe");
    expect(history).toHaveLength(20);
    expect(voiceHistory(history, "origin")).toEqual(["stylist"]);
    expect(voiceHistory(["stylist", "fitting"], "profile")).toEqual([
      "stylist",
      "fitting",
      "profile",
    ]);
  });
  it("rejects URLs, prototype keys and actions as destinations", () => {
    for (const target of [
      "https://example.com",
      "/admin",
      "__proto__",
      "constructor",
      "buy",
      null,
      {},
    ])
      expect(isVoiceDestination(target)).toBe(false);
    for (const target of ["stylist", "wardrobe", "fitting", "back", "origin"])
      expect(isVoiceDestination(target)).toBe(true);
  });
});
