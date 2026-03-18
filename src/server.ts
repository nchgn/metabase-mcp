#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  loadConfigFromEnv,
  mbFetch,
  mbFetchText,
  toCsv,
  type MetabaseConfig,
  type DatasetResponse,
  type Dashboard,
  type Card,
  type Table,
  type Field,
  type Collection,
} from "./metabase.js";

let config: MetabaseConfig;

try {
  config = loadConfigFromEnv();
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
}

const server = new McpServer({
  name: "metabase",
  version: "1.0.0",
});

// ============================================================
// QUERY TOOLS
// ============================================================

server.tool(
  "query",
  "Run a raw SQL query against Metabase. Returns CSV by default. This is the primary tool for data analysis.",
  {
    sql: z.string().describe("SQL query to execute"),
    database_id: z.number().optional().describe("Database ID (default: env METABASE_DATABASE_ID)"),
    format: z.enum(["csv", "json"]).optional().describe("Output format (default: csv)"),
  },
  async ({ sql, database_id, format }) => {
    const dbId = database_id ?? config.defaultDatabase;
    const result = await mbFetch<DatasetResponse>(config, "/dataset", {
      method: "POST",
      body: { database: dbId, type: "native", native: { query: sql } },
    });

    if (result.error) {
      return { content: [{ type: "text", text: `SQL Error: ${result.error}` }], isError: true };
    }

    const output =
      format === "json"
        ? JSON.stringify(result.data, null, 2)
        : toCsv(result.data.cols, result.data.rows);

    const warning = result.data.rows_truncated
      ? `\n\n⚠ Results truncated at ${result.data.rows.length} rows. Use 'export' tool for full results.`
      : "";

    return {
      content: [{ type: "text", text: output + warning }],
    };
  }
);

server.tool(
  "export",
  "Run SQL and export full results as CSV (no row limit). Use for large datasets.",
  {
    sql: z.string().describe("SQL query to execute"),
    database_id: z.number().optional().describe("Database ID (default: env METABASE_DATABASE_ID)"),
  },
  async ({ sql, database_id }) => {
    const dbId = database_id ?? config.defaultDatabase;
    const csv = await mbFetchText(config, "/dataset/csv", {
      method: "POST",
      body: { database: dbId, type: "native", native: { query: sql } },
    });

    return { content: [{ type: "text", text: csv }] };
  }
);

server.tool(
  "run_card",
  "Execute a saved question (card) by ID and get fresh results.",
  {
    card_id: z.number().describe("Card ID"),
    format: z.enum(["csv", "json"]).optional().describe("Output format (default: csv)"),
  },
  async ({ card_id, format }) => {
    const result = await mbFetch<DatasetResponse>(config, `/card/${card_id}/query`, {
      method: "POST",
    });

    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }

    const output =
      format === "json"
        ? JSON.stringify(result.data, null, 2)
        : toCsv(result.data.cols, result.data.rows);

    return { content: [{ type: "text", text: output }] };
  }
);

// ============================================================
// DASHBOARD TOOLS
// ============================================================

server.tool(
  "list_dashboards",
  "List all dashboards. Returns id, name, description, collection_id.",
  {},
  async () => {
    const dashboards = await mbFetch<Dashboard[]>(config, "/dashboard");
    const csv = toCsv(
      [{ name: "id" }, { name: "name" }, { name: "description" }, { name: "collection_id" }],
      dashboards.map((d) => [d.id, d.name, d.description ?? "", d.collection_id ?? ""])
    );
    return { content: [{ type: "text", text: csv }] };
  }
);

server.tool(
  "get_dashboard",
  "Get dashboard details including all its cards.",
  { dashboard_id: z.number().describe("Dashboard ID") },
  async ({ dashboard_id }) => {
    const dash = await mbFetch<Dashboard>(config, `/dashboard/${dashboard_id}`);
    const cards = (dash.dashcards ?? []).filter((dc) => dc.card);
    const csv = toCsv(
      [{ name: "card_id" }, { name: "card_name" }, { name: "display" }, { name: "size" }, { name: "position" }],
      cards.map((dc) => [
        dc.card_id,
        dc.card!.name,
        dc.card!.display,
        `${dc.size_x}x${dc.size_y}`,
        `(${dc.col},${dc.row})`,
      ])
    );
    return {
      content: [
        { type: "text", text: `Dashboard: ${dash.name}\nDescription: ${dash.description ?? ""}\n\n${csv}` },
      ],
    };
  }
);

