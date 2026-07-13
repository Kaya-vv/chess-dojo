import { Client } from '@opensearch-project/opensearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGamesIndex } from './mapping';
import { buildSearchQuery, handler } from './searchGames';

const base = { player: 'naroditsky', color: 'either', startKey: 0 } as const;

describe('buildSearchQuery', () => {
    it('searches both colors with fuzzy and prefix matching', () => {
        const query = buildSearchQuery({ ...base }) as never;
        const should = query['bool']['should'];
        expect(should).toHaveLength(2);
        const whiteName = should[0]['bool']['must'][0]['bool']['should'];
        expect(whiteName).toEqual([
            {
                match: {
                    white: {
                        query: 'naroditsky',
                        fuzziness: 'AUTO',
                        operator: 'and',
                    },
                },
            },
            { match_phrase_prefix: { white: 'naroditsky' } },
        ]);
        expect(query['bool']['minimum_should_match']).toBe(1);
    });

    it('restricts to one side for color=white', () => {
        const query = buildSearchQuery({ ...base, color: 'white' }) as never;
        expect(query['bool']['should']).toHaveLength(1);
        expect(JSON.stringify(query['bool']['should'][0])).toContain('"white"');
    });

    it('applies elo range to the matched side only', () => {
        const query = buildSearchQuery({ ...base, minElo: 1500, maxElo: 1800 }) as never;
        const whiteFilter = query['bool']['should'][0]['bool']['filter'];
        expect(whiteFilter).toContainEqual({
            range: { whiteElo: { gte: 1500, lte: 1800 } },
        });
        const blackFilter = query['bool']['should'][1]['bool']['filter'];
        expect(blackFilter).toContainEqual({
            range: { blackElo: { gte: 1500, lte: 1800 } },
        });
    });

    it('maps win/loss relative to the matched side', () => {
        const query = buildSearchQuery({ ...base, result: 'win' }) as never;
        const whiteFilter = query['bool']['should'][0]['bool']['filter'];
        const blackFilter = query['bool']['should'][1]['bool']['filter'];
        expect(whiteFilter).toContainEqual({ term: { result: '1-0' } });
        expect(blackFilter).toContainEqual({ term: { result: '0-1' } });
    });

    it('treats draw and absolute results as top-level filters', () => {
        const query = buildSearchQuery({ ...base, result: 'draw' }) as never;
        expect(query['bool']['filter']).toContainEqual({ term: { result: '1/2-1/2' } });
        const whiteFilter = query['bool']['should'][0]['bool']['filter'];
        expect(whiteFilter).toEqual([]);
    });

    it('applies cohort and date filters at the top level', () => {
        const query = buildSearchQuery({
            ...base,
            cohort: 'masters',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
        }) as never;
        expect(query['bool']['filter']).toContainEqual({ term: { cohort: 'masters' } });
        expect(query['bool']['filter']).toContainEqual({
            range: { date: { gte: '2024-01-01', lte: '2024-12-31' } },
        });
    });

    it('builds filter-only queries without a player', () => {
        const query = buildSearchQuery({
            color: 'either',
            startKey: 0,
            minElo: 2600,
            result: 'whiteWin',
            cohort: 'masters',
        }) as never;
        expect(query['bool']['should']).toBeUndefined();
        expect(query['bool']['filter']).toContainEqual({
            range: { whiteElo: { gte: 2600 } },
        });
        expect(query['bool']['filter']).toContainEqual({
            range: { blackElo: { gte: 2600 } },
        });
        expect(query['bool']['filter']).toContainEqual({ term: { result: '1-0' } });
        expect(query['bool']['filter']).toContainEqual({ term: { cohort: 'masters' } });
    });

    it('matches everything with no criteria', () => {
        const query = buildSearchQuery({ color: 'either', startKey: 0 }) as never;
        expect(query['bool']['should']).toBeUndefined();
        expect(query['bool']['filter']).toEqual([]);
    });

    it('routes ECO codes in opening to a prefix filter', () => {
        const query = buildSearchQuery({ color: 'either', startKey: 0, opening: 'b1' }) as never;
        expect(query['bool']['filter']).toContainEqual({ prefix: { eco: 'B1' } });
    });

    it('routes opening names to text matching', () => {
        const query = buildSearchQuery({
            color: 'either',
            startKey: 0,
            opening: 'caro kann',
        }) as never;
        expect(query['bool']['filter']).toContainEqual({
            bool: {
                should: [
                    { match: { opening: { query: 'caro kann', operator: 'and' } } },
                    { match_phrase_prefix: { opening: 'caro kann' } },
                ],
                minimum_should_match: 1,
            },
        });
    });

    it('converts a move range to a plyCount range', () => {
        const query = buildSearchQuery({
            color: 'either',
            startKey: 0,
            minMoves: 20,
            maxMoves: 40,
        }) as never;
        expect(query['bool']['filter']).toContainEqual({
            range: { plyCount: { gte: 39, lte: 80 } },
        });
    });

    it('filters by time class', () => {
        const query = buildSearchQuery({
            color: 'either',
            startKey: 0,
            timeClass: 'blitz',
        }) as never;
        expect(query['bool']['filter']).toContainEqual({ term: { timeClass: 'blitz' } });
    });

    it('applies the new filters at the top level with a player too', () => {
        const query = buildSearchQuery({
            ...base,
            opening: 'B12',
            minMoves: 10,
            timeClass: 'rapid',
        }) as never;
        expect(query['bool']['filter']).toContainEqual({ prefix: { eco: 'B12' } });
        expect(query['bool']['filter']).toContainEqual({
            range: { plyCount: { gte: 19 } },
        });
        expect(query['bool']['filter']).toContainEqual({ term: { timeClass: 'rapid' } });
        expect(query['bool']['should']).toHaveLength(2);
    });
});

