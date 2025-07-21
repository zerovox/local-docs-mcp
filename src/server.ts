import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { initializeDatabase } from "./db";
import { crawlAndIndex } from "./crawler";
import { type Database as DB } from "better-sqlite3";
import { createEmbedding } from "./embeddings";

import { CallToolResult } from '@modelcontextprotocol/sdk/types';

export async function searchHandler(db: DB, server: McpServer, { query, path }: { query: string; path?: string }): Promise<CallToolResult> {
    try {
        const queryEmbedding = await createEmbedding(server, query, process.env.USE_OLLAMA === 'true');

        let rows;
        if (path) {
            const statement = db.prepare(`
                SELECT c.docId, d.raw_text, c.text, c.start_offset
                FROM Chunks c
                JOIN Documents d ON c.docId = d.docId
                JOIN Paths p ON d.path = p.path
                WHERE p.path LIKE ? AND c.embedding IN (
                    SELECT embedding FROM vec_search(?, ?)
                )
            `);
            rows = statement.all(`${path}%`, queryEmbedding.buffer, 10);
        } else {
            const statement = db.prepare(`
                SELECT c.docId, d.raw_text, c.text, c.start_offset
                FROM Chunks c
                JOIN Documents d ON c.docId = d.docId
                WHERE c.embedding IN (
                    SELECT embedding FROM vec_search(?, ?)
                )
            `);
            rows = statement.all(queryEmbedding.buffer, 10);
        }

        const results = rows.map((row: any) => {
            const { docId, raw_text, text, start_offset } = row;
            const before = raw_text.slice(0, start_offset);
            return {
                docId,
                before,
                match: text,
                text: raw_text,
            };
        });

        return {
            content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error searching: ${error.message}` }],
            isError: true,
        };
    }
}

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
        await crawlAndIndex(db, server, path);
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

  server.registerPrompt(
    "createEmbedding",
    {
      title: "Create Embedding",
      description: "Create an embedding for a given text.",
      argsSchema: {
        text: z.string(),
      },
    },
    ({ text }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Create an embedding for the following text: ${text}`,
          },
        },
      ],
    })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  server.registerTool(
    "search",
    {
      title: "Search Documents",
      description: "Search for documents.",
      inputSchema: {
        query: z.string().describe("The search query."),
        path: z.string().optional().describe("The path to the directory to search in."),
      },
    },
    (params) => searchHandler(db, server, params)
  );

  console.log("MCP server connected to transport");
}

main().catch((error) => {
  console.error("Server error:", error);
});
