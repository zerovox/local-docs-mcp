import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import ollama from "ollama";

export async function createEmbedding(
    server: McpServer,
    text: string,
    useOllama: boolean = false
): Promise<Float32Array> {
    if (useOllama) {
        const response = await ollama.embed({
            model: "nomic-embed-text",
            input: text,
        });
        return new Float32Array(response.embeddings[0]);
    } else {
        const response = await server.server.createMessage({
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Create an embedding for the following text: ${text}`,
                    },
                },
            ],
            maxTokens: 2048,
        });

        if (response.content.type !== "text") {
            throw new Error("Failed to create embedding");
        }

        return new Float32Array(JSON.parse(response.content.text));
    }
}
