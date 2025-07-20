import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeDatabase } from "./db";

async function main() {
  const db = initializeDatabase();

  const server = new McpServer({
    name: "local-docs-mcp",
    version: "1.0.0",
  });

  console.log("MCP server starting...");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("MCP server connected to transport");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
