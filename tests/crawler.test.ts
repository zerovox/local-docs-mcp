import { chunkText, indexFiles } from '../src/crawler';
import { Database as DB } from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as fs from 'fs';
import { createEmbedding } from '../src/embeddings';

jest.mock('fs');
jest.mock('../src/embeddings');

describe('chunkText', () => {
    it('should chunk text into pieces of the specified size', () => {
        const text = 'This is a test string';
        const chunks = chunkText(text, 10, 0);
        expect(chunks).toEqual(['This is a ', 'test strin', 'g']);
    });

    it('should handle overlap correctly', () => {
        const text = 'This is a test string';
        const chunks = chunkText(text, 10, 2);
        expect(chunks).toEqual(['This is a ', 'a test str', 'tring']);
    });
});

describe('indexFiles', () => {
    let db: DB;
    let server: McpServer;

    beforeEach(() => {
        db = {
            prepare: jest.fn().mockReturnThis(),
            run: jest.fn(),
        } as any;

        server = {} as any;

        (createEmbedding as jest.Mock).mockResolvedValue(new Float32Array([0.1, 0.2, 0.3]));
    });

    it('should do nothing if no files are provided', async () => {
        await indexFiles(db, server, []);
        expect(db.prepare).not.toHaveBeenCalled();
    });

    it('should index a single file', async () => {
        (fs.readFileSync as jest.Mock).mockReturnValue('This is a test file.');
        await indexFiles(db, server, ['/test.txt']);
        expect(db.prepare).toHaveBeenCalledTimes(4);
    });

    it('should call createEmbedding with useOllama false by default', async () => {
        (fs.readFileSync as jest.Mock).mockReturnValue('This is a test file.');
        await indexFiles(db, server, ['/test.txt']);
        expect(createEmbedding).toHaveBeenCalledWith(server, 'This is a test file.', false);
    });

    it('should call createEmbedding with useOllama true when the environment variable is set', async () => {
        process.env.USE_OLLAMA = 'true';
        (fs.readFileSync as jest.Mock).mockReturnValue('This is a test file.');
        await indexFiles(db, server, ['/test.txt']);
        expect(createEmbedding).toHaveBeenCalledWith(server, 'This is a test file.', true);
        delete process.env.USE_OLLAMA;
    });
});
