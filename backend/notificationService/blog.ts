'use strict';

import { EmbedBuilder } from 'discord.js';
import { BlogPublishedEvent } from '@jackstenglein/chess-dojo-common/src/database/notification';
import { sendChannelEmbed } from './discord';

const blogChannelId = process.env.discordBlogChannelId ?? '';
const frontendHost = process.env.frontendHost;

/**
 * Handles a BLOG_PUBLISHED notification event by posting a Discord embed
 * to the configured blog channel.
 * @param event The blog published event.
 */
export async function handleBlogPublished(event: BlogPublishedEvent): Promise<void> {
    const embed = new EmbedBuilder()
        .setTitle(event.title)
        .setDescription(event.description)
        .setURL(`${frontendHost}/blog/${event.blogId}`)
        .setColor(0xf7941f); // Dojo branding orange

    if (event.coverImage) {
        embed.setImage(event.coverImage);
    }

    await sendChannelEmbed(blogChannelId, { embeds: [embed] });
}
