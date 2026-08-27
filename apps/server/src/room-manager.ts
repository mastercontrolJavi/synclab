import { randomUUID } from "node:crypto";

import {
  FIXED_DT,
  MAX_INPUT_QUEUE,
  MAX_INPUTS_PER_TICK,
  PLAYER_RADIUS,
  SERVER_TICK_RATE,
  SNAPSHOT_RATE,
  TAG_COOLDOWN_TICKS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  applyMovement,
  createSpawnPosition,
  playersAreTouching,
  type PlayerInputMessage,
  type PlayerSnapshot,
  type ServerMessage,
  type SnapshotMetrics,
} from "@synclab/shared";
import WebSocket from "ws";

export interface ClientContext {
  socket: WebSocket;
  playerId: string | null;
  roomId: string | null;
}

interface RoomPlayer extends PlayerSnapshot {
  socket: WebSocket | null;
  inputQueue: PlayerInputMessage[];
  lastReceivedInput: number;
  lastProcessedInput: number;
  scriptedWaypointIndex: number;
}

interface Room {
  id: string;
  serverTick: number;
  tagCooldownTicks: number;
  players: Map<string, RoomPlayer>;
}

interface LoopRates {
  actualTickRate: number;
  actualSnapshotRate: number;
}

const MAX_SOCKET_BACKPRESSURE = 256 * 1024;
const SCRIPTED_WAYPOINTS = [
  { x: WORLD_WIDTH * 0.28, y: WORLD_HEIGHT * 0.28 },
  { x: WORLD_WIDTH * 0.72, y: WORLD_HEIGHT * 0.72 },
  { x: WORLD_WIDTH * 0.72, y: WORLD_HEIGHT * 0.28 },
  { x: WORLD_WIDTH * 0.28, y: WORLD_HEIGHT * 0.72 },
] as const;