describe('handler', () => {
    it('returns 503 when search is not configured', async () => {
        const previous = process.env.gameSearchEndpoint;
        process.env.gameSearchEndpoint = 'unset';
        try {
            const response = (await handler(
                { queryStringParameters: { player: 'naroditsky' } } as never,
                undefined as never,
                () => null,
            )) as { statusCode?: number; body?: string };
            expect(response.statusCode).toBe(503);
            expect(JSON.parse(response.body ?? '{}')).toEqual({
                message: 'Game search is not available on this deployment',
                code: 503,
            });
        } finally {
            process.env.gameSearchEndpoint = previous;
        }
    });

    it('rejects absolute results when a player is provided', async () => {
        const previous = process.env.gameSearchEndpoint;
        process.env.gameSearchEndpoint = 'http://localhost:9200';
        try {
            const response = (await handler(
                {
                    queryStringParameters: {
                        player: 'carlsen',
                        result: 'whiteWin',
                    },
                } as never,
                undefined as never,
                () => null,
            )) as { statusCode?: number; body?: string };
            expect(response.statusCode).toBe(400);
            expect(JSON.parse(response.body ?? '{}')).toEqual({
                message: 'Invalid request: : result whiteWin/blackWin cannot be used with a player',
                code: 400,
            });
        } finally {
            process.env.gameSearchEndpoint = previous;
        }
    });
});

const runIntegration = process.env.OPENSEARCH_INTEGRATION === 'true';

