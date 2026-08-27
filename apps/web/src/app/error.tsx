"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center">
        <AlertTriangle className="mx-auto size-5 text-amber-300" aria-hidden="true" />
        <h1 className="mt-3 text-sm font-semibold">The lab stopped unexpectedly</h1>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          The networking session can be restarted without changing the room link.
        </p>
        <Button className="mt-4" size="sm" onClick={reset}>
          <RefreshCw data-icon="inline-start" />
          Restart lab
        </Button>
      </div>
    </main>
  );
}
