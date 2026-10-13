"use client";

import { useEffect, useRef, useState } from "react";
import { post } from "./api";
import { VoicePlayer } from "./voice-audio";
import type { Conversation, Outfit } from "./types";

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
      setPhase("Connecting to your stylist…");
      const ticket = await post<{
        url: string;
        ticket: string;
        conversation_id: string;
        max_seconds: number;
      }>(
        "/voice/sessions",
        options, // Authentication stays in the normal API flow.
      );
      if (c.cancelled) {
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
      c.socket = new WebSocket(url);
      c.socket.binaryType = "arraybuffer";
      c.source = context.createMediaStreamSource(c.stream);
      c.capture = new AudioWorkletNode(context, "flairify-capture");
      c.gain = context.createGain();
      c.gain.gain.value = 0;
      c.source.connect(c.capture);
      c.capture.connect(c.gain);
      c.gain.connect(context.destination);
      let ready = false;
      c.capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (
          ready &&
          !c.muted &&
          !c.cancelled &&
          c.socket?.readyState === WebSocket.OPEN
        ) {
          if (c.socket.bufferedAmount > 128000) {
            setError(
              "Your connection is struggling with live audio. Reconnect or continue typing.",
            );
            stop();
            return;
          }
          c.socket.send(event.data);
        }
      };
      c.deadline = setTimeout(() => {
        setError("Voice could not connect. Please try again.");
        dispose(c);
      }, 30000);
      c.socket.onopen = () =>
        c.socket?.send(JSON.stringify({ ticket: ticket.ticket }));
      c.socket.onmessage = (event) => {
        if (c.cancelled) return;
        try {
          if (event.data instanceof ArrayBuffer) {
            c.player.play(event.data);
            setSpeaking(true);
            return;
          }
          const data = JSON.parse(event.data);
          if (data.type === "ready") {
            ready = true;
            clearTimeout(c.deadline);
            setPhase("Listening");
            c.timer = setInterval(() => {
              setSeconds((s) => s + 1);
              setSpeaking(c.player.speaking);
            }, 1000);
          } else if (data.type === "transcript") {
            latest.current.onTranscript(data.role, data.text);
          } else if (data.type === "outfits")
            latest.current.onOutfits(data.outfits);
          else if (data.type === "turn") {
            latest.current.onTurn(data.conversation);
            setPhase("Listening");
          } else if (data.type === "status") setPhase(data.message);
          else if (data.type === "interrupted") {
            c.player.stop();
            setSpeaking(false);
            setPhase("Listening");
          } else if (data.type === "error" || data.type === "ended") {
            setError(data.message);
            dispose(c);
          }
        } catch {
          setError("Voice was interrupted. Your saved chat is still here.");
          dispose(c);
        }
      };
      c.socket.onerror = () => {
        setError("Voice could not connect. Please try again or keep typing.");
        dispose(c);
      };
      c.socket.onclose = () => dispose(c);
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
    clearError: () => setError(""),
  };
}
