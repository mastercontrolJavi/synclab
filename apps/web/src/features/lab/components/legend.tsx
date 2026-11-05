"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CONCEPTS, type Concept } from "@/lib/concepts";
import { cn } from "@/lib/utils";

const SWATCHES: Record<Concept, string> = {
  predicted: "bg-predicted",
  server: "border border-dashed border-server bg-server/20",
  remote: "bg-remote",
  rollback: "bg-rollback",
  dropped: "bg-dropped",
};

const ORDER: readonly Concept[] = ["predicted", "server", "remote", "rollback", "dropped"];

/** The concept legend. Same colors as the canvas, packets and sparklines. */
export function Legend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)} aria-label="Legend" data-tour="legend">
      {ORDER.map((key) => {
        const concept = CONCEPTS[key];
        return (
          <li key={key} data-reveal>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="flex cursor-help items-center gap-1.5 rounded text-[12.5px] text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring">
                  <span className={cn("size-2.5 rounded-full", SWATCHES[key])} aria-hidden="true" />
                  {concept.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{concept.description}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
