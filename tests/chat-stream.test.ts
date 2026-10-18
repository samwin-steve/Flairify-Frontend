import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeChatStream, streamChat } from "../src/lib/chat-stream";
const done = { conversation: { id: "c1", messages: [] }, outfits: [] };
function stream(text: string, chunk = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunk)
        controller.enqueue(bytes.slice(i, i + chunk));
      controller.close();
    },
  });
}
describe("chat streaming protocol", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([422, 503])("shows safety refusal or retry messages before streaming (%s), and permits the next request", async (status) => {
    const message = status === 422
      ? "I can help with clothes and styling, but I can't help with that request. Try asking for a look or styling advice."
      : "I couldn't check that request safely. Please try again in a moment.";
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ detail: message }, { status }))
      .mockResolvedValueOnce(new Response(
        stream("event: done\ndata: " + JSON.stringify(done) + "\n\n"),
        { headers: { "Content-Type": "text/event-stream" } },
      ));
    vi.stubGlobal("fetch", fetcher);
    const onEvent = vi.fn();
    await expect(streamChat({ message: "first request" }, onEvent, new AbortController().signal))
      .rejects.toThrow(message);
    expect(onEvent).not.toHaveBeenCalled();
    await expect(streamChat({ message: "A comfortable office outfit" }, onEvent, new AbortController().signal))
      .resolves.toEqual(done);
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ type: "done", result: done });
  });

  it("decodes split Unicode, CRLF frames and keepalives", async () => {
    const events: any[] = [];
    const result = await consumeChatStream(
      stream(
        ': keepalive\r\n\r\nevent: text\r\ndata: {"delta":"₹5,000 — easy layers"}\r\n\r\nevent: done\ndata: ' +
          JSON.stringify(done) +
          "\n\n",
      ),
      (e) => events.push(e),
    );
    expect(events[0]).toEqual({ type: "text", delta: "₹5,000 — easy layers" });
    expect(events).toHaveLength(2);
    expect(result).toEqual(done);
  });
  it("rejects an interrupted stream instead of reporting success", async () => {
    await expect(
      consumeChatStream(
        stream('event: text\ndata: {"delta":"A partial answer"}\n\n'),
        () => {},
      ),
    ).rejects.toThrow("interrupted");
  });
  it("shows provider errors without inventing completion", async () => {
    await expect(
      consumeChatStream(
        stream(
          'event: error\ndata: {"message":"Semantic search is unavailable"}\n\n',
        ),
        () => {},
      ),
    ).rejects.toThrow("Semantic search is unavailable");
  });
  it("accepts an idempotent replay containing only done", async () => {
    await expect(
      consumeChatStream(
        stream("event: done\ndata: " + JSON.stringify(done) + "\n\n", 500),
        () => {},
      ),
    ).resolves.toEqual(done);
  });
});
