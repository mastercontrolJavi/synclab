import { cn } from "@/lib/utils";

/** The mark: you (solid cyan) a step ahead of the server's ghost (dashed lime). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="var(--surface-2)" stroke="var(--line-strong)" />
      <circle cx="12.5" cy="17.5" r="6" fill="none" stroke="var(--c-server)" strokeWidth="1.6" strokeDasharray="2.4 2" />
      <circle cx="19" cy="13.5" r="6" fill="var(--c-predicted)" />
      <circle cx="19" cy="13.5" r="1.8" fill="var(--surface-0)" />
    </svg>
  );
}
