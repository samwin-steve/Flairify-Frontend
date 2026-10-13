import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { pcm16ToFloat32, VoicePlayer } from "../src/lib/voice-audio";

describe("native voice audio", () => {
  it("decodes signed little-endian PCM and rejects malformed audio", () => {
    expect([
      ...pcm16ToFloat32(new Uint8Array([0, 128, 0, 0, 255, 127]).buffer),
    ]).toEqual([-1, 0, 32767 / 32768]);
    expect(() => pcm16ToFloat32(new ArrayBuffer(3))).toThrow(
      "Invalid voice audio",
    );
  });

  it.each([44100, 48000])(
    "resamples %iHz microphone input into complete 20ms 16kHz frames",
    (sampleRate) => {
      const frames: Int16Array[] = [];
      let Capture: any;
      const sandbox = {
        sampleRate,
        Int16Array,
        AudioWorkletProcessor: class {
          port = {
            postMessage: (buffer: ArrayBuffer) =>
              frames.push(new Int16Array(buffer)),
          };
        },
        registerProcessor: (_: string, c: any) => {
          Capture = c;
        },
      };
      vm.runInNewContext(
        readFileSync("public/voice-capture.worklet.js", "utf8"),
        sandbox,
      );
      const capture = new Capture();
      for (let remaining = sampleRate; remaining > 0;) {
        const length = Math.min(128, remaining);
        capture.process([[new Float32Array(length).fill(0.5)]]);
        remaining -= length;
      }
      expect(frames).toHaveLength(50);
      expect(
        frames.every((f) => f.length === 320 && f.every((v) => v === 16383)),
      ).toBe(true);
    },
  );

  it("cancels every queued chunk on interruption and resets scheduling", () => {
    const sources: any[] = [];
    const context = {
      currentTime: 2,
      destination: {},
      createBuffer: (_: number, n: number, rate: number) => ({
        duration: n / rate,
        copyToChannel: vi.fn(),
      }),
      createBufferSource: () => {
        const s = {
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
          onended: null,
        };
        sources.push(s);
        return s;
      },
    };
    const player = new VoicePlayer(context as unknown as AudioContext);
    player.play(new ArrayBuffer(48000));
    player.play(new ArrayBuffer(48000));
    expect(player.speaking).toBe(true);
    expect(sources[1].start).toHaveBeenCalledWith(3.025);
    player.stop();
    expect(sources.every((s) => s.stop.mock.calls.length === 1)).toBe(true);
    expect(player.speaking).toBe(false);
    player.play(new ArrayBuffer(480));
    expect(sources[2].start).toHaveBeenCalledWith(2.025);
  });
});
