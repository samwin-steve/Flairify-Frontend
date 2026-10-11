import { token } from "./api";
import type { Conversation, Outfit } from "./types";

export type ChatResult = {
  conversation: Conversation;
  outfits: Outfit[];
  method?: string;
};
export type ChatEvent =
  | { type: "start"; conversation_id: string; request_id: string }
  | { type: "status"; message: string }
  | { type: "text"; delta: string }
  | { type: "outfits"; outfits: Outfit[]; method?: string }
  | { type: "done"; result: ChatResult }
  | { type: "error"; message: string };

// TextDecoder keeps partial UTF-8 characters across network chunks (including ₹).
// SSE frames may split at any byte; keepalive comments never become chat text.
export async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatEvent) => void,
): Promise<ChatResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatResult | undefined;
  function frame(raw: string) {
    const lines = raw.split(/\r?\n/);
    const name = lines
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim();
    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!name || !data) return;
    const value = JSON.parse(data);
    if (name === "error")
      throw new Error(value.message || "The stylist was interrupted.");
    if (name === "done") {
      if (
        !value.conversation?.id ||
        !Array.isArray(value.conversation.messages) ||
        !Array.isArray(value.outfits)
      )
        throw new Error("The stylist returned an incomplete answer.");
      result = value;
      onEvent({ type: "done", result: value });
    } else if (["start", "status", "text", "outfits"].includes(name)) {
      onEvent({ ...value, type: name } as ChatEvent);
    }
  }
  try {
    while (!result) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 2_000_000)
        throw new Error("The stylist response exceeded its size limit.");
      let match: RegExpMatchArray | null;
      while ((match = buffer.match(/\r?\n\r?\n/))) {
        const end = match.index!;
        frame(buffer.slice(0, end));
        buffer = buffer.slice(end + match[0].length);
      }
      if (done) break;
    }
    if (!result)
      throw new Error(
        "The connection was interrupted. Retry your message to finish the answer.",
      );
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function streamChat(
  request: Record<string, unknown>,
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
) {
  const t = await token();
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(t ? { Authorization: "Bearer " + t } : {}),
    },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "The stylist is unavailable. Please retry.",
    );
  }
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("text/event-stream")
  )
    throw new Error("Streaming is unavailable. Please retry shortly.");
  return consumeChatStream(response.body, onEvent);
}
