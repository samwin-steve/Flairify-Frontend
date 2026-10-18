import { expect, it, vi } from "vitest";
import { MediaDownloadQueue } from "../src/lib/media-download-queue";

it("bounds simultaneous image requests and starts the next after completion", async () => {
  const queue = new MediaDownloadQueue(2);
  const controller = new AbortController();
  const releases: Array<() => void> = [];
  let active = 0, peak = 0;
  const requests = Array.from({ length: 8 }, () => queue.run(controller.signal, async () => {
    peak = Math.max(peak, ++active);
    await new Promise<void>((resolve) => releases.push(resolve));
    active--;
  }));
  await vi.waitFor(() => expect(releases).toHaveLength(2));
  for (let i = 0; i < 8; i++) {
    releases[i]();
    if (i < 6) await vi.waitFor(() => expect(releases.length).toBeGreaterThanOrEqual(i + 3));
  }
  await Promise.all(requests);
  expect(peak).toBe(2);
});

it("a cancelled queued image never downloads or blocks the queue", async () => {
  const queue = new MediaDownloadQueue(1);
  let release!: () => void;
  const first = queue.run(new AbortController().signal, () => new Promise<void>((resolve) => { release = resolve; }));
  const controller = new AbortController();
  const load = vi.fn(async () => "old account image");
  const cancelled = queue.run(controller.signal, load);
  const rejected = expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await rejected;
  await vi.waitFor(() => expect(release).toBeDefined());
  release();
  await first;
  await expect(queue.run(new AbortController().signal, async () => "next")).resolves.toBe("next");
  expect(load).not.toHaveBeenCalled();
});

it("a failed download releases its concurrency slot", async () => {
  const queue = new MediaDownloadQueue(1);
  await expect(queue.run(new AbortController().signal, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  await expect(queue.run(new AbortController().signal, async () => "image")).resolves.toBe("image");
});
