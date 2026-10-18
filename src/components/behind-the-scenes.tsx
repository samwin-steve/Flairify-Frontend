"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { ArrowRight, Check, CircleHelp, MessageCircle, Pause, Play, RotateCcw, ShieldCheck, Shirt, SkipForward, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import styles from "./behind-the-scenes.module.css";

// A deliberately local simulation of the documented backend journey. No API calls.
// Sources: backend app/agents/stylist.py, services/recommendations.py,
// rag/repository.py, rag/wardrobe_graph.py, services/request_safety.py.
type NodeId = "query" | "armor" | "agent" | "rag" | "embedding" | "firestore" | "graph" | "storage" | "response" | "tasks" | "worker";
type JourneyNode = {
  id: NodeId; title: string; subtitle: string; x: number; y: number;
  icon?: string; glyph?: typeof Sparkles; kind: "request" | "data" | "background";
  detail: string; technical: string;
};
const nodes: JourneyNode[] = [
  { id: "query", title: "Your request", subtitle: "Wardrobe enabled", x: 80, y: 260, glyph: MessageCircle, kind: "request",
    detail: "Summer party clothes, a ₹5,000 budget, and permission to include confirmed pieces you already own.", technical: "Illustrative request · no live AI calls" },
  { id: "armor", title: "Model Armor", subtitle: "Safety check", x: 250, y: 260, glyph: ShieldCheck, kind: "request",
    detail: "Screens the text for unsafe content and prompt injection before it reaches Gemini. A blocked request stops here.", technical: "sanitizeUserPrompt" },
  { id: "agent", title: "Stylist agent", subtitle: "flairify_stylist", x: 435, y: 260, icon: "vertexai", kind: "request",
    detail: "The Google ADK agent turns the request into a tool call, then explains the checked recommendations. Gemini also assesses the shortlist for suitability.", technical: "Vertex AI · gemini-3.8-flash" },
  { id: "rag", title: "Retrieve & rank", subtitle: "Tools on Cloud Run", x: 685, y: 260, glyph: SlidersHorizontal, kind: "request",
    detail: "Retrieves relevant catalogue pieces, builds looks with your confirmed wardrobe, and checks occasion, budget, size and stock.", technical: "find_outfit_candidates(occasion: Party, budget: 5000)" },
  { id: "embedding", title: "Vertex AI", subtitle: "gemini-embedding-2", x: 580, y: 65, icon: "vertexai", kind: "data",
    detail: "Turns the search intent into a 768-dimensional vector so retrieval can find meaningfully related clothes.", technical: "Semantic query → embedding" },
  { id: "firestore", title: "Firestore", subtitle: "Vector search + facts", x: 825, y: 65, icon: "firestore", kind: "data",
    detail: "Finds relevant catalogue vectors and supplies saved sizes, store, confirmed wardrobe, current prices and stock. Also saves the conversation and checked results.", technical: "Catalogue retrieval · account context · result persistence" },
  { id: "storage", title: "Cloud Storage", subtitle: "Product images", x: 1090, y: 65, icon: "cloud_storage", kind: "data",
    detail: "Supplies product and garment images through the media API. Generating a try-on preview is a separate action after choosing a look.", technical: "Private media → authenticated media API" },
  { id: "response", title: "Your looks", subtitle: "Personal, grounded", x: 1090, y: 260, glyph: Shirt, kind: "request",
    detail: "The shopper gets checked outfit cards and a short styling explanation, with prices, sizes and images ready to explore.", technical: "Streamed explanation + structured outfit cards" },
  { id: "tasks", title: "Cloud Tasks", subtitle: "Background queue", x: 475, y: 465, icon: "cloud_tasks", kind: "background",
    detail: "Queues a wardrobe-graph refresh after checked results are saved. The shopper does not need to wait for it.", technical: "graph_sync job" },
  { id: "worker", title: "Cloud Run", subtitle: "Private worker", x: 685, y: 465, icon: "cloud_run", kind: "background",
    detail: "Processes the queued job and syncs eligible, checked outfit relationships into BigQuery using a private task endpoint.", technical: "Cloud Tasks → authenticated worker" },
  { id: "graph", title: "BigQuery", subtitle: "WardrobeGraph", x: 910, y: 465, icon: "bigquery", kind: "data",
    detail: "Looks up previous checked outfits linking your garments to candidate products. That coverage helps ranking when evidence exists; Firestore supplies current stock and price.", technical: "Garment ← Outfit → Product" },
];

