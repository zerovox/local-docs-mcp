import Database, { type Database as DB } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

let db: DB;

export function initializeDatabase(dbName: string = "database.db") {
  db = new Database(dbName);
  sqliteVec.load(db);

  console.log("Database initialized and sqlite-vec loaded.");
  const versionRow = db.prepare("select vec_version()").get() as { vec_version: string };
  console.log(`sqlite-vec version: ${versionRow.vec_version}`);

  createTables();
  return db;
}

function createTables() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS Path (
            path TEXT PRIMARY KEY,
            is_directory BOOLEAN,
            last_indexed DATETIME
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS Document (
            docId TEXT PRIMARY KEY,
            path TEXT,
            raw_text TEXT,
            last_modified DATETIME,
            FOREIGN KEY (path) REFERENCES Path(path)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS Chunk (
            chunkId TEXT PRIMARY KEY,
            docId TEXT,
            start_offset INTEGER,
            end_offset INTEGER,
            text TEXT,
            embedding BLOB,
            FOREIGN KEY (docId) REFERENCES Document(docId)
        );
    `);

    // Create virtual table for vector search (embedding column)
    db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ChunkVec USING vec0(embedding float[768]);
    `);

    console.log("Tables created successfully.");
}
