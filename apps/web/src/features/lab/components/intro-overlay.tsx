"use client";

import { ArrowRight, BookOpen } from "lucide-react";
import { useEffect, useRef } from "react";

import { GithubIcon } from "@/components/brand/github-icon";
import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { DURATION, EASE, gsap, prefersReducedMotion, STAGGER, useGSAP } from "@/lib/motion";
import { SITE } from "@/lib/site";

interface IntroOverlayProps {
  open: boolean;
  serverLine: string;
  serverReady: boolean;
  onLaunch: () => void;
  onHowItWorks: () => void;
}

const BULLETS: readonly { color: string; text: string }[] = [
  {
    color: "var(--c-predicted)",
    text: "Two clients on the same bad network. The left one waits for the server. The right one predicts.",
  },
  {
    color: "var(--c-server)",
    text: "Cyan is you, the lime ghost is the server's truth, and an amber flash is a correction being replayed.",
  },
  {
    color: "var(--c-dropped)",
    text: "Every dot in the lane is a real message. Its speed is the latency. Red means it was lost.",
  },
];

/**
 * Landing state. The live lab is already running (on autopilot) underneath,
 * so the hero background is real netcode, not a video.
 */
export function IntroOverlay({ open, serverLine, serverReady, onLaunch, onHowItWorks }: IntroOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const reduce = prefersReducedMotion();
      if (open) {
        gsap.set(root, { autoAlpha: 1 });
        if (reduce) {
          gsap.fromTo("[data-intro], [data-intro-char]", { opacity: 0 }, { opacity: 1, duration: DURATION.slow });
          return;
        }
        // fromTo with explicit end values: a .from() can read a mid-transition
        // value as its target (StrictMode double-run) and get stuck invisible.
        const shown = { opacity: 1, x: 0, y: 0, yPercent: 0, scale: 1, rotate: 0 };
        const timeline = gsap.timeline({ defaults: { ease: EASE.out } });
        timeline
          .fromTo("[data-intro='mark']", { scale: 0.6, opacity: 0, rotate: -12 }, { ...shown, duration: DURATION.xslow, ease: EASE.pop })
          .fromTo("[data-intro='eyebrow']", { y: 10, opacity: 0 }, { ...shown, duration: DURATION.slow }, "-=0.55")
          .fromTo("[data-intro-char]", { yPercent: 110, opacity: 0 }, { ...shown, duration: DURATION.xslow, stagger: 0.035 }, "-=0.3")
          .fromTo("[data-intro='pitch']", { y: 14, opacity: 0 }, { ...shown, duration: DURATION.xslow }, "-=0.55")
          .fromTo("[data-intro='bullet']", { x: -12, opacity: 0 }, { ...shown, duration: DURATION.slow, stagger: STAGGER.loose }, "-=0.45")
          .fromTo("[data-intro='cta']", { y: 10, opacity: 0, scale: 0.96 }, { ...shown, duration: DURATION.slow, stagger: STAGGER.base }, "-=0.25")
          .fromTo("[data-intro='meta']", { opacity: 0 }, { opacity: 1, duration: DURATION.slow }, "-=0.2");
      } else {
        const timeline = gsap.timeline({ onComplete: () => void gsap.set(root, { autoAlpha: 0 }) });
        if (reduce) {
          timeline.to(root, { opacity: 0, duration: DURATION.base });
        } else {
          timeline
            .to("[data-intro-content]", { y: -24, opacity: 0, scale: 0.98, duration: DURATION.slow, ease: EASE.in })
            .to(root, { opacity: 0, duration: DURATION.slow, ease: EASE.inOut }, "-=0.15");
        }
      }
    },
    { dependencies: [open], scope: rootRef },
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    launchRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        onLaunch();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onLaunch]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 70 }}
      inert={!open}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% 10%, oklch(0.84 0.14 205 / 0.10), transparent 60%), radial-gradient(900px 500px at 90% 90%, oklch(0.89 0.19 130 / 0.06), transparent 60%), oklch(0.118 0.007 255 / 0.9)",
        }}
        aria-hidden="true"
      />
      <div data-intro-content className="relative mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16 sm:px-10">
        <div data-intro="mark" className="mb-6 w-fit">
          <LogoMark className="size-12" />
        </div>
        <p data-intro="eyebrow" className="eyebrow !text-brand">
          Multiplayer netcode lab · live
        </p>
        <h1 id="intro-title" className="mt-3 overflow-hidden text-[56px] leading-[1] font-semibold tracking-[-0.04em] text-ink sm:text-[88px]" aria-label={SITE.name}>
          {SITE.name.split("").map((char, index) => (
            <span key={`${char}-${index}`} data-intro-char className="inline-block" aria-hidden="true">
              {char}
            </span>
          ))}
        </h1>
        <p data-intro="pitch" className="mt-5 max-w-xl text-[17px] leading-7 text-ink-muted sm:text-[19px] sm:leading-8">
          See how online games feel instant on a laggy connection. Client prediction, server reconciliation and interpolation, running live against latency, jitter and packet loss you control.
        </p>

        <div className="mt-8">
          <h2 data-intro="eyebrow" className="eyebrow">
            What you&apos;re seeing
          </h2>
          <ul className="mt-3 space-y-2.5">
            {BULLETS.map((bullet) => (
              <li key={bullet.text} data-intro="bullet" className="flex gap-3 text-[14.5px] leading-6 text-ink">
                <span className="mt-2 size-2 shrink-0 rounded-full" style={{ background: bullet.color, boxShadow: `0 0 12px ${bullet.color}` }} aria-hidden="true" />
                {bullet.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button
            ref={launchRef}
            data-intro="cta"
            size="lg"
            onClick={onLaunch}
            className="h-12 rounded-xl px-5 text-[15px] shadow-glow-accent transition-[background-color,box-shadow]"
          >
            Launch lab
            <ArrowRight className="size-4" aria-hidden="true" />
            <kbd className="ml-1 rounded border border-brand-ink/25 px-1.5 font-mono text-[11px] text-brand-ink/70">↵</kbd>
          </Button>
          <Button data-intro="cta" size="lg" variant="ghost" onClick={onHowItWorks} className="h-12 rounded-xl px-4 text-[15px] text-ink-muted transition-[background-color,color] hover:text-ink">
            <BookOpen className="size-4" aria-hidden="true" />
            How it works
          </Button>
        </div>

        <p data-intro="meta" className="mt-4 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
          It starts on autopilot. Press
          {["W", "A", "S", "D"].map((key) => (
            <kbd key={key} className="kbd !text-ink">
              {key}
            </kbd>
          ))}
          any time to take control.
        </p>

        <div data-intro="meta" className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-ink-faint">
          <span className="flex items-center gap-2">
            <span className={serverReady ? "size-1.5 rounded-full bg-server" : "size-1.5 animate-pulse rounded-full bg-ink-muted"} aria-hidden="true" />
            {serverLine}
          </span>
          <a href={SITE.github} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <GithubIcon className="size-3.5" />
            Source
          </a>
          <span>Built by {SITE.author}</span>
        </div>
      </div>
    </div>
  );
}