type Edge = { id: string; from: NodeId; to: NodeId; path: string; label: string; x: number; y: number; background?: boolean; always?: boolean };
const edges: Edge[] = [
  { id: "screen", from: "query", to: "armor", path: "M112 260 H218", label: "Screen text", x: 165, y: 242, always: true },
  { id: "allow", from: "armor", to: "agent", path: "M282 260 H403", label: "Safe request", x: 343, y: 242, always: true },
  { id: "tool", from: "agent", to: "rag", path: "M467 260 H653", label: "find_outfit_candidates()", x: 560, y: 242, always: true },
  { id: "embed", from: "rag", to: "embedding", path: "M665 234 C655 180 580 175 580 108", label: "Embed intent", x: 580, y: 168 },
  { id: "context", from: "rag", to: "firestore", path: "M705 234 C738 195 825 190 825 108", label: "Read wardrobe + sizes", x: 813, y: 178 },
  { id: "search", from: "embedding", to: "firestore", path: "M612 65 H793", label: "Vector search", x: 703, y: 47 },
  { id: "facts", from: "firestore", to: "rag", path: "M802 91 C760 130 705 143 685 228", label: "Catalogue + current facts", x: 718, y: 139 },
  { id: "coverage", from: "rag", to: "graph", path: "M717 271 C850 290 910 335 910 433", label: "Check wardrobe matches", x: 923, y: 343 },
  { id: "evidence", from: "graph", to: "rag", path: "M885 443 C850 393 767 354 705 286", label: "Prior outfit evidence", x: 792, y: 375 },
  { id: "assess", from: "rag", to: "agent", path: "M663 284 C620 369 488 369 450 289", label: "Assess + explain", x: 557, y: 355 },
  { id: "save", from: "rag", to: "firestore", path: "M705 234 C738 195 825 190 825 108", label: "Recheck stock · save", x: 813, y: 178 },
  { id: "answer", from: "agent", to: "response", path: "M456 236 C500 151 1028 151 1068 236", label: "Grounded recommendations", x: 946, y: 198 },
  { id: "images", from: "storage", to: "response", path: "M1090 108 V228", label: "Load images", x: 1090, y: 178 },
  { id: "enqueue", from: "rag", to: "tasks", path: "M663 284 C626 350 475 351 475 433", label: "Queue graph refresh", x: 464, y: 393, background: true },
  { id: "dispatch", from: "tasks", to: "worker", path: "M507 465 H653", label: "Dispatch job", x: 580, y: 447, background: true, always: true },
  { id: "sync", from: "worker", to: "graph", path: "M717 465 H878", label: "Sync evidence", x: 798, y: 447, background: true, always: true },
];

