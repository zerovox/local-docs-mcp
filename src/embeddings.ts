import ollama from "ollama";
import { getIndex } from "./db";
import { IndexItem, LocalIndex } from "vectra";

export async function createEmbedding(text: string): Promise<number[]> {
    const response = await ollama.embeddings({
        model: "nomic-embed-text",
        prompt: text,
    });
    return response.embedding;
}

export async function storeEmbeddings(embeddings: { text: string, embedding: number[], metadata: { docId: string } }[]) {
    const index = getIndex();
    const items: any[] = embeddings.map(e => ({
        vector: e.embedding,
        metadata: e.metadata,
        text: e.text,
    }));
    await (index as any).addItems(items);
}

export async function queryEmbeddings(query: string, topK: number = 5) {
    const index = getIndex();
    const queryEmbedding = await createEmbedding(query);
    const results = await index.queryItems(queryEmbedding, query, topK);
    return results;
}