server.tool(
  "create_dashboard",
  "Create a new dashboard.",
  {
    name: z.string().describe("Dashboard name"),
    description: z.string().optional().describe("Dashboard description"),
    collection_id: z.number().optional().describe("Collection ID to place it in"),
  },
  async ({ name, description, collection_id }) => {
    const body: Record<string, unknown> = { name };
    if (description) body["description"] = description;
    if (collection_id) body["collection_id"] = collection_id;

    const dash = await mbFetch<Dashboard>(config, "/dashboard", {
      method: "POST",
      body,
    });

    return {
      content: [{ type: "text", text: `Created dashboard ${dash.id}: ${dash.name}\nURL: ${config.url}/dashboard/${dash.id}` }],
    };
  }
);

server.tool(
  "run_dashboard_card",
  "Execute a specific card within a dashboard to get fresh data.",
  {
    dashboard_id: z.number().describe("Dashboard ID"),
    card_id: z.number().describe("Card ID within the dashboard"),
    format: z.enum(["csv", "json"]).optional().describe("Output format (default: csv)"),
  },
  async ({ dashboard_id, card_id, format }) => {
    const result = await mbFetch<DatasetResponse>(
      config,
      `/dashboard/${dashboard_id}/dashcard/${card_id}/card/${card_id}/query`,
      { method: "POST" }
    );

    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }

    const output =
      format === "json"
        ? JSON.stringify(result.data, null, 2)
        : toCsv(result.data.cols, result.data.rows);

    return { content: [{ type: "text", text: output }] };
  }
);

// ============================================================
// CARD (SAVED QUESTION) TOOLS
// ============================================================

server.tool(
  "list_cards",
  "List all saved questions/cards. Returns id, name, display type, database, collection.",
  {},
  async () => {
    const cards = await mbFetch<Card[]>(config, "/card");
    const csv = toCsv(
      [{ name: "id" }, { name: "name" }, { name: "display" }, { name: "database_id" }, { name: "collection_id" }],
      cards.map((c) => [c.id, c.name, c.display, c.database_id, c.collection_id ?? ""])
    );
    return { content: [{ type: "text", text: csv }] };
  }
);

server.tool(
  "get_card",
  "Get full details of a saved question including its query definition and visualization settings.",
  { card_id: z.number().describe("Card ID") },
  async ({ card_id }) => {
    const card = await mbFetch<Card>(config, `/card/${card_id}`);
    return { content: [{ type: "text", text: JSON.stringify(card, null, 2) }] };
  }
);

server.tool(
  "create_card",
  "Create a new saved question (card) from a native SQL query.",
  {
    name: z.string().describe("Card name"),
    sql: z.string().describe("Native SQL query"),
    description: z.string().optional().describe("Card description"),
    display: z.enum(["table", "bar", "line", "pie", "scalar", "row", "area", "combo", "funnel", "scatter", "waterfall"]).optional().describe("Visualization type (default: table)"),
    database_id: z.number().optional().describe("Database ID"),
    collection_id: z.number().optional().describe("Collection ID to save in"),
  },
  async ({ name, sql, description, display, database_id, collection_id }) => {
    const dbId = database_id ?? config.defaultDatabase;
    const body: Record<string, unknown> = {
      name,
      display: display ?? "table",
      dataset_query: {
        database: dbId,
        type: "native",
        native: { query: sql },
      },
      visualization_settings: {},
    };
    if (description) body["description"] = description;
    if (collection_id) body["collection_id"] = collection_id;

    const card = await mbFetch<Card>(config, "/card", {
      method: "POST",
      body,
    });

    return {
      content: [{ type: "text", text: `Created card ${card.id}: ${card.name}\nURL: ${config.url}/question/${card.id}` }],
    };
  }
);

// ============================================================
// SCHEMA TOOLS
// ============================================================

