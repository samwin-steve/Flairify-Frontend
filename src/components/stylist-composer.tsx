"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ImagePlus,
  LoaderCircle,
  Mic,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Outfit } from "@/lib/types";

export function StylistComposer({
  input,
  onInput,
  onSend,
  busy,
  ready,
  includeWardrobe,
  onWardrobe,
  onPhotos,
  onSettings,
  focus,
  onClearFocus,
  onTalk,
}: {
  input: string;
  onInput: (text: string) => void;
  onSend: () => void;
  busy: boolean;
  ready: boolean;
  includeWardrobe: boolean;
  onWardrobe: (value: boolean) => void;
  onPhotos: () => void;
  onSettings: () => void;
  focus: Outfit | null;
  onClearFocus: () => void;
  onTalk: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "auto";
      textarea.current.style.height =
        Math.min(144, textarea.current.scrollHeight) + "px";
    }
  }, [input]);
  useEffect(() => {
    if (focus) textarea.current?.focus();
  }, [focus]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <form
      className="stylist-composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      {focus && (
        <div className="refinement-context">
          <Shirt size={16} />
          <span>
            Refining <strong>{focus.title}</strong>
          </span>
          <button
            type="button"
            className="icon-button small"
            onClick={onClearFocus}
            aria-label="Clear selected look"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <textarea
        ref={textarea}
        aria-label="Message your stylist"
        placeholder={
          focus
            ? "What would you like to change?"
            : ready
              ? "Ask for a look, a new variation, or a little advice…"
              : "Save your shopping preferences to start…"
        }
        value={input}
        rows={1}
        maxLength={2000}
        onChange={(e) => onInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <div className="composer-toolbar">
        <button
          type="button"
          className="composer-icon"
          onClick={onPhotos}
          aria-label="Add wardrobe photos"
          title="Add wardrobe photos"
        >
          <ImagePlus size={19} />
        </button>
        <div
          className="wardrobe-mode"
          ref={menu}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          <button
            type="button"
            ref={trigger}
            className={"mode-pill" + (includeWardrobe ? " selected" : "")}
            aria-label={
              includeWardrobe
                ? "Shopping mode: With my wardrobe"
                : "Shopping mode: Shop new pieces"
            }
            aria-expanded={open}
            aria-controls="wardrobe-mode-options"
            disabled={busy || !ready}
            onClick={() => setOpen(!open)}
          >
            {includeWardrobe ? <Shirt size={17} /> : <ShoppingBag size={17} />}
            <span>
              {includeWardrobe ? "With my wardrobe" : "Shop new pieces"}
            </span>
            <ChevronDown size={14} />
          </button>
          {open && (
            <div className="mode-options" id="wardrobe-mode-options">
              <p>Build your look with</p>
              <button
                type="button"
                className={!includeWardrobe ? "chosen" : ""}
                onClick={() => {
                  onWardrobe(false);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <ShoppingBag size={18} />
                <span>
                  <strong>New pieces</strong>
                  <small>Explore the catalogue</small>
                </span>
                {!includeWardrobe && <Check size={16} />}
              </button>
              <button
                type="button"
                className={includeWardrobe ? "chosen" : ""}
                onClick={() => {
                  onWardrobe(true);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <Shirt size={18} />
                <span>
                  <strong>My wardrobe + new</strong>
                  <small>Include matching pieces I own</small>
                </span>
                {includeWardrobe && <Check size={16} />}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="composer-icon preferences-button"
          onClick={onSettings}
          aria-label="Shopping preferences"
          title="Shopping preferences"
        >
          <SlidersHorizontal size={18} />
        </button>
        <button
          type="button"
          className="composer-talk"
          onClick={onTalk}
          disabled={busy}
          aria-label="Talk to your stylist"
          title="Google AI voice · Transcript saved in this chat"
        >
          <Mic size={18} />
          <span>Talk</span>
        </button>
        <button
          className="composer-send"
          aria-label="Send message"
          disabled={busy || !input.trim()}
        >
          {busy ? (
            <LoaderCircle size={20} className="spin" />
          ) : (
            <ArrowUp size={20} />
          )}
        </button>
      </div>
    </form>
  );
}