describe.runIf(runIntegration)('search query semantics (integration)', () => {
    const stage = `test-search-${Date.now()}`;
    const index = `${stage}-games`;
    const client = new Client({ node: 'http://localhost:9200' });

    const docs = [
        // Naroditsky as white, wins, 2650
        {
            cohort: '1500-1600',
            id: 'g1',
            white: 'Daniel Naroditsky',
            black: 'A B',
            whiteElo: 2650,
            result: '1-0',
            eco: 'B12',
            opening: 'Caro-Kann Defense',
            plyCount: 80,
            timeClass: 'classical',
            date: '2026-06-15',
            createdAt: '2026-07-01T12:00:00Z',
            owner: 'u1',
            ownerDisplayName: 'U1',
        },
        // Naroditsky as black, loses, 2650
        {
            cohort: 'masters',
            id: 'g2',
            white: 'C D',
            black: 'Daniel Naroditsky',
            blackElo: 2650,
            result: '1-0',
            eco: 'C42',
            opening: 'Petrov Defense',
            plyCount: 30,
            timeClass: 'blitz',
            date: '2026-06-16',
            createdAt: '2026-07-01T12:00:00Z',
            owner: 'u2',
            ownerDisplayName: 'U2',
        },
    ];

    beforeAll(async () => {
        await createGamesIndex(client, index);
        for (const [i, doc] of docs.entries()) {
            await client.index({ index, id: String(i), body: doc, refresh: true });
        }
    });

    afterAll(async () => {
        await client.indices.delete({ index });
    });

    async function ids(request: object): Promise<string[]> {
        const res = await client.search({
            index,
            body: {
                query: buildSearchQuery({
                    startKey: 0,
                    color: 'either',
                    ...request,
                } as never),
            },
        });
        return res.body.hits.hits.map((h) => (h._source as { id: string }).id).sort();
    }

    it('finds both colors for a partial name', async () => {
        expect(await ids({ player: 'naroditsky' })).toEqual(['g1', 'g2']);
    });

    it('finds a first-name prefix', async () => {
        expect(await ids({ player: 'daniel n' })).toEqual(['g1', 'g2']);
    });

    it('filters wins relative to the player', async () => {
        expect(await ids({ player: 'naroditsky', result: 'win' })).toEqual(['g1']);
    });

    it('filters by cohort', async () => {
        expect(await ids({ player: 'naroditsky', cohort: 'masters' })).toEqual(['g2']);
    });

    it('applies elo to the matched side', async () => {
        expect(await ids({ player: 'naroditsky', minElo: 2600 })).toEqual(['g1', 'g2']);
        expect(await ids({ player: 'naroditsky', minElo: 2700 })).toEqual([]);
    });

    it('supports filter-only searches', async () => {
        expect(await ids({ cohort: 'masters' })).toEqual(['g2']);
        expect(await ids({ result: 'whiteWin' })).toEqual(['g1', 'g2']);
        // Both docs are missing one side's elo, so a both-sides range matches neither.
        expect(await ids({ minElo: 2600 })).toEqual([]);
        expect(await ids({})).toEqual(['g1', 'g2']);
    });

    it('filters by opening name and eco prefix', async () => {
        expect(await ids({ opening: 'caro' })).toEqual(['g1']);
        expect(await ids({ opening: 'B1' })).toEqual(['g1']);
        expect(await ids({ opening: 'kasparov gambit' })).toEqual([]);
    });

    it('filters by move count range', async () => {
        expect(await ids({ minMoves: 30 })).toEqual(['g1']);
        expect(await ids({ maxMoves: 20 })).toEqual(['g2']);
    });

    it('filters by time class', async () => {
        expect(await ids({ timeClass: 'blitz' })).toEqual(['g2']);
        expect(await ids({ timeClass: 'bullet' })).toEqual([]);
    });

    it('does not expose OpenSearch details when a search fails', async () => {
        const previousEndpoint = process.env.gameSearchEndpoint;
        const previousStage = process.env.stage;
        process.env.gameSearchEndpoint = 'http://localhost:9200';
        process.env.stage = stage;
        try {
            const response = (await handler(
                { queryStringParameters: { startKey: '10000' } } as never,
                undefined as never,
                () => null,
            )) as { statusCode?: number; body?: string };

            expect(response.statusCode).toBe(500);
            expect(JSON.parse(response.body ?? '{}')).toEqual({
                message: 'Temporary server error',
                code: 500,
            });
            expect(response.body).not.toContain('ResponseError');
            expect(response.body).not.toContain('test-games');
        } finally {
            process.env.gameSearchEndpoint = previousEndpoint;
            process.env.stage = previousStage;
        }
    });
});
