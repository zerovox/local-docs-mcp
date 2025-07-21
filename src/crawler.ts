import * as fs from "fs";
import * as path from "path";
import { createEmbedding, storeEmbeddings } from "./embeddings";
import { getIndex } from "./db";

export function extractText(filePath: string): string | null {
    const extension = path.extname(filePath);
    if (extension !== ".md" && extension !== ".txt") {
        return null;
    }

    return fs.readFileSync(filePath, "utf-8");
}

export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        const chunk = text.slice(i, i + chunkSize);
        chunks.push(chunk);
        if (chunk.length < chunkSize) {
            break;
        }
        i += chunkSize - overlap;
    }
    return chunks;
}

export async function indexFiles(files: string[]) {
    const index = getIndex();
    for (const file of files) {
        const text = extractText(file);
        if (text) {
            const docId = file;
            const chunks = chunkText(text, 500, 100);

            const embeddings = await Promise.all(chunks.map(async (chunk) => {
                const embedding = await createEmbedding(chunk);
                return { text: chunk, embedding, docId };
            }));

            await storeEmbeddings(embeddings.map(e => ({
                text: e.text,
                embedding: e.embedding,
                metadata: { docId: e.docId }
            })));
        }
    }
}

export async function crawlAndIndex(dir: string) {
    const files = crawlDirectory(dir);
    await indexFiles(files);
}

export function crawlDirectory(dir: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...crawlDirectory(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}
