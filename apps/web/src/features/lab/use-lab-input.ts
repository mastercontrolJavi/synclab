"use client";

import { WORLD_HEIGHT, WORLD_WIDTH } from "@synclab/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import type { GameClient } from "./game-client";

const MOVEMENT_KEYS: Record<string, [number, number]> = {
  w: [0, -1],
  arrowup: [0, -1],
  s: [0, 1],
  arrowdown: [0, 1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
};

const AUTOPILOT_TICK_MS = 50;
/** Hand control back to the autopilot after this much idle time. */
const AUTOPILOT_RESUME_MS = 6_000;
const WAYPOINT_REACHED = 28;
const WAYPOINTS = [
  { x: WORLD_WIDTH * 0.18, y: WORLD_HEIGHT * 0.25 },
  { x: WORLD_WIDTH * 0.5, y: WORLD_HEIGHT * 0.16 },
  { x: WORLD_WIDTH * 0.82, y: WORLD_HEIGHT * 0.3 },
  { x: WORLD_WIDTH * 0.62, y: WORLD_HEIGHT * 0.55 },
  { x: WORLD_WIDTH * 0.84, y: WORLD_HEIGHT * 0.82 },
  { x: WORLD_WIDTH * 0.4, y: WORLD_HEIGHT * 0.84 },
  { x: WORLD_WIDTH * 0.16, y: WORLD_HEIGHT * 0.62 },
  { x: WORLD_WIDTH * 0.38, y: WORLD_HEIGHT * 0.45 },
] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function isSliderTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.getAttribute("role") === "slider";
}

export interface LabInput {
  autopilot: boolean;
  /** Joystick or other analog input in [-1, 1]; (0, 0) releases. */
  setAnalog: (x: number, y: number) => void;
}

/**
 * One input source for every client in the lab: global keyboard, the touch
 * joystick, and a demo autopilot that runs until the viewer takes over.
 * Inputs are just directions; the netcode path is unchanged.
 */
export function useLabInput(
  clients: readonly (GameClient | null)[],
  keyboardEnabled: boolean,
): LabInput {
  const pressed = useRef(new Set<string>());
  const analog = useRef<[number, number]>([0, 0]);
  const lastHumanInput = useRef(Number.NEGATIVE_INFINITY);
  const waypoint = useRef(0);
  const clientsRef = useRef(clients);
  const [autopilot, setAutopilot] = useState(true);

  useEffect(() => {
    clientsRef.current = clients;
  });

  const apply = useCallback((x: number, y: number) => {
    for (const client of clientsRef.current) {
      client?.setInputDirection(x, y);
    }
  }, []);

  const applyHuman = useCallback(() => {
    let x = analog.current[0];
    let y = analog.current[1];
    for (const key of pressed.current) {
      const vector = MOVEMENT_KEYS[key];
      if (vector) {
        x += vector[0];
        y += vector[1];
      }
    }
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));
    lastHumanInput.current = performance.now();
    setAutopilot(false);
    apply(x, y);
  }, [apply]);

  useEffect(() => {
    if (!keyboardEnabled) {
      pressed.current.clear();
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (!(key in MOVEMENT_KEYS)) {
        return;
      }
      // Arrow keys belong to a focused slider; WASD always moves.
      if (key.startsWith("arrow") && isSliderTarget(event.target)) {
        return;
      }
      event.preventDefault();
      pressed.current.add(key);
      applyHuman();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!pressed.current.delete(key)) {
        return;
      }
      applyHuman();
    };
    const onBlur = () => {
      pressed.current.clear();
      analog.current = [0, 0];
      apply(0, 0);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [keyboardEnabled, apply, applyHuman]);

  // Autopilot: steer the predicted player through waypoints while idle.
  // It runs even behind the intro, so the first thing a viewer sees is alive.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const humanActive =
        pressed.current.size > 0 ||
        analog.current[0] !== 0 ||
        analog.current[1] !== 0 ||
        performance.now() - lastHumanInput.current < AUTOPILOT_RESUME_MS;
      if (humanActive) {
        return;
      }
      setAutopilot(true);
      const leader = clientsRef.current.find((client) => client?.getLocalPosition());
      const position = leader?.getLocalPosition();
      if (!position) {
        return;
      }
      let target = WAYPOINTS[waypoint.current % WAYPOINTS.length] ?? WAYPOINTS[0];
      if (Math.hypot(target.x - position.x, target.y - position.y) < WAYPOINT_REACHED) {
        waypoint.current = (waypoint.current + 1) % WAYPOINTS.length;
        target = WAYPOINTS[waypoint.current] ?? WAYPOINTS[0];
      }
      const dx = target.x - position.x;
      const dy = target.y - position.y;
      const length = Math.max(Math.hypot(dx, dy), 1);
      apply(dx / length, dy / length);
    }, AUTOPILOT_TICK_MS);
    return () => window.clearInterval(timer);
  }, [apply]);

  const setAnalog = useCallback(
    (x: number, y: number) => {
      analog.current = [x, y];
      applyHuman();
    },
    [applyHuman],
  );

  return { autopilot, setAnalog };
}
