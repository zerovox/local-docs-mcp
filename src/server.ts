import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { initializeDatabase } from "./db";
import { crawlAndIndex } from "./crawler";
import { type Database as DB } from "better-sqlite3";
import { createEmbedding } from "./embeddings";
import { CallToolResult } from '@modelcontextprotocol/sdk/types';

export async function searchHandler(db: DB, { query, path }: { query: string; path?: string }): Promise<CallToolResult> {
    try {
        const queryEmbedding = await createEmbedding(query);

        let rows;
        if (path) {
            const statement = db.prepare(`
                SELECT c.docId, d.raw_text, c.text, c.start_offset, v.distance
                FROM ChunkVec v
                JOIN Chunk c ON v.rowid = c.rowid
                JOIN Document d ON c.docId = d.docId
                JOIN Path p ON d.path = p.path
                WHERE p.path LIKE ?
                  AND v.embedding MATCH ? AND k = 3
                ORDER BY v.distance
                LIMIT 10
            `);
            // LIMIT is present, so this is correct for vec0
            rows = statement.all(`${path}%`, new Uint8Array(queryEmbedding.buffer));
        } else {
            const statement = db.prepare(`
                SELECT c.docId, d.raw_text, c.text, c.start_offset, v.distance
                FROM ChunkVec v
                JOIN Chunk c ON v.rowid = c.rowid
                JOIN Document d ON c.docId = d.docId
                WHERE v.embedding MATCH ? AND k = 3
                ORDER BY v.distance
                LIMIT 10
            `);
            // LIMIT is present, so this is correct for vec0
            rows = statement.all(new Uint8Array(queryEmbedding.buffer));
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
        console.error("Error during search:", error);
        return {
            content: [{ type: "text", text: `Error searching: ${error.message}` }],
            isError: true,
        };
    }
}

function setupMcpServer(db: DB) {
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
        await crawlAndIndex(db, path);
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
    (params) => searchHandler(db, params)
  );

  return server;
}

async function main() {
  const db = initializeDatabase();

  const app = express();
  app.use(express.json());

  // Map to store transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // POST: client-to-server communication
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports[newSessionId] = transport;
        },
        // enableDnsRebindingProtection: true,
        // allowedHosts: ['127.0.0.1'],
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      const server = setupMcpServer(db);
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // GET/DELETE: session notifications/termination
  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

  app.get('/mcp', handleSessionRequest);
  app.delete('/mcp', handleSessionRequest);

  app.listen(3000, () => {
    console.log("MCP HTTP server listening on port 3000");
  });
}

main().catch((error) => {
  console.error("Server error:", error);
});
