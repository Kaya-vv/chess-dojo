import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
    GetMateInOnePuzzleResponse,
    MateInOneSessionResult,
    SubmitMateInOneSessionResponse,
    submitMateInOneSessionSchema,
} from '@jackstenglein/chess-dojo-common/src/mateInOne/api';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { MongoClient, ServerApiVersion } from 'mongodb';
import {
    errToApiGatewayProxyResultV2,
    parseBody,
    requireUserInfo,
    success,
} from '../directoryService/api';
import { dynamo } from '../directoryService/database';

const mateInOneResultsTable = `${process.env.stage}-mate-in-one-results`;

const mongoClient = new MongoClient(process.env.MONGODB_URI ?? '', {
    auth: {
        username: process.env.AWS_ACCESS_KEY_ID,
        password: process.env.AWS_SECRET_ACCESS_KEY,
    },
    authSource: '$external',
    authMechanism: 'MONGODB-AWS',
    authMechanismProperties: {
        AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
    },
    maxIdleTimeMS: 60000,
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

/**
 * Handles GET /puzzle/mate-in-one/next.
 * Fetches a random mate-in-one puzzle in the 800-1200 rating band from MongoDB.
 * Requires a valid JWT but does not read or write any DynamoDB user data.
 *
 * @param event - The API Gateway proxy event.
 * @returns A response containing the next puzzle.
 */
export const getNextPuzzleHandler: APIGatewayProxyHandlerV2 = async (event) => {
    try {
        console.log('Event: %j', event);
        requireUserInfo(event);

        const cursor = mongoClient
            .db('puzzles')
            .collection('puzzles')
            .aggregate([
                {
                    $match: {
                        themes: { $in: ['mateIn1'] },
                        rating: { $gte: 800, $lte: 1200 },
                    },
                },
                { $sample: { size: 1 } },
            ]);

        const document = await cursor.next();
        const response: GetMateInOnePuzzleResponse = {
            puzzle: {
                id: document?._id as string,
                fen: document?.fen ?? '',
                moves: document?.moves ?? [],
            },
        };

        return success(response);
    } catch (err) {
        return errToApiGatewayProxyResultV2(err);
    }
};

/**
 * Handles POST /puzzle/mate-in-one/session.
 * Validates and persists a mate-in-one drill session result to DynamoDB.
 *
 * @param event - The API Gateway proxy event.
 * @returns An empty response on success.
 */
export const submitSessionHandler: APIGatewayProxyHandlerV2 = async (event) => {
    try {
        console.log('Event: %j', event);
        const userInfo = requireUserInfo(event);
        const request = parseBody(event, submitMateInOneSessionSchema);

        const result: MateInOneSessionResult = {
            ...request,
            username: userInfo.username,
            createdAt: request.createdAt ?? new Date().toISOString(),
        };

        await dynamo.send(
            new PutItemCommand({
                TableName: mateInOneResultsTable,
                Item: marshall(result, { removeUndefinedValues: true }),
            }),
        );

        const response: SubmitMateInOneSessionResponse = {};
        return success(response);
    } catch (err) {
        return errToApiGatewayProxyResultV2(err);
    }
};
