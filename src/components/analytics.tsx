"use client";

import { useEffect, useState } from "react";
import { Bookmark, Heart, LoaderCircle, RefreshCw, ShoppingBag, Sparkles, WandSparkles } from "lucide-react";
import styles from "./analytics.module.css";

// Deterministic sample cohorts until production analytics are available.
const cohorts = {
  all: { label: "All stores", counts: [320, 260, 76, 40], responses: 200, happy: 168, saved: 118, tried: 92 },
  studio: { label: "Studio — demo", counts: [180, 150, 48, 26], responses: 112, happy: 96, saved: 70, tried: 56 },
  everyday: { label: "Everyday — demo", counts: [140, 110, 28, 14], responses: 88, happy: 72, saved: 48, tried: 36 },
};
const stageNames = ["Asked stylist", "Options found", "Checkout opened", "Demo order"];
const dropNames = ["without options", "without checkout", "without an order"];
const reasonLabels = [
  ["Size unavailable", "Over budget", "Style mismatch", "Unknown"],
  ["Still browsing", "Saved for later", "Price concerns", "Unknown"],
  ["Delivery cost", "Payment abandoned", "Changed mind", "Unknown"],
];
const reasonWeights = [[16, 8, 6, 30], [64, 46, 28, 46], [10, 8, 6, 12]];
const percent = (n: number, total: number) => `${Number((n / total * 100).toFixed(1))}%`;

export function Analytics() {
  const [store, setStore] = useState<keyof typeof cohorts>("all");
  const [days, setDays] = useState("30");
  const [drop, setDrop] = useState(0);
  const [reportVersion, setReportVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 2000);
    return () => window.clearTimeout(timer);
  }, [reportVersion]);
  const cohort = cohorts[store];
  const scale = Number(days) / 30;
  const count = (n: number) => Math.round(n * scale);
  const values = cohort.counts.map(count);
  const losses = values.slice(0, 3).map((n, i) => n - values[i + 1]);
  const weights = reasonWeights[drop];
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  const reasons = weights.slice(0, 3).map((n) => Math.floor(n / weightTotal * losses[drop]));
  reasons.push(losses[drop] - reasons.reduce((a, b) => a + b, 0));
  const heights = values.map((n) => 128 * n / values[0]);

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div><h1>Analytics</h1><span className={styles.badge}>Demo data</span></div>
        <div className={styles.filters}>
          <select aria-label="Store" value={store} onChange={(e) => setStore(e.target.value as keyof typeof cohorts)}>
            {Object.entries(cohorts).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
          </select>
          <select aria-label="Date range" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      <section className={`${styles.panel} ${styles.report}`} aria-label="Daily AI summary report" aria-busy={loading}>
        <div className={styles.panelHeading}>
          <div className={styles.reportTitle}><span className={styles.reportIcon}><Sparkles size={20} /></span><div><h2>Daily AI summary report</h2><span>Today · Sample report</span></div></div>
          <button className={styles.refresh} disabled={loading} onClick={() => { setLoading(true); setReportVersion((n) => n + 1); }} aria-label="Refresh daily report"><RefreshCw size={16} /> <span>Refresh</span></button>
        </div>
        <div className={styles.reportBody} aria-live="polite">
          {loading ? <div role="status" className={styles.loading}><span><LoaderCircle size={16} className={styles.spin} />Preparing summary…</span><div className={styles.skeleton} /><div className={styles.skeleton} /><div className={styles.skeleton} /></div> : <><p>Shoppers are mostly looking for summer outfits around ₹1,500–₹3,000. Lightweight fabrics and relaxed fits come up often, especially for work and travel.</p><p className={styles.reportDetail}>Cotton shirts, linen trousers and easy-to-layer separates are recurring requests. Shoppers want pieces they can wear to the office and reuse on weekends.</p><div className={styles.action}><h3>Suggested action</h3><p>Feature summer workwear within this price range.</p><p className={styles.actionDetail}>Start with breathable shirts and relaxed trousers. Show complete outfit prices and available sizes upfront.</p></div></>}
        </div>
      </section>

      <section className={styles.metrics} aria-label="Key metrics">
        <article className={styles.metric}><span><Sparkles size={17} />Options found</span><strong>{percent(values[1], values[0])}</strong><p>{values[1]} of {values[0]} assistance sessions</p></article>
        <article className={styles.metric}><span><Heart size={17} />“Found my look”</span><strong>{percent(count(cohort.happy), count(cohort.responses))}</strong><p>{count(cohort.happy)} of {count(cohort.responses)} responses · {percent(count(cohort.responses), values[0])} responded</p></article>
        <article className={styles.metric}><span><ShoppingBag size={17} />Demo order completion</span><strong>{percent(values[3], values[0])}</strong><p>{values[3]} mock orders · {values[0]} sessions</p></article>
      </section>

      <section className={styles.panel} aria-label="Shopping funnel">
        <div className={styles.panelHeading}><h2>Shopping funnel</h2><span>{values[0]} assisted sessions</span></div>
        <div className={styles.stages}>
          {stageNames.map((name, i) => <div key={name}><span>{name}</span><strong>{values[i]}</strong></div>)}
        </div>
        <svg className={styles.funnel} viewBox="0 0 1000 150" role="img" aria-label={stageNames.map((name, i) => `${name}: ${values[i]}`).join(", ")}>
          {values.slice(0, 3).map((_, i) => {
            const x = 125 + i * 250, next = x + 250, h = heights[i] / 2, nh = heights[i + 1] / 2;
            return <path key={i} fill={["#f2d0df", "#edbace", "#e7a2bd"][i]} d={`M ${x} ${75-h} C ${x+125} ${75-h}, ${next-125} ${75-nh}, ${next} ${75-nh} L ${next} ${75+nh} C ${next-125} ${75+nh}, ${x+125} ${75+h}, ${x} ${75+h} Z`} />;
          })}
          {heights.map((h, i) => <rect key={i} x={122 + i * 250} y={75-h/2} width="6" height={h} rx="3" fill="#b83f69" />)}
        </svg>
        <div className={styles.drops} aria-label="Explore drop-offs">
          {losses.map((n, i) => <button key={i} aria-pressed={drop === i} onClick={() => setDrop(i)}>{n} {dropNames[i]} <span aria-hidden="true">↗</span></button>)}
        </div>
        <div className={styles.optional}><span>Optional steps</span><span><Bookmark size={16} />{count(cohort.saved)} saved a look</span><span><WandSparkles size={16} />{count(cohort.tried)} tried on</span></div>
        <div className={styles.reasons} aria-live="polite">
          <div className={styles.panelHeading}><h3>{losses[drop]} sessions {dropNames[drop]}</h3><span>Shopper-reported reasons</span></div>
          <div className={styles.bars}>{reasonLabels[drop].map((label, i) => <div key={label}><div><span>{label}</span><strong>{reasons[i]}</strong></div><div className={styles.track}><div style={{ width: `${reasons[i] / losses[drop] * 100}%` }} /></div></div>)}</div>
          <p className={styles.note}>Unknown means no reason was recorded.</p>
        </div>
      </section>


    </main>
  );
}
