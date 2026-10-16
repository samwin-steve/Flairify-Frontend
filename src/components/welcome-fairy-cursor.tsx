"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./welcome-fairy-cursor.module.css";

type Sparkle = {
  x: number;
  y: number;
  drift: number;
  size: number;
  born: number;
  life: number;
  colour: string;
  rotation: number;
};

export function WelcomeFairyCursor({ children }: { children: ReactNode }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const fairyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const fairy = fairyRef.current;
    const canvas = canvasRef.current;
    const surface = document.body;
    const context = canvas?.getContext("2d");
    if (!layer || !fairy || !canvas || !context) return;

    const preference = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );

    function start() {
      // Sign-in dialogs are portaled to the body. The welcome screen owns
      // these listeners and cursor styling, and removes both on app entry.
      const overlay = layer!;
      const sprite = fairy!;
      const trail = canvas!;
      const ctx = context!;
      let sparkles: Sparkle[] = [];
      let frame = 0;
      let lastEmission = 0;
      let lastX = 0;
      let lastY = 0;
      const colours = ["#b83f69", "#c596d8", "#d6ad69"];

      function hide() {
        overlay.style.visibility = "hidden";
        surface.classList.remove(styles.active);
        cancelAnimationFrame(frame);
        frame = 0;
        sparkles = [];
        lastEmission = 0;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }

      function resize() {
        hide();
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        trail.width = Math.round(window.innerWidth * scale);
        trail.height = Math.round(window.innerHeight * scale);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
      }

      function paint(now: number) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        sparkles = sparkles.filter((sparkle) => now - sparkle.born < sparkle.life);
        for (const sparkle of sparkles) {
          const age = (now - sparkle.born) / sparkle.life;
          ctx.save();
          ctx.translate(
            sparkle.x + sparkle.drift * age,
            sparkle.y + 17 * age * age,
          );
          ctx.rotate(sparkle.rotation + age * 0.6);
          ctx.globalAlpha = Math.pow(1 - age, 1.5) * 0.8;
          ctx.fillStyle = sparkle.colour;
          ctx.beginPath();
          for (let point = 0; point < 8; point++) {
            const angle = (point * Math.PI) / 4;
            const radius = sparkle.size * (point % 2 ? 0.24 : 1);
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        // No animation loop runs once the last glitter has faded.
        frame = sparkles.length ? requestAnimationFrame(paint) : 0;
      }

      function move(event: PointerEvent) {
        if (event.pointerType !== "mouse") {
          hide();
          return;
        }
        sprite.style.transform = `translate3d(${event.clientX - 4}px, ${event.clientY - 4}px, 0)`;
        overlay.style.visibility = "visible";
        surface.classList.add(styles.active);

        const now = performance.now();
        const distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);
        if (now - lastEmission >= 24 && (distance >= 4 || !lastEmission)) {
          for (let index = 0; index < 2; index++) {
            sparkles.push({
              x: event.clientX + 14 + (Math.random() - 0.5) * 14,
              y: event.clientY + 25 + (Math.random() - 0.5) * 14,
              drift: (Math.random() - 0.5) * 20,
              size: 1.5 + Math.random() * 2.5,
              born: now,
              life: 450 + Math.random() * 350,
              colour: colours[Math.floor(Math.random() * colours.length)],
              rotation: Math.random() * Math.PI,
            });
          }
          sparkles = sparkles.slice(-48);
          lastEmission = now;
          lastX = event.clientX;
          lastY = event.clientY;
          if (!frame) frame = requestAnimationFrame(paint);
        }
      }

      function keydown(event: KeyboardEvent) {
        if (event.key === "Tab") hide();
      }

      function pointerdown(event: PointerEvent) {
        if (event.pointerType !== "mouse") hide();
      }

      function visibility() {
        if (document.hidden) hide();
      }

      resize();
      document.addEventListener("pointermove", move, {
        passive: true,
        capture: true,
      });
      document.addEventListener("pointerdown", pointerdown, {
        passive: true,
        capture: true,
      });
      document.documentElement.addEventListener("pointerleave", hide);
      window.addEventListener("resize", resize);
      window.addEventListener("blur", hide);
      document.addEventListener("keydown", keydown);
      document.addEventListener("visibilitychange", visibility);

      return () => {
        hide();
        document.removeEventListener("pointermove", move, true);
        document.removeEventListener("pointerdown", pointerdown, true);
        document.documentElement.removeEventListener("pointerleave", hide);
        window.removeEventListener("resize", resize);
        window.removeEventListener("blur", hide);
        document.removeEventListener("keydown", keydown);
        document.removeEventListener("visibilitychange", visibility);
      };
    }

    let stop: (() => void) | undefined;
    function sync() {
      stop?.();
      stop = preference.matches ? start() : undefined;
    }
    sync();
    preference.addEventListener("change", sync);
    return () => {
      preference.removeEventListener("change", sync);
      stop?.();
    };
  }, []);

  return (
    <>
      {children}
      <div
        ref={layerRef}
        className={styles.layer}
        data-welcome-fairy
        aria-hidden="true"
      >
        <canvas ref={canvasRef} className={styles.trail} />
        <div ref={fairyRef} className={styles.fairy}>
          <svg viewBox="0 0 48 58" fill="none" focusable="false">
            <g className={styles.leftWing}>
              <path
                d="M26 29C19 10 5 10 9 22C11 28 18 31 26 32Z"
                fill="#f1defb"
                fillOpacity=".9"
                stroke="#c896c9"
                strokeWidth=".8"
              />
              <path
                d="M26 31C8 25 11 42 20 39L28 34"
                fill="#fbe4ee"
                fillOpacity=".9"
                stroke="#dca3c3"
                strokeWidth=".8"
              />
              <path d="M13 19L25 30M17 35L25 33" stroke="white" strokeWidth=".9" />
            </g>
            <g className={styles.rightWing}>
              <path
                d="M29 29C34 9 48 13 42 25C39 30 33 32 28 32Z"
                fill="#f1defb"
                fillOpacity=".9"
                stroke="#c896c9"
                strokeWidth=".8"
              />
              <path
                d="M30 31C47 28 42 44 35 39L28 34"
                fill="#fbe4ee"
                fillOpacity=".9"
                stroke="#dca3c3"
                strokeWidth=".8"
              />
              <path d="M39 20L30 30M37 35L30 33" stroke="white" strokeWidth=".9" />
            </g>
            <path
              d="M26 42C27 47 23 49 20 52M30 43C30 48 34 49 37 50"
              stroke="#d79287"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path d="M18 53L22 51M36 50L39 51" stroke="#bf7d4d" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M25 25L20 26L10 14M31 26L35 31" stroke="#e5ae9a" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M28 20V25" stroke="#e5ae9a" strokeWidth="3" />
            <path d="M25 24L31 25L30 33L36 43C30 46 23 45 18 41L25 32Z" fill="#cf6b98" />
            <path d="M27 33L24 41M29 34L32 42" stroke="#f7b9d5" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M24 32L30 33" stroke="#a73c69" strokeWidth="1.3" />
            <path d="M23 18C19 8 33 6 34 15L33 27L29 23Z" fill="#d6a45f" />
            <circle cx="31" cy="9" r="3.5" fill="#dfb36f" />
            <path d="M24 13C23 22 31 24 32 16L29 12Z" fill="#f5cbb6" />
            <path d="M23 14C23 8 32 10 33 16C29 16 27 12 26 12L23 16Z" fill="#e9c180" />
            <path d="M25 17L25.5 17" stroke="#784858" strokeWidth="1" strokeLinecap="round" />
            <path d="M28 11L32 12" stroke="#c05a8c" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 5L17 23" stroke="#be9253" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M5 0L6.4 3.6L10 5L6.4 6.4L5 10L3.6 6.4L0 5L3.6 3.6Z" fill="#ce668f" />
            <circle cx="5" cy="5" r="1.3" fill="#fff2d7" />
          </svg>
        </div>
      </div>
    </>
  );
}
