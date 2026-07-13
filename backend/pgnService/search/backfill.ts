// One-off backfill of the games search index. Scans the games table and
// feeds the items through the same handler as the DynamoDB stream, so it
// is idempotent and safe to re-run.
//
// Usage (requires AWS credentials for the target stage):
//   stage=dev gameSearchEndpoint=https://<domain-endpoint> npx tsx pgnService/search/backfill.ts

import { AttributeValue, DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { Context, DynamoDBStreamEvent } from 'aws-lambda';
import { gamesIndex, getClient } from './client';
import { handler } from './indexGame';
import { createGamesIndex } from './mapping';

const dynamo = new DynamoDBClient({ region: 'us-east-1' });
const gamesTable = process.env.stage + '-games';

async function main() {
    await createGamesIndex(getClient(), gamesIndex());

    let processed = 0;
    let startKey: Record<string, AttributeValue> | undefined = undefined;

    try {
        do {
            const scanOutput = await dynamo.send(
                new ScanCommand({
                    ExclusiveStartKey: startKey,
                    TableName: gamesTable,
                    Limit: 250,
                }),
            );

            const records =
                scanOutput.Items?.map((item) => ({
                    dynamodb: { NewImage: item },
                })) ?? [];

            await handler(
                { Records: records } as DynamoDBStreamEvent,
                undefined as unknown as Context,
                () => null,
            );

            processed += records.length;
            startKey = scanOutput.LastEvaluatedKey;
            console.log('Processed: ', processed);

            // Throttle: the shared single-node domain also serves prod queries.
            await new Promise((resolve) => setTimeout(resolve, 250));
        } while (startKey);
    } catch (err) {
        console.error('Failed to scan games: ', err);
        console.error('Resume from start key: %j', startKey);
    }

    console.log('Done. Processed: ', processed);
}

void main();
