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
  socket: WebSocket;
  inputQueue: PlayerInputMessage[];
  lastReceivedInput: number;
  lastProcessedInput: number;
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
    if (room.players.size >= 2) {
      this.send(context.socket, { type: "room_full", roomId });
      return;
    }

    const slot: 0 | 1 = room.players.size === 0 ? 0 : 1;
    const playerId = randomUUID().replaceAll("-", "").slice(0, 8);
    const spawn = createSpawnPosition(slot);
    const player: RoomPlayer = {
      id: playerId,
      ...spawn,
      isIt: slot === 0,
      tagCount: 0,
      socket: context.socket,
      inputQueue: [],
      lastReceivedInput: -1,
      lastProcessedInput: -1,
    };

    room.players.set(playerId, player);
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
      connectedPlayers: room.players.size,
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
          tagCount: player.tagCount,
        };
        acknowledgements[player.id] = player.lastProcessedInput;
      }

      const metrics: SnapshotMetrics = {
        ...rates,
        connectedPlayers: room.players.size,
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

    if (room.players.size === 0) {
      this.rooms.delete(room.id);
      return;
    }

    const remaining = room.players.values().next().value as RoomPlayer | undefined;
    if (remaining) {
      remaining.isIt = true;
    }
    this.broadcast(room, {
      type: "player_left",
      playerId,
      connectedPlayers: room.players.size,
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
      this.send(player.socket, message);
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
