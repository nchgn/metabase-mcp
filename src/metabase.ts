/**
 * Metabase API client — thin wrapper over fetch.
 * Config from env vars or .env file (via METABASE_ENV_FILE).
 */

import { readFileSync } from "node:fs";

export interface MetabaseConfig {
  url: string;
  apiKey: string;
  defaultDatabase: number;
}

function loadDotenv(path: string): void {
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function loadConfigFromEnv(): MetabaseConfig {
  const envFile = process.env["METABASE_ENV_FILE"];
  if (envFile) {
    loadDotenv(envFile);
  }

  const url = process.env["METABASE_URL"];
  const apiKey = process.env["METABASE_API_KEY"];
  const db = process.env["METABASE_DATABASE_ID"];

  if (!url || !apiKey) {
    throw new Error(
      "Missing env vars: METABASE_URL and METABASE_API_KEY are required"
    );
  }

  return {
    url: url.replace(/\/+$/, ""),
    apiKey,
    defaultDatabase: db ? parseInt(db, 10) : 2,
  };
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
}

export async function mbFetch<T>(
  config: MetabaseConfig,
  path: string,
  opts: RequestOpts = {}
): Promise<T> {
  const { method = "GET", body, params } = opts;

  let url = `${config.url}/api${path}`;
  if (params) {
    const qs = new URLSearchParams(params);
    url += `?${qs.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "x-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Metabase ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function mbFetchText(
  config: MetabaseConfig,
  path: string,
  opts: RequestOpts = {}
): Promise<string> {
  const { method = "POST", body, params } = opts;

  let url = `${config.url}/api${path}`;
  if (params) {
    const qs = new URLSearchParams(params);
    url += `?${qs.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "x-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Metabase ${res.status}: ${text}`);
  }

  return res.text();
}

// --- Response types ---

export interface DatasetResponse {
  data: {
    cols: Array<{ name: string; base_type: string }>;
    rows: unknown[][];
    rows_truncated?: number;
  };
  status: string;
  error?: string;
}

export interface Dashboard {
  id: number;
  name: string;
  description: string | null;
  collection_id: number | null;
  created_at: string;
  dashcards?: Array<{
    id: number;
    card_id: number | null;
    card: { id: number; name: string; display: string } | null;
    size_x: number;
    size_y: number;
    row: number;
    col: number;
  }>;
}

export interface Card {
  id: number;
  name: string;
  description: string | null;
  display: string;
  collection_id: number | null;
  database_id: number;
  dataset_query: unknown;
  visualization_settings: unknown;
}

export interface Table {
  id: number;
  name: string;
  schema: string;
  db_id: number;
  rows: number | null;
}

export interface Field {
  id: number;
  name: string;
  database_type: string;
  base_type: string;
  semantic_type: string | null;
  description: string | null;
}

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  personal_owner_id: number | null;
}

// --- CSV helper ---

export function toCsv(cols: Array<{ name: string }>, rows: unknown[][]): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [cols.map((c) => escape(c.name)).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\n");
}