type Step = { title: string; text: string; edges: string[]; focus: NodeId; nodes: NodeId[] };
const steps: Step[] = [
  { title: "A quick safety check", text: "Model Armor screens the request before any Gemini call.", edges: ["screen"], focus: "armor", nodes: ["query", "armor"] },
  { title: "Meet your stylist", text: "The ADK agent reads the occasion, summer intent and ₹5,000 budget.", edges: ["allow"], focus: "agent", nodes: ["armor", "agent"] },
  { title: "The agent calls a tool", text: "find_outfit_candidates() starts a wardrobe-aware outfit search.", edges: ["tool"], focus: "rag", nodes: ["agent", "rag"] },
  { title: "Two branches, one personal search", text: "Read your confirmed wardrobe and sizes; embed the search intent.", edges: ["embed", "context"], focus: "firestore", nodes: ["rag", "embedding", "firestore"] },
  { title: "Find clothes by meaning", text: "Vertex AI embeddings power a semantic catalogue search in Firestore.", edges: ["search"], focus: "firestore", nodes: ["embedding", "firestore"] },
  { title: "Ground it in real products", text: "Bring back catalogue candidates with current prices, variants and stock.", edges: ["facts"], focus: "rag", nodes: ["firestore", "rag"] },
  { title: "Connect it to your wardrobe", text: "Ask WardrobeGraph how candidate products connect to previously checked outfits.", edges: ["coverage"], focus: "graph", nodes: ["rag", "graph"] },
  { title: "Use the evidence", text: "Existing wardrobe matches help rank the options when graph evidence is available.", edges: ["evidence"], focus: "rag", nodes: ["graph", "rag"] },
  { title: "Build and assess the looks", text: "Filter for budget, size and stock; Gemini assesses the shortlist for the occasion.", edges: ["assess"], focus: "agent", nodes: ["rag", "agent"] },
  { title: "One final check", text: "Recheck product availability and save validated looks and conversation records.", edges: ["save"], focus: "firestore", nodes: ["rag", "firestore"] },
  { title: "Your looks arrive", text: "The stylist explains the checked options; Cloud Storage supplies their images.", edges: ["answer", "images"], focus: "response", nodes: ["agent", "storage", "response"] },
  { title: "Keep the graph up to date", text: "Queue a refresh in the background—the shopper already has their recommendations.", edges: ["enqueue"], focus: "tasks", nodes: ["rag", "tasks"] },
  { title: "Let the worker handle it", text: "Cloud Tasks dispatches the graph-sync job to a private Cloud Run worker.", edges: ["dispatch"], focus: "worker", nodes: ["tasks", "worker"] },
  { title: "Ready for the next request", text: "Sync eligible, checked outfit relationships into WardrobeGraph for future searches.", edges: ["sync"], focus: "graph", nodes: ["worker", "graph"] },
];

