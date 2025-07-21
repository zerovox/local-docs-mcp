import { searchHandler } from '../src/server';
import { createEmbedding, queryEmbeddings } from '../src/embeddings';
import { initializeDatabase, getIndex } from '../src/db';
import { LocalIndex } from 'vectra';

jest.mock('fs');
jest.mock('../src/db');
jest.mock('../src/embeddings');

describe('searchHandler', () => {
    let index: LocalIndex;

    beforeEach(async () => {
        (initializeDatabase as jest.Mock).mockResolvedValue({
            queryItems: jest.fn().mockResolvedValue([]),
        });
        (getIndex as jest.Mock).mockReturnValue({
            queryItems: jest.fn().mockResolvedValue([]),
        });
        index = await initializeDatabase();
        (createEmbedding as jest.Mock).mockResolvedValue([0.1, 0.2, 0.3]);
        (queryEmbeddings as jest.Mock).mockResolvedValue([]);
    });

    it('should return an empty array when no results are found', async () => {
        const result = await searchHandler(index, { query: 'test' });
        expect(JSON.parse(result.content[0].text as string)).toEqual([]);
    });

    it('should return results when they are found', async () => {
        const mockResults = [
            {
                item: { metadata: { docId: 'test.txt', text: 'This is a test file.' } },
                score: 0.9,
            },
        ];
        (queryEmbeddings as jest.Mock).mockResolvedValue(mockResults);

        const result = await searchHandler(index, { query: 'test' });
        const expected = [
            {
                docId: 'test.txt',
                score: 0.9,
                text: 'This is a test file.',
            },
        ];
        expect(JSON.parse(result.content[0].text as string)).toEqual(expected);
    });
});
