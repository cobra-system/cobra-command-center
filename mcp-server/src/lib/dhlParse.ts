// Node port of supabase/functions/_shared/dhlParse.ts. Used by MCP shipping tools
// so that calling DHL via MCP writes the same normalized columns the edge
// function does (tracking_status_code, tracking_eta, tracking_events, ...).
//
// IMPORTANT: keep the parsing/normalization logic identical to the Deno copy.
// If you change one, change the other.

import { supabase } from "../supabase.js";

export interface DhlEventRaw {
  timestamp?: string;
  description?: string;
  statusCode?: string;
  location?: { address?: { addressLocality?: string; countryCode?: string } };
}

export interface DhlShipmentRaw {
  status?: {
    timestamp?: string;
    statusCode?: string;
    status?: string;
    description?: string;
    location?: { address?: { addressLocality?: string; countryCode?: string } };
  };
  estimatedTimeOfDelivery?: string;
  estimatedDeliveryTimeFrame?: { estimatedFrom?: string; estimatedThrough?: string };
  origin?: { address?: { addressLocality?: string; countryCode?: string } };
  destination?: { address?: { addressLocality?: string; countryCode?: string } };
  events?: DhlEventRaw[];
}

export interface DhlResponseRaw {
  shipments?: DhlShipmentRaw[];
}

export type StatusCode = "pre-transit" | "transit" | "delivered" | "failure" | "unknown";

export interface NormalizedTracking {
  tracking_status_code: StatusCode;
  tracking_raw_status: string | null;
  tracking_description: string | null;
  tracking_eta: string | null;
  tracking_last_location: string | null;
  tracking_origin: string | null;
  tracking_destination: string | null;
  tracking_events: Array<{ timestamp: string | null; code: string | null; description: string | null; location: string | null }>;
  tracking_status: string | null;
  tracking_last_event: string | null;
}

const NUMERIC_CODE_TO_STAGE: Record<string, StatusCode> = {
  "100": "pre-transit", "101": "pre-transit",
  "102": "transit", "103": "transit", "104": "failure", "105": "transit",
  "110": "transit", "111": "transit", "120": "transit", "121": "transit",
  "125": "transit", "126": "transit", "130": "transit", "131": "transit",
  "132": "transit", "140": "transit", "141": "failure",
  "150": "delivered",
  "160": "failure", "170": "failure", "171": "failure", "180": "failure",
  "190": "failure", "191": "failure",
};

function locationString(addr?: { addressLocality?: string; countryCode?: string }): string | null {
  if (!addr) return null;
  const city = addr.addressLocality?.trim();
  const cc = addr.countryCode?.trim();
  if (city && cc) return `${city}, ${cc}`;
  return city || cc || null;
}

export function normalizeStatusCode(raw?: string | null): StatusCode {
  if (!raw) return "unknown";
  const lc = raw.toLowerCase().trim();
  if (lc === "pre-transit" || lc === "transit" || lc === "delivered" || lc === "failure" || lc === "unknown") return lc;
  if (NUMERIC_CODE_TO_STAGE[lc]) return NUMERIC_CODE_TO_STAGE[lc];
  if (lc.includes("deliver")) return "delivered";
  if (lc.includes("transit") || lc.includes("shipment") || lc.includes("customs")) return "transit";
  if (lc.includes("fail") || lc.includes("exception") || lc.includes("return")) return "failure";
  if (lc.includes("pre") || lc.includes("information") || lc.includes("manifest")) return "pre-transit";
  return "unknown";
}

export function parseDhlResponse(json: DhlResponseRaw): NormalizedTracking {
  const shipment = json.shipments?.[0];
  if (!shipment) {
    return {
      tracking_status_code: "unknown",
      tracking_raw_status: null,
      tracking_description: null,
      tracking_eta: null,
      tracking_last_location: null,
      tracking_origin: null,
      tracking_destination: null,
      tracking_events: [],
      tracking_status: null,
      tracking_last_event: null,
    };
  }

  const rawStatus = shipment.status?.status ?? shipment.status?.statusCode ?? null;
  const statusCode = normalizeStatusCode(shipment.status?.statusCode ?? shipment.status?.status);
  const description = shipment.status?.description ?? null;

  const events = (shipment.events ?? []).slice(0, 15).map(ev => ({
    timestamp: ev.timestamp ?? null,
    code: ev.statusCode ?? null,
    description: ev.description ?? null,
    location: locationString(ev.location?.address),
  }));

  const lastLocation = locationString(shipment.status?.location?.address) ?? events[0]?.location ?? null;
  const eta = shipment.estimatedTimeOfDelivery ?? shipment.estimatedDeliveryTimeFrame?.estimatedThrough ?? null;

  return {
    tracking_status_code: statusCode,
    tracking_raw_status: rawStatus,
    tracking_description: description,
    tracking_eta: eta,
    tracking_last_location: lastLocation,
    tracking_origin: locationString(shipment.origin?.address),
    tracking_destination: locationString(shipment.destination?.address),
    tracking_events: events,
    tracking_status: rawStatus,
    tracking_last_event: events[0]?.description ?? description,
  };
}

export async function persistTracking(orderId: string, payload: NormalizedTracking, extra?: Record<string, unknown>): Promise<{ error: { message: string } | null }> {
  const now = new Date().toISOString();
  return await supabase.from("orders").update({
    tracking_status_code: payload.tracking_status_code,
    tracking_raw_status: payload.tracking_raw_status,
    tracking_description: payload.tracking_description,
    tracking_eta: payload.tracking_eta,
    tracking_last_location: payload.tracking_last_location,
    tracking_origin: payload.tracking_origin,
    tracking_destination: payload.tracking_destination,
    tracking_events: payload.tracking_events,
    tracking_status: payload.tracking_status,
    tracking_last_event: payload.tracking_last_event,
    tracking_updated_at: now,
    tracking_last_synced_at: now,
    tracking_sync_error: null,
    tracking_carrier: "dhl",
    ...extra,
  }).eq("id", orderId);
}

export type FetchDhlResult =
  | { ok: true; payload: NormalizedTracking }
  | { ok: false; status: number; errorCode: string; message: string };

export async function fetchDhlTracking(trackingNumber: string, apiKey: string): Promise<FetchDhlResult> {
  const url = `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(trackingNumber.replace(/[\s-]/g, ""))}`;
  const res = await fetch(url, { headers: { "DHL-API-Key": apiKey, "Accept": "application/json" } });

  if (res.status === 404) {
    return {
      ok: true,
      payload: {
        tracking_status_code: "unknown",
        tracking_raw_status: null,
        tracking_description: "לא נמצא במערכת DHL",
        tracking_eta: null,
        tracking_last_location: null,
        tracking_origin: null,
        tracking_destination: null,
        tracking_events: [],
        tracking_status: "לא נמצא במערכת DHL",
        tracking_last_event: null,
      },
    };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const errorCode = res.status === 401 ? "unauthorized" : res.status === 429 ? "rate_limited" : `http_${res.status}`;
    return { ok: false, status: res.status, errorCode, message: `DHL API ${res.status}: ${errText}`.trim() };
  }

  const json = await res.json() as DhlResponseRaw;
  return { ok: true, payload: parseDhlResponse(json) };
}
