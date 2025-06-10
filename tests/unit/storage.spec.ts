import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { upsertStep, touchPath, StepInput } from '../../src/storage';
import fs from 'fs';

let db: Database.Database;

test.beforeAll(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync('src/storage.ts', 'utf-8').match(/CREATE TABLE[\s\S]*?;/g);
    if (schema) {
        db.exec(schema.join(''));
    }

    // Monkey-patch the db instance in the storage module
    // This is a bit of a hack, but it's the simplest way to make this testable
    // without a larger dependency injection refactor.
    require('../../src/storage').__setDb(db);
});

test.afterAll(() => {
    db.close();
});

test.describe('storage', () => {
    const mockStep: StepInput = {
        pathId: 'test-path',
        seq: 0,
        url: 'https://example.com',
        dom: '<html><body>Hello</body></html>',
        screenshot: 'test.png',
    };

    test('upsertStep should return "new" for a new step', () => {
        const result = upsertStep(mockStep);
        expect(result).toBe('new');
    });

    test('upsertStep should return "same" for an existing step', () => {
        upsertStep(mockStep);
        const result = upsertStep(mockStep);
        expect(result).toBe('same');
    });

    test('upsertStep should return "changed" for a modified step', () => {
        upsertStep(mockStep);
        const modifiedStep = { ...mockStep, dom: '<html><body>Goodbye</body></html>' };
        const result = upsertStep(modifiedStep);
        expect(result).toBe('changed');
    });

    test('touchPath should update lastSeen', async () => {
        const pathId = 'touch-test';
        db.prepare(`
            INSERT INTO paths (pathId, firstSeen, lastSeen) 
            VALUES (?, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
        `).run(pathId);

        const oldTimestamp = db.prepare('SELECT lastSeen FROM paths WHERE pathId = ?').get(pathId) as { lastSeen: string };
        
        await new Promise(resolve => setTimeout(resolve, 10)); // ensure time passes

        touchPath(pathId);

        const newTimestamp = db.prepare('SELECT lastSeen FROM paths WHERE pathId = ?').get(pathId) as { lastSeen: string };

        expect(newTimestamp.lastSeen).not.toBe(oldTimestamp.lastSeen);
    });
}); 