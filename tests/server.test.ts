import { searchHandler } from '../src/server';
import { Database as DB } from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { createEmbedding } from '../src/embeddings';

jest.mock('fs');
jest.mock('../src/db');
jest.mock('../src/embeddings');

describe('searchHandler', () => {
    let db: any;
    let server: McpServer;

    beforeEach(() => {
        db = {
            prepare: jest.fn().mockReturnThis(),
            run: jest.fn(),
            all: jest.fn().mockReturnValue([]),
        };

        server = {} as any;

        (createEmbedding as jest.Mock).mockResolvedValue(new Float32Array([0.1, 0.2, 0.3]));
    });

    it('should return an empty array when no results are found', async () => {
        const result = await searchHandler(db, server, { query: 'test' });
        expect(result.content[0].text).toBe('[]');
    });

    it('should return results when they are found', async () => {
        const mockRows = [
            { docId: 'test.txt', raw_text: 'This is a test file.', text: 'test file', start_offset: 10 },
        ];
        db.all.mockReturnValue(mockRows);

        const result = await searchHandler(db, server, { query: 'test' });
        const expected = [
            {
                docId: 'test.txt',
                before: 'This is a ',
                match: 'test file',
                text: 'This is a test file.',
            },
        ];
        expect(result.content[0].text).toBe(JSON.stringify(expected, null, 2));
    });

    it('should call the correct query for vector search', async () => {
        await searchHandler(db, server, { query: 'test' });
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('vec_search'));
    });

    it('should call createEmbedding with useOllama false by default', async () => {
        await searchHandler(db, server, { query: 'test' });
        expect(createEmbedding).toHaveBeenCalledWith(server, 'test', false);
    });

    it('should call createEmbedding with useOllama true when the environment variable is set', async () => {
        process.env.USE_OLLAMA = 'true';
        await searchHandler(db, server, { query: 'test' });
        expect(createEmbedding).toHaveBeenCalledWith(server, 'test', true);
        delete process.env.USE_OLLAMA;
    });
});
