export const SITE = {
  name: "SyncLab",
  tagline: "Multiplayer netcode, made visible.",
  pitch:
    "A live multiplayer lab where you can see client prediction, server reconciliation and interpolation fight real latency, jitter and packet loss.",
  author: "Javier",
  github: "https://github.com/mastercontrolJavi/synclab",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://synclab.vercel.app",
  stack: ["Next.js 16", "React 19", "TypeScript", "Canvas 2D", "WebSockets", "GSAP", "Tailwind v4"],
} as const;
