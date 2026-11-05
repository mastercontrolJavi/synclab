"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { DURATION, EASE, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface MotionOverlayProps {
  open: boolean;
  onClose: () => void;
  /** center = dialog, right = drawer, bottom = sheet */
  placement: "center" | "right" | "bottom";
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  zIndex?: number;
}

/**
 * Dialog / drawer / bottom sheet with GSAP enter and exit. Always mounted,
 * so the exit animation can play; hidden panels are `inert`.
 */
export function MotionOverlay({
  open,
  onClose,
  placement,
  title,
  description,
  children,
  className,
  zIndex = 50,
}: MotionOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const panel = panelRef.current;
      const backdrop = backdropRef.current;
      if (!root || !panel || !backdrop) {
        return;
      }
      const reduce = prefersReducedMotion();
      const hidden =
        placement === "right"
          ? { xPercent: 100, yPercent: 0, scale: 1 }
          : placement === "bottom"
            ? { yPercent: 100, xPercent: 0, scale: 1 }
            : { yPercent: 0, xPercent: 0, y: 12, scale: 0.97 };
      if (open) {
        gsap.set(root, { autoAlpha: 1 });
        gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: DURATION.base, ease: EASE.out });
        if (reduce) {
          gsap.fromTo(panel, { opacity: 0 }, { opacity: 1, xPercent: 0, yPercent: 0, y: 0, scale: 1, duration: DURATION.base });
        } else {
          gsap.fromTo(
            panel,
            { ...hidden, opacity: placement === "center" ? 0 : 1 },
            { xPercent: 0, yPercent: 0, y: 0, scale: 1, opacity: 1, duration: DURATION.slow, ease: EASE.out },
          );
        }
      } else {
        const timeline = gsap.timeline({ onComplete: () => void gsap.set(root, { autoAlpha: 0 }) });
        timeline.to(backdrop, { opacity: 0, duration: DURATION.base, ease: EASE.in }, 0);
        timeline.to(
          panel,
          reduce
            ? { opacity: 0, duration: DURATION.base }
            : { ...hidden, opacity: placement === "center" ? 0 : 1, duration: DURATION.base + 0.06, ease: EASE.in },
          0,
        );
      }
    },
    { dependencies: [open, placement], scope: rootRef },
  );

  useEffect(() => {
    if (!open) {
      returnFocus.current?.focus?.();
      return;
    }
    returnFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  return (
    <div
      ref={rootRef}
      className="invisible fixed inset-0 opacity-0"
      style={{ zIndex }}
      inert={!open}
      aria-hidden={!open}
    >
      <div ref={backdropRef} className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col border-line-strong bg-surface-1 shadow-pop outline-none",
          placement === "center" && "top-1/2 left-1/2 max-h-[85dvh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border",
          placement === "right" && "inset-y-0 right-0 w-[min(560px,100vw)] border-l",
          placement === "bottom" && "inset-x-0 bottom-0 max-h-[82dvh] rounded-t-2xl border-t",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
