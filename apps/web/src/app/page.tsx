import { randomUUID } from "node:crypto";

import { ROOM_ID_PATTERN } from "@synclab/shared";
import { redirect } from "next/navigation";

import { LabDashboard } from "@/features/lab/components/lab-dashboard";
import type { ServerPreference } from "@/features/lab/use-lab-session";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseServerPreference(value: unknown): ServerPreference {
  return value === "live" || value === "local" ? value : "auto";
}

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const requestedRoom = typeof query.room === "string" ? query.room.toLowerCase() : "";
  const serverPreference = parseServerPreference(query.server);

  if (!ROOM_ID_PATTERN.test(requestedRoom)) {
    const roomId = randomUUID().replaceAll("-", "").slice(0, 6).toLowerCase();
    redirect(`/?room=${roomId}${serverPreference === "auto" ? "" : `&server=${serverPreference}`}`);
  }

  return (
    <LabDashboard
      roomId={requestedRoom}
      serverPreference={serverPreference}
      showIntro={query.intro !== "0"}
    />
  );
}
