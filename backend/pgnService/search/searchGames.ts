'use strict';

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import { ApiError, errToApiGatewayProxyResultV2 } from '../../directoryService/api';
import { gamesIndex, getClient, isSearchEnabled } from './client';
import { SearchDocument } from './document';

const PAGE_SIZE = 50;
const MAX_RESULTS = 10000;

const requestSchema = z
    .object({
        player: z.string().trim().min(1).optional(),
        color: z.enum(['white', 'black', 'either']).default('either'),
        minElo: z.coerce.number().int().optional(),
        maxElo: z.coerce.number().int().optional(),
        result: z.enum(['win', 'draw', 'loss', 'whiteWin', 'blackWin']).optional(),
        cohort: z.string().optional(),
        opening: z.string().trim().min(1).optional(),
        minMoves: z.coerce.number().int().min(0).optional(),
        maxMoves: z.coerce.number().int().min(0).optional(),
        timeClass: z.enum(['bullet', 'blitz', 'rapid', 'classical', 'daily']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        startKey: z.coerce.number().int().min(0).default(0),
    })
    .refine((req) => req.player || (req.result !== 'win' && req.result !== 'loss'), {
        message: 'result win/loss requires a player',
    })
    .refine((req) => !req.player || (req.result !== 'whiteWin' && req.result !== 'blackWin'), {
        message: 'result whiteWin/blackWin cannot be used with a player',
    });

export type SearchGamesRequest = z.infer<typeof requestSchema>;

/** Matches an ECO code or prefix: a letter A-E plus 0-2 digits. */
const ECO_REGEX = /^[A-Ea-e]\d{0,2}$/;

/** Result values relative to the matched side. */
const SIDE_RESULTS = {
    white: { win: '1-0', loss: '0-1' },
    black: { win: '0-1', loss: '1-0' },
} as const;

/** Result values independent of any matched player. */
const ABSOLUTE_RESULTS = {
    draw: '1/2-1/2',
    whiteWin: '1-0',
    blackWin: '0-1',
} as const;

/** Returns the range bounds for the request's min/max elo, or undefined when neither is set. */
function eloRange(request: SearchGamesRequest): object | undefined {
    if (request.minElo === undefined && request.maxElo === undefined) {
        return undefined;
    }
    return {
        ...(request.minElo !== undefined ? { gte: request.minElo } : {}),
        ...(request.maxElo !== undefined ? { lte: request.maxElo } : {}),
    };
}

/** Builds the clause matching one side of the board. */
function sideClause(player: string, request: SearchGamesRequest, side: 'white' | 'black'): object {
    const filter: object[] = [];

    const range = eloRange(request);
    if (range) {
        filter.push({ range: { [side === 'white' ? 'whiteElo' : 'blackElo']: range } });
    }
    if (request.result === 'win' || request.result === 'loss') {
        filter.push({ term: { result: SIDE_RESULTS[side][request.result] } });
    }

    return {
        bool: {
            must: [
                {
                    bool: {
                        should: [
                            {
                                match: {
                                    [side]: {
                                        query: player,
                                        fuzziness: 'AUTO',
                                        operator: 'and',
                                    },
                                },
                            },
                            { match_phrase_prefix: { [side]: player } },
                        ],
                        minimum_should_match: 1,
                    },
                },
            ],
            filter,
        },
    };
}

/** Builds the OpenSearch query for a game search request. */
export function buildSearchQuery(request: SearchGamesRequest): object {
    const filter: object[] = [];
    if (request.cohort) {
        filter.push({ term: { cohort: request.cohort } });
    }
    if (request.startDate || request.endDate) {
        filter.push({
            range: {
                date: {
                    ...(request.startDate ? { gte: request.startDate } : {}),
                    ...(request.endDate ? { lte: request.endDate } : {}),
                },
            },
        });
    }
    if (request.result && request.result in ABSOLUTE_RESULTS) {
        filter.push({
            term: {
                result: ABSOLUTE_RESULTS[request.result as keyof typeof ABSOLUTE_RESULTS],
            },
        });
    }

    if (request.opening) {
        if (ECO_REGEX.test(request.opening)) {
            filter.push({ prefix: { eco: request.opening.toUpperCase() } });
        } else {
            filter.push({
                bool: {
                    should: [
                        { match: { opening: { query: request.opening, operator: 'and' } } },
                        { match_phrase_prefix: { opening: request.opening } },
                    ],
                    minimum_should_match: 1,
                },
            });
        }
    }
    if (request.minMoves !== undefined || request.maxMoves !== undefined) {
        filter.push({
            range: {
                plyCount: {
                    ...(request.minMoves !== undefined ? { gte: 2 * request.minMoves - 1 } : {}),
                    ...(request.maxMoves !== undefined ? { lte: 2 * request.maxMoves } : {}),
                },
            },
        });
    }
    if (request.timeClass) {
        filter.push({ term: { timeClass: request.timeClass } });
    }

    if (!request.player) {
        // Filter-only search: the elo range must hold for both players.
        const range = eloRange(request);
        if (range) {
            filter.push({ range: { whiteElo: range } });
            filter.push({ range: { blackElo: range } });
        }
        return { bool: { filter } };
    }

    const should: object[] = [];
    if (request.color !== 'black') {
        should.push(sideClause(request.player, request, 'white'));
    }
    if (request.color !== 'white') {
        should.push(sideClause(request.player, request, 'black'));
    }
    return { bool: { should, minimum_should_match: 1, filter } };
}

/** Converts a SearchDocument into the GameInfo shape the frontend renders. */
function toGameInfo(doc: SearchDocument): object {
    const pgnDate = doc.date.replaceAll('-', '.');
    return {
        cohort: doc.cohort,
        id: doc.id,
        date: pgnDate,
        createdAt: doc.createdAt,
        owner: doc.owner,
        ownerDisplayName: doc.ownerDisplayName,
        ownerPreviousCohort: '',
        headers: {
            White: doc.white,
            Black: doc.black,
            WhiteElo: doc.whiteElo?.toString(),
            BlackElo: doc.blackElo?.toString(),
            Result: doc.result,
            Date: pgnDate,
            ECO: doc.eco,
            Opening: doc.opening,
            TimeControl: doc.timeControl,
            PlyCount: doc.plyCount?.toString(),
        },
    };
}

/**
 * Searches the games index by player name with optional color, elo,
 * result, cohort and date filters. See docs/game-search-design.md.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    console.log('Event: %j', event);

    if (!isSearchEnabled()) {
        // Simple deployments have no search domain.
        return errToApiGatewayProxyResultV2(
            new ApiError({
                statusCode: 503,
                publicMessage: 'Game search is not available on this deployment',
            }),
        );
    }

    const parsed = requestSchema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) {
        return errToApiGatewayProxyResultV2(
            new ApiError({
                statusCode: 400,
                publicMessage: `Invalid request: ${parsed.error.issues
                    .map((i) => `${i.path.join('.')}: ${i.message}`)
                    .join(', ')}`,
            }),
        );
    }
    const request = parsed.data;

    try {
        const response = await getClient().search({
            index: gamesIndex(),
            body: {
                query: buildSearchQuery(request),
                sort: [{ date: 'desc' }, '_score'],
                from: request.startKey,
                size: PAGE_SIZE,
            },
        });

        const hits = response.body.hits;
        const games = hits.hits
            .map((hit) => hit._source)
            .filter((source): source is SearchDocument => source !== undefined)
            .map(toGameInfo);

        const next = request.startKey + PAGE_SIZE;
        const total = typeof hits.total === 'number' ? hits.total : (hits.total?.value ?? 0);
        const lastEvaluatedKey = total > next && next < MAX_RESULTS ? String(next) : undefined;

        return {
            statusCode: 200,
            body: JSON.stringify({ games, lastEvaluatedKey }),
        };
    } catch (err) {
        console.error('Failed to search games for request %j:', request, err);
        return errToApiGatewayProxyResultV2(
            new ApiError({
                statusCode: 500,
                publicMessage: 'Temporary server error',
                cause: err,
            }),
        );
    }
};
