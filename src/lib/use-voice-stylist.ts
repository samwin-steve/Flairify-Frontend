"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, post } from "./api";
import { VoicePlayer } from "./voice-audio";
import type { Conversation, Outfit, Job } from "./types";

import type { PreviewPiece } from "./try-on-selection";

type Options = {
  conversation_id: string | null;
  reference_outfit_id: string | null;
  include_wardrobe: boolean;
  store_id: string | null;
};
type Callbacks = {
  onStart: (id: string) => void;
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onOutfits: (outfits: Outfit[]) => void;
  onTurn: (conversation: Conversation) => void;
  onSelection: (pieces: PreviewPiece[], adjustments: string[]) => void;
  onPreview: (job: Job) => void;
  onEnd: (id: string) => void;
};
type Connection = {
  context: AudioContext;
  stream?: MediaStream;
  socket?: WebSocket;
  source?: MediaStreamAudioSourceNode;
  capture?: AudioWorkletNode;
  gain?: GainNode;
  player: VoicePlayer;
  id: string;
  cancelled: boolean;
  muted: boolean;
  ready: boolean;
  ending: boolean;
  reconnects: number;
  recovering: boolean;
  options: Options;
  lastPong: number;
  retryTimer?: ReturnType<typeof setTimeout>;
  timer?: ReturnType<typeof setInterval>;
  deadline?: ReturnType<typeof setTimeout>;
};

