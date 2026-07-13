'use strict';

import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBRecord, DynamoDBStreamHandler } from 'aws-lambda';
import { Game } from '../game/types';
import { gamesIndex, getClient, isSearchEnabled } from './client';
import { buildSearchDocument, documentId } from './document';

/**
 * Converts DynamoDB stream records for the games table into an OpenSearch
 * _bulk request body. Listed games are upserted; unlisted, system-owned and
 * removed games are deleted.
 */
export function recordsToBulkOperations(records: DynamoDBRecord[]): object[] {
    const operations: object[] = [];

    for (const record of records) {
        const newGame = record.dynamodb?.NewImage
            ? (unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>) as Game)
            : undefined;
        const oldGame = record.dynamodb?.OldImage
            ? (unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>) as Game)
            : undefined;

        const game = newGame || oldGame;
        if (!game) {
            continue;
        }

        const document = newGame ? buildSearchDocument(newGame) : undefined;
        if (document) {
            operations.push({
                index: { _index: gamesIndex(), _id: documentId(game) },
            });
            operations.push(document);
        } else {
            operations.push({
                delete: { _index: gamesIndex(), _id: documentId(game) },
            });
        }
    }

    return operations;
}

/**
 * Keeps the games search index in sync with the games table. Throws on
 * bulk failures so the stream batch is retried (all operations are
 * idempotent upserts/deletes).
 */
export const handler: DynamoDBStreamHandler = async (event) => {
    if (!isSearchEnabled()) {
        // Simple deployments have no search domain.
        return;
    }

    const operations = recordsToBulkOperations(event.Records);
    if (operations.length === 0) {
        return;
    }

    const response = await getClient().bulk({ body: operations });
    if (response.body.errors) {
        const failures = response.body.items.filter(
            (item: Record<string, { error?: object; result?: string }>) => {
                const result = item.index || item.delete;
                return result?.error && result?.result !== 'not_found';
            },
        );
        if (failures.length > 0) {
            console.error('Bulk indexing failures: %j', failures);
            throw new Error(`Failed to index ${failures.length} games`);
        }
    }
    console.log(`Applied ${operations.length} bulk operations`);
};
