import { chunkText, indexFiles } from '../src/crawler';
import { Database as DB } from 'better-sqlite3';

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

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    statSync: jest.fn(),
    readdirSync: jest.fn(),
}));

import * as fs from 'fs';

describe('indexFiles', () => {
    let db: DB;

    beforeEach(() => {
        db = {
            prepare: jest.fn().mockReturnThis(),
            run: jest.fn(),
        } as any;
    });

    it('should do nothing if no files are provided', () => {
        indexFiles(db, []);
        expect(db.prepare).not.toHaveBeenCalled();
    });

    it('should index a single file', () => {
        (fs.readFileSync as jest.Mock).mockReturnValue('This is a test file.');
        indexFiles(db, ['/test.txt']);
        expect(db.prepare).toHaveBeenCalledTimes(4);
    });
});