server.tool(
  "list_tables",
  "List all tables in a database.",
  {
    database_id: z.number().optional().describe("Database ID (default: env METABASE_DATABASE_ID)"),
  },
  async ({ database_id }) => {
    const dbId = database_id ?? config.defaultDatabase;
    const tables = await mbFetch<Table[]>(config, `/database/${dbId}/metadata/tables`);
    const csv = toCsv(
      [{ name: "id" }, { name: "name" }, { name: "schema" }, { name: "rows" }],
      tables.map((t) => [t.id, t.name, t.schema, t.rows ?? ""])
    );
    return { content: [{ type: "text", text: csv }] };
  }
);

server.tool(
  "get_table_schema",
  "Get columns and types for a specific table.",
  {
    table_id: z.number().describe("Table ID"),
  },
  async ({ table_id }) => {
    const metadata = await mbFetch<{ name: string; fields: Field[] }>(
      config,
      `/table/${table_id}/query_metadata`
    );
    const csv = toCsv(
      [{ name: "name" }, { name: "database_type" }, { name: "base_type" }, { name: "semantic_type" }, { name: "description" }],
      metadata.fields.map((f) => [f.name, f.database_type, f.base_type, f.semantic_type ?? "", f.description ?? ""])
    );
    return {
      content: [{ type: "text", text: `Table: ${metadata.name}\n\n${csv}` }],
    };
  }
);

server.tool(
  "list_databases",
  "List all connected databases.",
  {},
  async () => {
    const result = await mbFetch<{ data: Array<{ id: number; name: string; engine: string }> }>(
      config,
      "/database"
    );
    const csv = toCsv(
      [{ name: "id" }, { name: "name" }, { name: "engine" }],
      result.data.map((d) => [d.id, d.name, d.engine])
    );
    return { content: [{ type: "text", text: csv }] };
  }
);

// ============================================================
// COLLECTION & SEARCH TOOLS
// ============================================================

server.tool(
  "list_collections",
  "List all collections.",
  {},
  async () => {
    const collections = await mbFetch<Collection[]>(config, "/collection");
    const csv = toCsv(
      [{ name: "id" }, { name: "name" }, { name: "description" }, { name: "personal" }],
      collections.map((c) => [c.id, c.name, c.description ?? "", c.personal_owner_id ? "yes" : ""])
    );
    return { content: [{ type: "text", text: csv }] };
  }
);

server.tool(
  "search",
  "Search across all Metabase content (dashboards, cards, collections, tables).",
  { query: z.string().describe("Search query") },
  async ({ query }) => {
    const result = await mbFetch<{
      data: Array<{ id: number; name: string; model: string; description: string | null; collection: { name: string } | null }>;
      total: number;
    }>(config, "/search", { params: { q: query } });

    const csv = toCsv(
      [{ name: "id" }, { name: "type" }, { name: "name" }, { name: "collection" }, { name: "description" }],
      result.data.map((r) => [r.id, r.model, r.name, r.collection?.name ?? "", r.description ?? ""])
    );
    return { content: [{ type: "text", text: `${result.total} results\n\n${csv}` }] };
  }
);

// ============================================================
// DASHBOARD COMPOSITION TOOLS
// ============================================================

server.tool(
  "add_card_to_dashboard",
  "Add an existing card (saved question) to a dashboard.",
  {
    dashboard_id: z.number().describe("Dashboard ID"),
    card_id: z.number().describe("Card ID to add"),
    width: z.number().optional().describe("Card width in grid units (default: 6)"),
    height: z.number().optional().describe("Card height in grid units (default: 4)"),
    col: z.number().optional().describe("Column position (default: 0)"),
    row: z.number().optional().describe("Row position (default: 0)"),
  },
  async ({ dashboard_id, card_id, width, height, col, row }) => {
    const result = await mbFetch<{ id: number }>(config, `/dashboard/${dashboard_id}/cards`, {
      method: "PUT",
      body: {
        cards: [
          {
            id: -1,
            card_id,
            size_x: width ?? 6,
            size_y: height ?? 4,
            col: col ?? 0,
            row: row ?? 0,
          },
        ],
      },
    });

    return {
      content: [{ type: "text", text: `Added card ${card_id} to dashboard ${dashboard_id}` }],
    };
  }
);

// ============================================================
// START SERVER
// ============================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Metabase MCP server running on stdio\n");
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
