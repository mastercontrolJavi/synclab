import { randomUUID } from "node:crypto";

import { ROOM_ID_PATTERN } from "@synclab/shared";
import { redirect } from "next/navigation";

import { LabDashboard } from "@/features/lab/components/lab-dashboard";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const requestedRoom = typeof query.room === "string" ? query.room.toLowerCase() : "";
  const debug = query.debug === "true";

  if (!ROOM_ID_PATTERN.test(requestedRoom)) {
    const roomId = randomUUID().replaceAll("-", "").slice(0, 6).toLowerCase();
    redirect(`/?room=${roomId}${debug ? "&debug=true" : ""}`);
  }

  return <LabDashboard roomId={requestedRoom} debug={debug} />;
}
