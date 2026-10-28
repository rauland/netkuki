import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedPosts } from "../lib/posts";

export async function GET(context: APIContext) {
	const posts = await getPublishedPosts();
	return rss({
		title: "Netkuki — Writing",
		description: "Notes from rauland on the things I build and learn.",
		site: context.site!,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			categories: post.data.tags,
			link: `/writing/${post.id}/`,
		})),
		customData: "<language>en-au</language>",
	});
}