function roomSeed(roomId: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < roomId.length; index += 1) {
    hash ^= roomId.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  get roomCount(): number {
    return this.rooms.size;
  }

  join(context: ClientContext, roomId: string): void {
    if (context.playerId || context.roomId) {
      return;
    }

    const room = this.rooms.get(roomId) ?? this.createRoom(roomId);
    const humanPlayers = this.getHumanPlayers(room);
    if (humanPlayers.length >= 2) {
      this.send(context.socket, { type: "room_full", roomId });
      return;
    }

    if (humanPlayers.length === 1) {
      this.removeScriptedPlayer(room);
    }

    const slot: 0 | 1 = humanPlayers.length === 0 ? 0 : 1;
    const playerId = randomUUID().replaceAll("-", "").slice(0, 8);
    const spawn = createSpawnPosition(slot);
    const player: RoomPlayer = {
      id: playerId,
      ...spawn,
      isIt: slot === 0,
      isScripted: false,
      tagCount: 0,
      socket: context.socket,
      inputQueue: [],
      lastReceivedInput: -1,
      lastProcessedInput: -1,
      scriptedWaypointIndex: 0,
    };

    room.players.set(playerId, player);
    if (humanPlayers.length === 0) {
      this.spawnScriptedPlayer(room);
    }
    context.playerId = playerId;
    context.roomId = roomId;

    this.send(context.socket, {
      type: "welcome",
      playerId,
      roomId,
      serverTime: Date.now(),
      tickRate: SERVER_TICK_RATE,
      snapshotRate: SNAPSHOT_RATE,
      world: {
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        playerRadius: PLAYER_RADIUS,
      },
    });
    this.broadcast(room, {
      type: "player_joined",
      playerId,
      connectedPlayers: this.getHumanPlayers(room).length,
    });
  }

  enqueueInput(context: ClientContext, input: PlayerInputMessage): void {
    const player = this.getPlayer(context);
    if (!player || input.sequence <= player.lastReceivedInput) {
      return;
    }

    player.lastReceivedInput = input.sequence;
    player.inputQueue.push(input);
    if (player.inputQueue.length > MAX_INPUT_QUEUE) {
      player.inputQueue.splice(0, player.inputQueue.length - MAX_INPUT_QUEUE);
    }
  }

  step(): void {
    for (const room of this.rooms.values()) {
      room.serverTick += 1;
      if (room.tagCooldownTicks > 0) {
        room.tagCooldownTicks -= 1;
      }

      for (const player of room.players.values()) {
        if (player.isScripted) {
          this.moveScriptedPlayer(player);
          continue;
        }

        let processed = 0;
        while (player.inputQueue.length > 0 && processed < MAX_INPUTS_PER_TICK) {
          const input = player.inputQueue.shift();
          if (!input) {
            break;
          }
          const position = applyMovement(player, input, FIXED_DT);
          player.x = position.x;
          player.y = position.y;
          player.lastProcessedInput = input.sequence;
          processed += 1;
        }
      }

      this.resolveTag(room);
    }
  }

  broadcastSnapshots(rates: LoopRates): void {
    for (const room of this.rooms.values()) {
      const players: Record<string, PlayerSnapshot> = {};
      const acknowledgements: Record<string, number> = {};

      for (const player of room.players.values()) {
        players[player.id] = {
          id: player.id,
          x: player.x,
          y: player.y,
          isIt: player.isIt,
          isScripted: player.isScripted,
          tagCount: player.tagCount,
        };
        acknowledgements[player.id] = player.lastProcessedInput;
      }

      const metrics: SnapshotMetrics = {
        ...rates,
        connectedPlayers: this.getHumanPlayers(room).length,
      };
      this.broadcast(room, {
        type: "snapshot",
        serverTick: room.serverTick,
        serverTime: Date.now(),
        players,
        acknowledgements,
        metrics,
      });
    }
  }

  remove(context: ClientContext): void {
    if (!context.roomId || !context.playerId) {
      return;
    }

    const room = this.rooms.get(context.roomId);
    if (!room) {
      return;
    }

    const playerId = context.playerId;
    room.players.delete(playerId);
    context.playerId = null;
    context.roomId = null;

    const humanPlayers = this.getHumanPlayers(room);
    if (humanPlayers.length === 0) {
      this.rooms.delete(room.id);
      return;
    }

    const remaining = humanPlayers[0];
    if (remaining) {
      remaining.isIt = true;
    }
    this.spawnScriptedPlayer(room);
    this.broadcast(room, {
      type: "player_left",
      playerId,
      connectedPlayers: humanPlayers.length,
    });
  }

  private createRoom(roomId: string): Room {
    const room: Room = {
      id: roomId,
      serverTick: 0,
      tagCooldownTicks: 0,
      players: new Map(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  private getPlayer(context: ClientContext): RoomPlayer | null {
    if (!context.roomId || !context.playerId) {
      return null;
    }
    return this.rooms.get(context.roomId)?.players.get(context.playerId) ?? null;
  }

  private getHumanPlayers(room: Room): RoomPlayer[] {
    return [...room.players.values()].filter((player) => !player.isScripted);
  }

  private spawnScriptedPlayer(room: Room): void {
    if (
      this.getHumanPlayers(room).length !== 1 ||
      [...room.players.values()].some((player) => player.isScripted)
    ) {
      return;
    }

    const spawn = createSpawnPosition(1);
    const scriptedPlayer: RoomPlayer = {
      id: `scripted-${room.id}`,
      ...spawn,
      isIt: false,
      isScripted: true,
      tagCount: 0,
      socket: null,
      inputQueue: [],
      lastReceivedInput: -1,
      lastProcessedInput: -1,
      scriptedWaypointIndex: roomSeed(room.id) % SCRIPTED_WAYPOINTS.length,
    };
    room.players.set(scriptedPlayer.id, scriptedPlayer);
    room.tagCooldownTicks = 0;
  }

  private removeScriptedPlayer(room: Room): void {
    const scriptedPlayer = [...room.players.values()].find(
      (player) => player.isScripted,
    );
    if (!scriptedPlayer) {
      return;
    }

    room.players.delete(scriptedPlayer.id);
    if (scriptedPlayer.isIt) {
      const humanPlayer = this.getHumanPlayers(room)[0];
      if (humanPlayer) {
        humanPlayer.isIt = true;
      }
    }
    room.tagCooldownTicks = 0;
  }

  private moveScriptedPlayer(player: RoomPlayer): void {
    let target = SCRIPTED_WAYPOINTS[player.scriptedWaypointIndex];
    if (!target) {
      player.scriptedWaypointIndex = 0;
      target = SCRIPTED_WAYPOINTS[0];
    }
    if (!target) {
      return;
    }

    let distanceToTarget = Math.hypot(target.x - player.x, target.y - player.y);
    if (distanceToTarget <= PLAYER_RADIUS) {
      player.scriptedWaypointIndex =
        (player.scriptedWaypointIndex + 1) % SCRIPTED_WAYPOINTS.length;
      target = SCRIPTED_WAYPOINTS[player.scriptedWaypointIndex] ?? target;
      distanceToTarget = Math.hypot(target.x - player.x, target.y - player.y);
    }

    const position = applyMovement(
      player,
      {
        moveX: (target.x - player.x) / Math.max(distanceToTarget, 1),
        moveY: (target.y - player.y) / Math.max(distanceToTarget, 1),
      },
      FIXED_DT,
    );
    player.x = position.x;
    player.y = position.y;
  }

  private resolveTag(room: Room): void {
    if (room.players.size !== 2 || room.tagCooldownTicks > 0) {
      return;
    }
    const [first, second] = [...room.players.values()];
    if (!first || !second || !playersAreTouching(first, second)) {
      return;
    }
    const tagger = first.isIt ? first : second.isIt ? second : null;
    const tagged = tagger === first ? second : first;
    if (!tagger) {
      first.isIt = true;
      return;
    }
    tagger.isIt = false;
    tagger.tagCount += 1;
    tagged.isIt = true;
    room.tagCooldownTicks = TAG_COOLDOWN_TICKS;
  }

  private broadcast(room: Room, message: ServerMessage): void {
    for (const player of room.players.values()) {
      if (player.socket) {
        this.send(player.socket, message);
      }
    }
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (
      socket.readyState !== WebSocket.OPEN ||
      socket.bufferedAmount > MAX_SOCKET_BACKPRESSURE
    ) {
      return;
    }
    socket.send(JSON.stringify(message));
  }
}
