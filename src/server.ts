import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { initializeDatabase } from "./db";
import { crawlAndIndex } from "./crawler";

async function main() {
  const db = initializeDatabase();

  const server = new McpServer({
    name: "local-docs-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "index",
    {
      title: "Index Directory",
      description: "Index a directory of documents.",
      inputSchema: {
        path: z.string().describe("The path to the directory to index."),
      },
    },
    async ({ path }) => {
      try {
        crawlAndIndex(db, path);
        return {
          content: [{ type: "text", text: `Successfully indexed ${path}` }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error indexing ${path}: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  console.log("MCP server starting...");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("MCP server connected to transport");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
