"use client";

import { Mic, MicOff, PhoneOff, Sparkles } from "lucide-react";

export function VoiceConversation({
  phase,
  muted,
  speaking,
  seconds,
  onMute,
  onEnd,
}: {
  phase: string;
  muted: boolean;
  speaking: boolean;
  seconds: number;
  onMute: () => void;
  onEnd: () => void;
}) {
  const status = muted
    ? "Your microphone is off"
    : speaking
      ? "Your stylist is speaking"
      : phase;
  return (
    <section
      className={"voice-conversation" + (speaking ? " speaking" : "")}
      aria-label="Voice conversation"
    >
      <div className="voice-orb" aria-hidden="true">
        <Sparkles size={25} />
      </div>
      <div className="voice-copy">
        <strong role="status" aria-live="polite">
          {status}
        </strong>
        <span>
          {muted
            ? "Unmute whenever you’re ready."
            : "Just talk. You can interrupt me anytime."}
        </span>
        <small>
          Transcript saved · {Math.floor(seconds / 60)}:
          {String(seconds % 60).padStart(2, "0")}
        </small>
      </div>
      <div className="voice-controls">
        <button
          className="voice-mute"
          onClick={onMute}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={muted}
        >
          {muted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button
          className="voice-end"
          onClick={onEnd}
          aria-label="End voice conversation"
        >
          <PhoneOff size={19} />
          <span>End</span>
        </button>
      </div>
    </section>
  );
}
