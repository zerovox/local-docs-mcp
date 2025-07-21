import ollama from "ollama";

export async function createEmbedding(text: string): Promise<Float32Array> {
    const response = await ollama.embed({
        model: "nomic-embed-text",
        input: text,
    });
    return new Float32Array(response.embeddings[0]);
}
