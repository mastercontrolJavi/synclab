"use client";

import { useRef } from "react";

import { MotionOverlay } from "@/components/ui/motion-overlay";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/motion";

interface HowItWorksProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS: readonly { title: string; color: string; body: string }[] = [
  {
    title: "1. Client prediction",
    color: "var(--c-predicted)",
    body: "The client runs the same movement function as the server the moment you press a key, so you move instantly. The input also goes to the server, tagged with a sequence number.",
  },
  {
    title: "2. Authoritative server",
    color: "var(--c-server)",
    body: "The server owns the truth. It applies queued inputs on a fixed 30 Hz tick, resolves the tag game, and sends a snapshot 20 times a second with the last input it processed for each player.",
  },
  {
    title: "3. Reconciliation",
    color: "var(--c-rollback)",
    body: "When a snapshot arrives, the client jumps to the server's position, drops inputs the server has already applied, and replays the rest. If a packet was lost, that replay lands somewhere new. That is the amber flash.",
  },
  {
    title: "4. Interpolation",
    color: "var(--c-remote)",
    body: "You can't predict another person's keys. Other players are drawn 100 ms in the past, blended between two known snapshots, so jitter becomes smooth motion instead of stutter.",
  },
];

/** Animated diagram of one round trip through the netcode loop. */
function LoopDiagram() {
  const ref = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        return;
      }
      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
      timeline
        .fromTo("[data-step='predict']", { opacity: 0.35 }, { opacity: 1, duration: 0.25 })
        .to("[data-dot='input']", { opacity: 1, duration: 0.1 }, "<")
        .to("[data-dot='input']", {
          motionPath: { path: "#loop-up", align: "#loop-up", alignOrigin: [0.5, 0.5] },
          duration: 1.1,
          ease: "none",
        })
        .to("[data-dot='input']", { opacity: 0, duration: 0.1 })
        .fromTo("[data-step='simulate']", { opacity: 0.35 }, { opacity: 1, duration: 0.25 }, "<")
        .to("[data-dot='snapshot']", { opacity: 1, duration: 0.1 })
        .to("[data-dot='snapshot']", {
          motionPath: { path: "#loop-down", align: "#loop-down", alignOrigin: [0.5, 0.5] },
          duration: 1.1,
          ease: "none",
        })
        .to("[data-dot='snapshot']", { opacity: 0, duration: 0.1 })
        .fromTo("[data-step='reconcile']", { opacity: 0.35 }, { opacity: 1, duration: 0.25 }, "<")
        .fromTo("[data-flash]", { opacity: 0, scale: 0.6, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1.4, duration: 0.3 }, "<")
        .to("[data-flash]", { opacity: 0, duration: 0.4 })
        .to("[data-step]", { opacity: 0.35, duration: 0.4 }, "+=0.3");
    },
    { scope: ref },
  );

  return (
    <svg ref={ref} viewBox="0 0 520 230" className="h-auto w-full" role="img" aria-labelledby="loop-title loop-desc">
      <title id="loop-title">The client-server netcode loop</title>
      <desc id="loop-desc">
        The client predicts and sends an input. The server simulates and returns a snapshot with an acknowledgement. The client reconciles.
      </desc>
      <defs>
        <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 8 4 0 8Z" fill="var(--text-faint)" />
        </marker>
      </defs>

      {/* Client */}
      <rect x="8" y="20" width="150" height="190" rx="12" fill="var(--surface-2)" stroke="var(--c-predicted)" strokeOpacity="0.5" />
      <text x="24" y="44" fill="var(--c-predicted)" fontFamily="var(--font-geist-mono)" fontSize="11" letterSpacing="1">CLIENT</text>
      <g data-step="predict" opacity="0.35">
        <circle cx="30" cy="74" r="7" fill="var(--c-predicted)" />
        <text x="44" y="72" fill="var(--text)" fontSize="12">Predict</text>
        <text x="44" y="87" fill="var(--text-muted)" fontSize="10.5">move now, send #108</text>
      </g>
      <g data-step="reconcile" opacity="0.35">
        <circle cx="30" cy="160" r="7" fill="var(--c-rollback)" />
        <text x="44" y="158" fill="var(--text)" fontSize="12">Reconcile</text>
        <text x="44" y="173" fill="var(--text-muted)" fontSize="10.5">rewind, replay #109+</text>
      </g>
      <circle data-flash cx="30" cy="160" r="12" fill="none" stroke="var(--c-rollback)" strokeWidth="2" opacity="0" />

      {/* Server */}
      <rect x="362" y="20" width="150" height="190" rx="12" fill="var(--surface-2)" stroke="var(--c-server)" strokeOpacity="0.5" />
      <text x="378" y="44" fill="var(--c-server)" fontFamily="var(--font-geist-mono)" fontSize="11" letterSpacing="1">SERVER</text>
      <g data-step="simulate" opacity="0.35">
        <circle cx="384" cy="116" r="7" fill="var(--c-server)" />
        <text x="398" y="106" fill="var(--text)" fontSize="12">Simulate</text>
        <text x="398" y="121" fill="var(--text-muted)" fontSize="10.5">30 Hz fixed tick</text>
        <text x="398" y="136" fill="var(--text-muted)" fontSize="10.5">snapshot 20 Hz</text>
      </g>

      {/* Network */}
      <text x="260" y="16" textAnchor="middle" fill="var(--text-faint)" fontFamily="var(--font-geist-mono)" fontSize="10">
        SIMULATED NETWORK · delay · jitter · loss
      </text>
      <path id="loop-up" d="M158 80 C 230 40, 290 40, 362 80" fill="none" stroke="var(--line-strong)" strokeDasharray="3 4" markerEnd="url(#arrow)" />
      <path id="loop-down" d="M362 150 C 290 190, 230 190, 158 150" fill="none" stroke="var(--line-strong)" strokeDasharray="3 4" markerEnd="url(#arrow)" />
      <text x="260" y="58" textAnchor="middle" fill="var(--c-predicted)" fontSize="10.5" fontFamily="var(--font-geist-mono)">input #108 (direction only)</text>
      <text x="260" y="182" textAnchor="middle" fill="var(--c-server)" fontSize="10.5" fontFamily="var(--font-geist-mono)">snapshot · ack #108</text>
      <circle data-dot="input" r="5" fill="var(--c-predicted)" opacity="0" cx="158" cy="80" />
      <circle data-dot="snapshot" r="5.5" fill="var(--c-server)" opacity="0" cx="362" cy="150" />
    </svg>
  );
}

export function HowItWorks({ open, onClose }: HowItWorksProps) {
  return (
    <MotionOverlay
      open={open}
      onClose={onClose}
      placement="right"
      title="How it works"
      description="One authoritative server, two clients and four techniques."
      zIndex={50}
    >
      <div className="space-y-6 px-5 py-5">
        <div className="rounded-xl border border-line bg-surface-0 p-3">{open ? <LoopDiagram /> : null}</div>
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <section key={section.title} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: section.color }} aria-hidden="true" />
              <div>
                <h3 className="text-[14px] font-semibold tracking-tight text-ink">{section.title}</h3>
                <p className="mt-1 text-[13px] leading-6 text-ink-muted">{section.body}</p>
              </div>
            </section>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-surface-0 p-4">
          <h3 className="eyebrow">Honest about the transport</h3>
          <p className="mt-2 text-[13px] leading-6 text-ink-muted">
            WebSockets run over TCP. SyncLab simulates delay, jitter and loss per application message on the client, in both directions. It does not model TCP retransmission. If the free-tier server is asleep, the identical authoritative server code runs in your tab, behind the same simulated network.
          </p>
        </div>
      </div>
    </MotionOverlay>
  );
}
