import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { initializeDatabase } from "./db";
import { crawlAndIndex } from "./crawler";
import { queryEmbeddings } from "./embeddings";
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { LocalIndex } from "vectra";

export async function searchHandler(index: LocalIndex, { query, path }: { query: string; path?: string }): Promise<CallToolResult> {
    try {
        const results = await queryEmbeddings(query);
        const content = results.map(result => {
            const metadata = result.item.metadata as { docId: string, text: string };
            return {
                docId: metadata.docId,
                score: result.score,
                text: metadata.text,
            };
        });

        return {
            content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
        };
    } catch (error: any) {
        console.error("Error during search:", error);
        return {
            content: [{ type: "text", text: `Error searching: ${error.message}` }],
            isError: true,
        };
    }
}

function setupMcpServer(index: LocalIndex) {
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
                await crawlAndIndex(path);
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
        (params) => searchHandler(index, params)
    );

    return server;
}

async function main() {
  const index = await initializeDatabase();

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

      const server = setupMcpServer(index);
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
