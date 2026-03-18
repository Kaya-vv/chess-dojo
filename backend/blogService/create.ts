'use strict';

import {
    ConditionalCheckFailedException,
    PutItemCommand,
    UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
    Blog,
    BlogStatuses,
    CreateBlogRequest,
    createBlogRequestSchema,
    DOJO_BLOG_OWNER,
} from '@jackstenglein/chess-dojo-common/src/blog/api';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
    ApiError,
    errToApiGatewayProxyResultV2,
    parseBody,
    requireUserInfo,
    success,
} from '../directoryService/api';
import { blogTable, dynamo, getUser } from './database';
import { sendBlogPublishedEvent } from './notification';

/**
 * Handles requests to create a blog post. The caller must be an admin.
 * Creates a new blog with the given URL slug as id and owner chessdojo.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    try {
        console.log('Event: %j', event);

        const userInfo = requireUserInfo(event);
        const user = await getUser(userInfo.username);
        if (!user.isAdmin) {
            throw new ApiError({
                statusCode: 403,
                publicMessage: 'You must be an admin to create a blog post',
            });
        }

        const request = parseBody(event, createBlogRequestSchema);
        const blog = await createBlog(request);
        return success(blog);
    } catch (err) {
        return errToApiGatewayProxyResultV2(err);
    }
};

/**
 * Creates a new blog post in DynamoDB.
 * Uses the request id (URL slug) as the blog id. Fails if a blog with that id already exists.
 * @param request The create request body.
 * @returns The created blog.
 */
async function createBlog(request: CreateBlogRequest): Promise<Blog> {
    const id = request.id.trim();
    const updatedAt = new Date().toISOString();
    const status = request.status ?? BlogStatuses.DRAFT;

    const blog: Blog = {
        owner: DOJO_BLOG_OWNER,
        id,
        title: request.title,
        subtitle: request.subtitle,
        description: request.description,
        coverImage: request.coverImage,
        date: request.date,
        content: request.content,
        createdAt: updatedAt,
        updatedAt,
        status,
    };

    try {
        await dynamo.send(
            new PutItemCommand({
                TableName: blogTable,
                Item: marshall(blog, { removeUndefinedValues: true }),
                ConditionExpression: 'attribute_not_exists(#owner)',
                ExpressionAttributeNames: { '#owner': 'owner' },
            }),
        );
    } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
            throw new ApiError({
                statusCode: 400,
                publicMessage: `A blog with URL slug "${id}" already exists. Choose a different slug.`,
                cause: err,
            });
        }
        throw new ApiError({ statusCode: 500, publicMessage: 'Internal server error', cause: err });
    }

    if (status === BlogStatuses.PUBLISHED) {
        try {
            await sendBlogPublishedEventIfFirst(blog);
        } catch (err) {
            console.error('Failed to send blog published event for %s:', blog.id, err);
        }
    }

    return blog;
}

/**
 * Sends a BLOG_PUBLISHED SQS event if this is the first time the blog is published.
 * Uses a DynamoDB conditional update to set discordPosted=true only if it was not already set.
 * If the conditional check fails, the event is skipped.
 * @param blog The blog that was just created.
 */
async function sendBlogPublishedEventIfFirst(blog: Blog): Promise<void> {
    try {
        await dynamo.send(
            new UpdateItemCommand({
                TableName: blogTable,
                Key: {
                    owner: { S: DOJO_BLOG_OWNER },
                    id: { S: blog.id },
                },
                UpdateExpression: 'SET discordPosted = :true',
                ConditionExpression:
                    'attribute_not_exists(discordPosted) OR discordPosted = :false',
                ExpressionAttributeValues: {
                    ':true': { BOOL: true },
                    ':false': { BOOL: false },
                },
            }),
        );
    } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
            console.log('Blog %s already posted to Discord, skipping', blog.id);
            return;
        }
        throw err;
    }

    await sendBlogPublishedEvent(blog);
}
