import { FIXED_DT } from "./constants.js";
import { applyMovement } from "./simulation.js";
import type { MovementInput, Vector2 } from "./types.js";

export interface ReconciliationResult {
  position: Vector2;
  pendingInputs: MovementInput[];
}

export function reconcilePosition(
  authoritativePosition: Vector2,
  lastAcknowledgedSequence: number,
  pendingInputs: readonly MovementInput[],
): ReconciliationResult {
  const remainingInputs = pendingInputs.filter(
    (input) => input.sequence > lastAcknowledgedSequence,
  );

  const position = remainingInputs.reduce<Vector2>(
    (current, input) => applyMovement(current, input, FIXED_DT),
    authoritativePosition,
  );

  return { position, pendingInputs: remainingInputs };
}
