import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_MEDIA, MediaCache } from "../src/lib/media-cache";

const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve!: (blob: Blob) => void;
  const promise = new Promise<Blob>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("account-scoped media cache", () => {
  let cache: MediaCache;
  beforeEach(() => {
    vi.useFakeTimers();
    let next = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:test-${++next}`);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    cache = new MediaCache(10, 2, 1000);
    cache.setAccount("a");
  });
  afterEach(() => { cache.setAccount(null); vi.restoreAllMocks(); vi.useRealTimers(); });

  it("deduplicates downloads, preserves URLs on remount and pins active images", async () => {
    const waiting = deferred();
    const load = vi.fn(() => waiting.promise);
    const releaseA = cache.retain("a", "image", false, load);
    const releaseB = cache.retain("a", "image", false, load);
    await tick();
    expect(load).toHaveBeenCalledTimes(1);
    waiting.resolve(new Blob(["photo"]));
    await tick();
    const original = cache.snapshot("a", "image");
    releaseA(); releaseB();
    const releaseC = cache.retain("a", "image", false, load);
    vi.advanceTimersByTime(2000);
    expect(cache.snapshot("a", "image")).toBe(original);
    expect(load).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    releaseC();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(original.url);
    expect(cache.snapshot("a", "image")).toBe(EMPTY_MEDIA);
  });

  it("keeps catalogue and private IDs separate", async () => {
    const load = vi.fn(async () => new Blob(["x"]));
    cache.retain("a", "same", true, load);
    cache.retain("a", "same", false, load);
    await tick();
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.snapshot("a", "same", true).url).not.toBe(cache.snapshot("a", "same").url);
  });

  it("clears on account changes and discards late responses even after switching back", async () => {
    const old = deferred();
    let signal!: AbortSignal;
    cache.retain("a", "image", false, (s) => { signal = s; return old.promise; });
    await tick();
    cache.setAccount("b");
    expect(signal.aborted).toBe(true);
    cache.setAccount("a");
    cache.retain("a", "image", false, async () => new Blob(["new"]));
    await tick();
    const current = cache.snapshot("a", "image");
    old.resolve(new Blob(["old"]));
    await tick();
    expect(cache.snapshot("a", "image")).toBe(current);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    cache.setAccount(null);
    expect(cache.snapshot("a", "image")).toBe(EMPTY_MEDIA);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(current.url);
  });

  it("evicts oldest unused images under memory pressure without revoking active ones", async () => {
    const load = async () => new Blob(["123456"]);
    const release = cache.retain("a", "old", false, load);
    await tick();
    const oldUrl = cache.snapshot("a", "old").url;
    release();
    cache.retain("a", "active", false, load);
    await tick();
    expect(cache.snapshot("a", "old")).toBe(EMPTY_MEDIA);
    expect(cache.snapshot("a", "active").url).toBeTruthy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(oldUrl);
  });

  it("also bounds unused pending entries", () => {
    for (let i = 0; i < 4; i++) cache.retain("a", String(i), false, () => new Promise(() => {}))();
    // The oldest pending request is gone, so a new consumer starts a fresh request.
    const load = vi.fn(async () => new Blob(["x"]));
    cache.retain("a", "0", false, load);
    return tick().then(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it("allows failed downloads to be retried", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(new Blob(["x"]));
    const release = cache.retain("a", "image", false, load);
    await tick();
    expect(cache.snapshot("a", "image").error).toBe(true);
    release();
    cache.retain("a", "image", false, load);
    await tick();
    expect(cache.snapshot("a", "image").url).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("invalidates private cascades, retains catalogue media and ignores old-session deletions", async () => {
    cache.retain("a", "private", false, async () => new Blob(["x"]));
    cache.retain("a", "catalog", true, async () => new Blob(["x"]));
    await tick();
    const catalogue = cache.snapshot("a", "catalog", true);
    cache.invalidatePrivate("other");
    expect(cache.snapshot("a", "private").url).toBeTruthy();
    cache.invalidatePrivate("a");
    expect(cache.snapshot("a", "private")).toBe(EMPTY_MEDIA);
    expect(cache.snapshot("a", "catalog", true)).toBe(catalogue);
  });

  it("invalidating a pending image prevents it from repopulating the cache", async () => {
    const waiting = deferred();
    cache.retain("a", "image", false, () => waiting.promise);
    await tick();
    cache.invalidate("a", "image");
    waiting.resolve(new Blob(["deleted"]));
    await tick();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
