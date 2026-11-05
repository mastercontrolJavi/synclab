import { decodeClientText, type ClientMessage } from "@synclab/shared";
import type { RawData } from "ws";

export function rawDataToText(rawData: RawData): string | null {
  if (typeof rawData === "string") {
    return rawData;
  }
  if (Buffer.isBuffer(rawData)) {
    return rawData.toString("utf8");
  }
  if (rawData instanceof ArrayBuffer) {
    return Buffer.from(rawData).toString("utf8");
  }
  if (Array.isArray(rawData)) {
    return Buffer.concat(rawData).toString("utf8");
  }
  return null;
}

export function decodeClientMessage(rawData: RawData): ClientMessage | null {
  return decodeClientText(rawDataToText(rawData));
}
