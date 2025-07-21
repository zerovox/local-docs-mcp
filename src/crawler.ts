import * as fs from "fs";
import * as path from "path";
import { type Database as DB } from "better-sqlite3";
import { createEmbedding } from "./embeddings";

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

export async function indexFiles(db: DB, files: string[]) {
    for (const file of files) {
        const text = extractText(file);
        if (text) {
            const docId = file;
            const chunks = chunkText(text, 500, 100);

            db.prepare("INSERT OR REPLACE INTO Path (path, is_directory, last_indexed) VALUES (?, ?, ?)")
              .run(path.dirname(file), 1, new Date().toISOString());

            db.prepare("INSERT OR REPLACE INTO Path (path, is_directory, last_indexed) VALUES (?, ?, ?)")
              .run(file, 0, new Date().toISOString());

            db.prepare("INSERT OR REPLACE INTO Document (docId, path, raw_text, last_modified) VALUES (?, ?, ?, ?)")
              .run(docId, file, text, new Date().toISOString());

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkId = `${docId}-${i}`;
                const start_offset = i * (500 - 100);
                const end_offset = start_offset + chunk.length;

                const embedding = await createEmbedding(chunk);
                // Ensure embedding.buffer is a Buffer, string, or null
                const embeddingBuffer = Buffer.isBuffer(embedding.buffer)
                  ? embedding.buffer
                  : Buffer.from(embedding.buffer);

                db.prepare("INSERT OR REPLACE INTO Chunk (chunkId, docId, start_offset, end_offset, text, embedding) VALUES (?, ?, ?, ?, ?, ?)")
                    .run(chunkId, docId, start_offset, end_offset, chunk, embeddingBuffer);
            }
        }
    }
}

export function crawlAndIndex(db: DB, dir: string) {
    const files = crawlDirectory(dir);
    indexFiles(db, files);
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
