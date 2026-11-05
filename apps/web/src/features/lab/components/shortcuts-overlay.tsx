"use client";

import { MotionOverlay } from "@/components/ui/motion-overlay";

export const SHORTCUT_GROUPS: readonly { title: string; items: readonly { keys: readonly string[]; label: string }[] }[] = [
  {
    title: "Move",
    items: [
      { keys: ["W", "A", "S", "D"], label: "Move your player (arrow keys work too)" },
    ],
  },
  {
    title: "Network",
    items: [
      { keys: ["1"], label: "Perfect LAN" },
      { keys: ["2"], label: "Bad Wi-Fi" },
      { keys: ["3"], label: "Mobile 3G" },
      { keys: ["4"], label: "Chaos" },
    ],
  },
  {
    title: "Netcode",
    items: [
      { keys: ["P"], label: "Toggle client prediction" },
      { keys: ["R"], label: "Toggle server reconciliation" },
      { keys: ["I"], label: "Toggle remote interpolation" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: ["V"], label: "Compare / single view" },
      { keys: ["G"], label: "Ghosts" },
      { keys: ["T"], label: "Replay trail" },
      { keys: ["K"], label: "Packets" },
      { keys: ["H"], label: "How it works" },
      { keys: ["?"], label: "This list" },
      { keys: ["Esc"], label: "Close any panel" },
    ],
  },
];

export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <MotionOverlay open={open} onClose={onClose} placement="center" title="Keyboard shortcuts" description="Everything in the lab is one key away." zIndex={60}>
      <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="eyebrow mb-2">{group.title}</h3>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 text-[13px] text-ink-muted">
                  <span>{item.label}</span>
                  <span className="flex shrink-0 gap-1">
                    {item.keys.map((key) => (
                      <kbd key={key} className="kbd">
                        {key}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </MotionOverlay>
  );
}