export default function BehindTheScenes() {
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const current = steps[step];
  const inspected = nodes.find((node) => node.id === selected);
  const finished = step === steps.length - 1 && !running;
  const visited = new Set(steps.slice(0, step + 1).flatMap((item) => item.nodes));
  const traversed = new Set(steps.slice(0, step + 1).flatMap((item) => item.edges));

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      if (step >= steps.length - 1) setRunning(false);
      else setStep((value) => value + 1);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [running, step]);

  useEffect(() => {
    const container = scroller.current;
    if (!container || !current || container.scrollWidth <= container.clientWidth) return;
    const node = nodes.find((item) => item.id === current.focus)!;
    // Follow the journey within the small-screen canvas, without moving the page.
    container.scrollTo({ left: node.x / 1200 * container.scrollWidth - container.clientWidth / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [current]);

  function play() {
    setSelected(null);
    if (running) { setRunning(false); return; }
    if (step < 0 || finished) setStep(0);
    setRunning(true);
  }
  function reset() {
    setRunning(false); setStep(-1); setSelected(null);
    scroller.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <h1>From a thought to a look.</h1>
        <span className={styles.demoBadge}><span /> Interactive demo</span>
      </div>
      <div className={styles.queryBar}>
        <span className={styles.queryIcon}><MessageCircle size={21} /></span>
        <div><p>“Find some summer party clothes for me under 5000”</p><span><Shirt size={13} /> Wardrobe enabled <i /> Budget ₹5,000</span></div>
        <Button onClick={play} className={styles.play} aria-label={running ? "Pause journey" : finished ? "Replay journey" : step < 0 ? "Play journey" : "Resume journey"}>
          {running ? <Pause size={16} /> : finished ? <RotateCcw size={16} /> : <Play size={16} fill="currentColor" />}
          {running ? "Pause" : finished ? "Replay" : step < 0 ? "Play" : "Resume"}
        </Button>
      </div>

      <section className={styles.panel} aria-label="Interactive GCP recommendation journey">
        <div className={styles.canvasHeader}>
          <span><Sparkles size={14} /> One request. A few thoughtful connections.</span>
          <span className={styles.canvasHint}>Click a node to explore</span>
          <span className={styles.mobileHint}>Swipe to explore →</span>
        </div>
        <div className={styles.scroll} ref={scroller} tabIndex={0} aria-label="Architecture graph; scroll horizontally on smaller screens">
          <div className={styles.canvas}>
            <div className={styles.runtime}>CLOUD RUN · GOOGLE ADK + BACKEND TOOLS</div>
            <svg className={styles.connections} viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="journey-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8" fill="context-stroke" /></marker>
              </defs>
              {edges.map((edge) => {
                const active = current?.edges.includes(edge.id);
                const done = traversed.has(edge.id);
                // The same Firestore connection is reused for reads and final checks.
                if (edge.id === "save" && !active) return null;
                if (edge.id === "context" && current?.edges.includes("save")) return null;
                return <g key={edge.id} className={`${styles.edge} ${edge.background ? styles.asyncEdge : ""} ${done ? styles.traversed : ""} ${active ? styles.activeEdge : ""}`}>
                  <path d={edge.path} markerEnd="url(#journey-arrow)" />
                  {(edge.always || active) && <text x={edge.x} y={edge.y} textAnchor="middle">{edge.label}</text>}
                  {active && running && <circle r="4" className={styles.packet}><animateMotion dur="1.8s" path={edge.path} repeatCount="indefinite" /></circle>}
                </g>;
              })}
            </svg>
            {nodes.map((node) => {
              const active = current?.nodes.includes(node.id);
              const Glyph = node.glyph || Sparkles;
              return <button type="button" key={node.id} aria-label={`Explore ${node.title}`} aria-pressed={selected === node.id}
                className={`${styles.node} ${styles[node.kind]} ${active ? styles.activeNode : ""} ${visited.has(node.id) ? styles.visited : ""} ${selected === node.id ? styles.selected : ""}`}
                style={{ left: `${node.x / 12}%`, top: `${node.y / 5.6}%` } as CSSProperties}
                onClick={() => { setSelected(node.id); setRunning(false); }}>
                <span className={styles.nodeIcon}>
                  {node.icon ? <Image src={`/images/architecture/${node.icon}.svg`} width={34} height={34} alt="" /> : <Glyph size={27} strokeWidth={1.7} />}
                  {visited.has(node.id) && !active && <span className={styles.check}><Check size={9} strokeWidth={3} /></span>}
                </span>
                <strong>{node.title}</strong><small>{node.subtitle}</small>
                {node.id === "agent" && <small className={styles.model}>gemini-3.8-flash</small>}
              </button>;
            })}
            <span className={styles.backgroundLabel}>AFTER THE RESPONSE · ASYNC</span>
            {step >= 10 && <span className={styles.responseReady}><Check size={12} /> Looks ready</span>}
          </div>
        </div>
        <div className={styles.playback}>
          <div className={styles.progress} aria-label="Journey steps">
            {steps.map((item, index) => <button key={item.title} type="button" aria-label={`Step ${index + 1}: ${item.title}`} aria-current={step === index ? "step" : undefined}
              className={index <= step ? styles.progressDone : ""} title={item.title}
              onClick={() => { setRunning(false); setSelected(null); setStep(index); }} />)}
          </div>
          <span className={styles.stepCount}>{step < 0 ? "Ready when you are" : `${String(step + 1).padStart(2, "0")} / ${steps.length}`}</span>
          <button className={styles.control} onClick={() => { setRunning(false); setSelected(null); setStep((value) => Math.min(value + 1, steps.length - 1)); }} disabled={step === steps.length - 1} aria-label="Next step"><SkipForward size={17} /></button>
          <button className={styles.control} onClick={reset} disabled={step < 0} aria-label="Reset journey"><RotateCcw size={16} /></button>
        </div>
      </section>

      <div className={styles.caption}>
        <span className={styles.captionIcon}>{inspected ? <CircleHelp size={21} /> : finished ? <Check size={21} /> : <Sparkles size={21} />}</span>
        <div className={styles.captionText} aria-live="polite" aria-atomic="true">
          <h2>{inspected?.title || current?.title || "Follow the little spark."}</h2>
          <p>{inspected?.detail || current?.text || "Press play to follow the request, or explore any node at your own pace."}</p>
          {inspected && <code>{inspected.technical}</code>}
        </div>
        {inspected && <button className={styles.backToStep} onClick={() => setSelected(null)}>Back to journey <ArrowRight size={14} /></button>}
      </div>
      <footer className={styles.footer}>
        <span><i className={styles.legendDot} /> Request & tools <i className={styles.legendData} /> Data & models <i className={styles.legendAsync} /> Background work</span>
        <span>Illustrative flow · no live requests</span>
      </footer>
    </main>
  );
}
