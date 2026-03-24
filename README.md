# metabase-mcp

[![npm version](https://img.shields.io/npm/v/metabase-mcp-agents.svg)](https://www.npmjs.com/package/metabase-mcp-agents)

MCP server for Metabase — gives AI agents full access to query, explore, and manage content in your Metabase instance.

Works with any MCP-compatible client: Claude Code, Claude Desktop, Cursor, etc.

## Quick Start

```bash
npx metabase-mcp-agents
```

That's it. No clone, no build. Just add it to your MCP config with the right env vars.

## Configuration

### Claude Code

Add to `.mcp.json` (project-level) or `~/.claude/settings.json` (global):

```json
{
  "mcpServers": {
    "metabase": {
      "command": "npx",
      "args": ["-y", "metabase-mcp"],
      "env": {
        "METABASE_URL": "https://your-metabase.example.com",
        "METABASE_API_KEY": "mb_...",
        "METABASE_DATABASE_ID": "2"
      }
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "metabase": {
      "command": "npx",
      "args": ["-y", "metabase-mcp"],
      "env": {
        "METABASE_URL": "https://your-metabase.example.com",
        "METABASE_API_KEY": "mb_...",
        "METABASE_DATABASE_ID": "2"
      }
    }
  }
}
```

### Using a `.env` file

Instead of inline env vars, point to a `.env` file:

```json
{
  "mcpServers": {
    "metabase": {
      "command": "npx",
      "args": ["-y", "metabase-mcp"],
      "env": {
        "METABASE_ENV_FILE": "/path/to/.env"
      }
    }
  }
}
```

Your `.env` file:

```bash
METABASE_URL=https://your-metabase.example.com
METABASE_API_KEY=mb_...
METABASE_DATABASE_ID=2
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `METABASE_URL` | Yes | Metabase base URL (no trailing slash) |
| `METABASE_API_KEY` | Yes | API key from Admin > Settings > Authentication > API Keys |
| `METABASE_DATABASE_ID` | No | Default database ID for queries (default: `2`) |
| `METABASE_ENV_FILE` | No | Path to `.env` file to load config from |

## Getting an API Key

1. Go to your Metabase instance
2. Navigate to **Admin** > **Settings** > **Authentication** > **API Keys**
3. Click **Create API Key**
4. Copy the key (starts with `mb_`)

## Tools

### Querying

| Tool | Description |
|---|---|
| `query` | Run raw SQL against any database. Returns CSV or JSON. |
| `export` | Run SQL with no row limit — streams full results as CSV. |
| `run_card` | Execute a saved question by ID. |
| `run_dashboard_card` | Execute a specific card within a dashboard. |

### Dashboards

| Tool | Description |
|---|---|
| `list_dashboards` | List all dashboards with id, name, description. |
| `get_dashboard` | Get dashboard details including all its cards. |
| `create_dashboard` | Create a new empty dashboard. |
| `add_card_to_dashboard` | Add a saved question to a dashboard with position/size. |

### Saved Questions (Cards)

| Tool | Description |
|---|---|
| `list_cards` | List all saved questions. |
| `get_card` | Get card details including query definition. |
| `create_card` | Create a new saved question from SQL. |

### Schema & Exploration

| Tool | Description |
|---|---|
| `list_databases` | List all connected databases. |
| `list_tables` | List tables in a database. |
| `get_table_schema` | Get columns and types for a table. |
| `list_collections` | List all collections. |
| `search` | Full-text search across dashboards, cards, tables, collections. |

## Examples

Once configured, just ask your AI agent naturally:

- *"What tables are in the database?"*
- *"Run SELECT count(*) FROM users WHERE created_at > '2025-01-01'"*
- *"Show me the schema for the orders table"*
- *"Create a dashboard called 'Weekly KPIs' and add the revenue card to it"*
- *"Search for anything related to churn"*

## Development

```bash
git clone https://github.com/nchgn/metabase-mcp-agents.git
cd metabase-mcp-agents
npm install
npm run build
```

To use your local build instead of npx:

```json
{
  "mcpServers": {
    "metabase": {
      "command": "node",
      "args": ["/path/to/metabase-mcp-agents/dist/server.js"],
      "env": { ... }
    }
  }
}
```

## License

MIT
