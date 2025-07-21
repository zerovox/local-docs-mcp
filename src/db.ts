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
        CREATE TABLE IF NOT EXISTS Paths (
            path TEXT PRIMARY KEY,
            is_directory BOOLEAN,
            last_indexed DATETIME
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS Documents (
            docId TEXT PRIMARY KEY,
            path TEXT,
            raw_text TEXT,
            last_modified DATETIME,
            FOREIGN KEY (path) REFERENCES Paths(path)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS Chunks (
            chunkId TEXT PRIMARY KEY,
            docId TEXT,
            start_offset INTEGER,
            end_offset INTEGER,
            text TEXT,
            embedding BLOB,
            FOREIGN KEY (docId) REFERENCES Documents(docId)
        );
    `);

    console.log("Tables created successfully.");
}