export function useVoiceStylist(callbacks: Callbacks) {
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const current = useRef<Connection | null>(null);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState("Ready to talk");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);

  function dispose(c: Connection, notify = true) {
    if (c.cancelled) return;
    c.cancelled = true;
    clearInterval(c.timer);
    clearTimeout(c.retryTimer);
    clearTimeout(c.deadline);
    c.stream?.getTracks().forEach((t) => t.stop());
    c.capture?.disconnect();
    c.capture?.port.close();
    c.source?.disconnect();
    c.gain?.disconnect();
    c.player.stop();
    void c.context.close().catch(() => {});
    c.socket?.close();
    if (current.current === c) {
      current.current = null;
      setActive(false);
      setSpeaking(false);
      setMuted(false);
      if (notify && c.id) latest.current.onEnd(c.id);
    }
  }

  function stop(notify = true) {
    const c = current.current;
    if (!c) return;
    c.ending = true;
    c.ready = false;
    clearTimeout(c.retryTimer);
    c.stream?.getTracks().forEach((t) => t.stop());
    c.player.stop();
    if (c.socket?.readyState === WebSocket.OPEN) {
      clearTimeout(c.deadline);
      c.socket.send(JSON.stringify({ type: "end" }));
      setPhase("Saving your chat…");
      // Let the server persist the final interrupted reply before closing.
      c.deadline = setTimeout(() => dispose(c, notify), 4000);
      if (!notify) dispose(c, false);
    } else dispose(c, notify);
  }

  function toggleMute() {
    const c = current.current;
    if (!c || c.cancelled) return;
    c.muted = !c.muted;
    c.stream?.getAudioTracks().forEach((t) => {
      t.enabled = !c.muted;
    });
    if (c.muted && c.socket?.readyState === WebSocket.OPEN)
      c.socket.send(JSON.stringify({ type: "mute" }));
    setMuted(c.muted);
  }

  function select(pieces: PreviewPiece[]) {
    const c = current.current;
    if (c?.ready && !c.ending && c.socket?.readyState === WebSocket.OPEN)
      c.socket.send(
        JSON.stringify({
          type: "selection",
          pieces: pieces.map((p) => `${p.kind}:${p.id}`),
        }),
      );
  }

  function recover(c: Connection) {
    if (c.cancelled || c.ending || c.recovering) return;
    if (!c.ready || c.reconnects >= 1 || document.hidden) {
      setError(
        "The voice connection dropped. Your saved chat and previews are kept. Tap Talk to continue.",
      );
      dispose(c);
      return;
    }
    c.ready = false;
    c.recovering = true;
    c.reconnects++;
    c.socket?.close();
    c.player.stop();
    clearTimeout(c.deadline);
    clearInterval(c.timer);
    setSpeaking(false);
    setPhase("Reconnecting to your stylist…");
    // Keep the permitted microphone but drop audio until ready; never replay an
    // unfinished request, especially a generation action, after a disconnect.
    let attempts = 0;
    const attempt = async () => {
      if (c.cancelled || c.ending || document.hidden) return;
      try {
        await connect(c);
      } catch (e) {
        if (c.cancelled || c.ending) return;
        if (e instanceof ApiError && e.status === 409 && ++attempts < 3) {
          c.retryTimer = setTimeout(attempt, 3000 * attempts);
          return;
        }
        setError(
          e instanceof Error ? e.message : "Please tap Talk to reconnect.",
        );
        dispose(c);
      }
    };
    c.retryTimer = setTimeout(attempt, 2000);
  }

  async function connect(c: Connection) {
    setPhase(
      c.reconnects
        ? "Reconnecting to your stylist…"
        : "Connecting to your stylist…",
    );
    const ticket = await api<{
      url: string;
      ticket: string;
      conversation_id: string;
    }>("/voice/sessions", {
      method: "POST",
      body: JSON.stringify({
        ...c.options,
        conversation_id: c.id || c.options.conversation_id,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (c.cancelled || c.ending) {
      void post("/voice/sessions/cancel", { ticket: ticket.ticket }).catch(
        () => {},
      );
      return;
    }
    c.id = ticket.conversation_id;
    latest.current.onStart(c.id);
    const url = new URL(ticket.url);
    if (
      url.protocol !== "wss:" &&
      !(
        url.protocol === "ws:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw new Error("The voice connection requires a secure address.");
    const socket = new WebSocket(url);
    c.socket = socket;
    socket.binaryType = "arraybuffer";
    c.deadline = setTimeout(() => {
      if (c.cancelled || c.ending) return;
      setError("Voice could not connect. Please try again.");
      dispose(c);
    }, 30000);
    socket.onopen = () => {
      if (!c.cancelled && !c.ending && c.socket === socket)
        socket.send(JSON.stringify({ ticket: ticket.ticket }));
    };
    socket.onmessage = (event) => {
      if (c.cancelled || c.socket !== socket) return;
      try {
        if (event.data instanceof ArrayBuffer) {
          if (!c.ending) {
            c.player.play(event.data);
            setSpeaking(true);
          }
          return;
        }
        const data = JSON.parse(event.data);
        if (data.type === "ready") {
          if (c.ending) return;
          c.ready = true;
          c.recovering = false;
          c.lastPong = Date.now();
          clearTimeout(c.deadline);
          clearInterval(c.timer); // Google session resumption can send ready again.
          setPhase("Listening");
          if (c.reconnects)
            setError(
              "Reconnected. If I missed your last request, please say it again. Your previews are kept.",
            );
          let ticks = 0;
          c.timer = setInterval(() => {
            setSeconds((s) => s + 1);
            setSpeaking(c.player.speaking);
            if (++ticks % 15 === 0 && socket.readyState === WebSocket.OPEN)
              socket.send(JSON.stringify({ type: "ping" }));
            if (Date.now() - c.lastPong > 45000) recover(c);
          }, 1000);
        } else if (data.type === "pong") c.lastPong = Date.now();
        else if (data.type === "transcript")
          latest.current.onTranscript(data.role, data.text);
        else if (data.type === "outfits")
          latest.current.onOutfits(data.outfits);
        else if (data.type === "selection")
          latest.current.onSelection(data.pieces, data.adjustments || []);
        else if (data.type === "preview") latest.current.onPreview(data.job);
        else if (data.type === "turn") {
          latest.current.onTurn(data.conversation);
          if (!c.ending) setPhase("Listening");
        } else if (data.type === "status") setPhase(data.message);
        else if (data.type === "notice") setError(data.message);
        else if (data.type === "interrupted") {
          c.player.stop();
          setSpeaking(false);
          setPhase("Listening");
        } else if (data.type === "error" || data.type === "ended") {
          if (!c.ending) setError(data.message);
          dispose(c);
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Voice was interrupted. Your saved chat is still here.",
        );
        dispose(c);
      }
    };
    socket.onerror = () => {
      if (c.socket === socket) socket.close();
    };
    socket.onclose = () => {
      if (c.cancelled || c.socket !== socket) return;
      if (c.ending) dispose(c);
      else recover(c);
    };
  }

  async function start(options: Options) {
    if (current.current) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setError(
        "Voice needs a browser with microphone access. You can still type here.",
      );
      return;
    }
    // Create/resume during the click gesture so mobile browsers permit playback.
    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      setError(
        "Audio could not start in this browser. You can still type here.",
      );
      return;
    }
    if (!context.audioWorklet) {
      void context.close();
      setError(
        "Live audio is unavailable in this browser. You can still type here.",
      );
      return;
    }
    const c: Connection = {
      context,
      player: new VoicePlayer(context),
      id: "",
      cancelled: false,
      muted: false,
      ready: false,
      ending: false,
      reconnects: 0,
      recovering: false,
      options,
      lastPong: Date.now(),
    };
    current.current = c;
    setActive(true);
    setSeconds(0);
    setPhase("Allow your microphone to start");
    try {
      await context.resume();
      c.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (c.cancelled) {
        c.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      await context.audioWorklet.addModule("/voice-capture.worklet.js");
      c.source = context.createMediaStreamSource(c.stream);
      c.capture = new AudioWorkletNode(context, "flairify-capture");
      c.gain = context.createGain();
      c.gain.gain.value = 0;
      c.source.connect(c.capture);
      c.capture.connect(c.gain);
      c.gain.connect(context.destination);
      c.capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (
          c.ready &&
          !c.muted &&
          !c.cancelled &&
          c.socket?.readyState === WebSocket.OPEN
        ) {
          if (c.socket.bufferedAmount > 128000) {
            recover(c);
            return;
          }
          c.socket.send(event.data);
        }
      };
      await connect(c);
    } catch (e) {
      if (!c.cancelled) {
        const denied =
          e instanceof DOMException &&
          ["NotAllowedError", "PermissionDeniedError"].includes(e.name);
        setError(
          denied
            ? "Microphone access is off. Allow it in your browser, then try again. You can still type."
            : e instanceof Error
              ? e.message
              : "Voice is unavailable. Please try again.",
        );
        dispose(c);
      }
    }
  }

  useEffect(() => {
    const leave = () => {
      if (current.current) dispose(current.current, false);
    };
    const hide = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hide);
      leave();
    };
  }, []); // Resources belong to this hook; never leave a microphone running off-screen.

  return {
    active,
    phase,
    muted,
    speaking,
    error,
    seconds,
    start,
    stop,
    toggleMute,
    select,
    clearError: () => setError(""),
  };
}
