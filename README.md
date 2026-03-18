# metabase-mcp

MCP server for Metabase — gives AI agents full access to query, read, and create content in Metabase.

## Tools

| Tool | Description |
|---|---|
| `query` | Run raw SQL, get CSV or JSON |
| `export` | Run SQL with no row limit (streaming CSV) |
| `run_card` | Execute a saved question by ID |
| `list_dashboards` | List all dashboards |
| `get_dashboard` | Get dashboard details + cards |
| `create_dashboard` | Create a new dashboard |
| `run_dashboard_card` | Execute a card within a dashboard |
| `list_cards` | List all saved questions |
| `get_card` | Get card details + query definition |
| `create_card` | Create a saved question from SQL |
| `add_card_to_dashboard` | Add a card to a dashboard |
| `list_tables` | List tables in a database |
| `get_table_schema` | Get columns and types for a table |
| `list_databases` | List all connected databases |
| `list_collections` | List all collections |
| `search` | Search across all content |

## Setup

### 1. Build

```bash
npm install
npm run build
```

### 2. Get an API key

Go to your Metabase instance → Admin → Settings → Authentication → API Keys → Create.

### 3. Add to Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "metabase": {
      "command": "node",
      "args": ["/path/to/metabase-mcp/dist/server.js"],
      "env": {
        "METABASE_URL": "https://your-metabase.example.com",
        "METABASE_API_KEY": "mb_...",
        "METABASE_DATABASE_ID": "2"
      }
    }
  }
}
```

## Config

All config via environment variables:

| Variable | Required | Description |
|---|---|---|
| `METABASE_URL` | Yes | Metabase base URL |
| `METABASE_API_KEY` | Yes | API key (created in Admin panel) |
| `METABASE_DATABASE_ID` | No | Default database ID (default: 2) |
