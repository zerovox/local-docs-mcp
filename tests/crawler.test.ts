import { chunkText, indexFiles } from '../src/crawler';
import * as fs from 'fs';
import { createEmbedding, storeEmbeddings } from '../src/embeddings';
import { getIndex, initializeDatabase } from '../src/db';
import { LocalIndex } from 'vectra';

jest.mock('fs');
jest.mock('../src/embeddings');
jest.mock('../src/db');

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
    let index: LocalIndex;

    beforeEach(async () => {
        (initializeDatabase as jest.Mock).mockResolvedValue({
            addItems: jest.fn(),
        });
        (getIndex as jest.Mock).mockReturnValue({
            addItems: jest.fn(),
        });
        index = await initializeDatabase();
        (createEmbedding as jest.Mock).mockResolvedValue([0.1, 0.2, 0.3]);
        (storeEmbeddings as jest.Mock).mockResolvedValue(undefined);
    });

    it('should do nothing if no files are provided', async () => {
        await indexFiles([]);
        expect(storeEmbeddings).not.toHaveBeenCalled();
    });

    it('should index a single file', async () => {
        (fs.readFileSync as jest.Mock).mockReturnValue('This is a test file.');
        await indexFiles(['/test.txt']);
        expect(storeEmbeddings).toHaveBeenCalled();
    });
});
