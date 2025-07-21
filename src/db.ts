import { LocalIndex } from 'vectra';
import { join } from 'path';

let index: LocalIndex;

export async function initializeDatabase(dbName: string = "vectra") {
    const indexPath = join(__dirname, '..', dbName);
    index = new LocalIndex(indexPath);
    if (!await index.isIndexCreated()) {
        await index.createIndex();
    }
    console.log("Vectra index initialized.");
    return index;
}

export function getIndex() {
    if (!index) {
        throw new Error("Database not initialized. Call initializeDatabase first.");
    }
    return index;
}
