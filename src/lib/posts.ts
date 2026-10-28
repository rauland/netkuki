import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"blog">;

/** Published posts, newest first. */
export async function getPublishedPosts(): Promise<Post[]> {
	const posts = await getCollection("blog", ({ data }) => !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * URL-safe slug for a tag, e.g. "Three.js" -> "three-js", "C++" -> "c-plus-plus".
 * Returns "" for a tag with no usable characters; such tags get no page.
 */
export function tagSlug(tag: string): string {
	return tag
		.toLowerCase()
		.replace(/\+/g, "-plus-")
		.replace(/#/g, "-sharp-")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export interface TagGroup {
	slug: string;
	/** Display name: the first spelling seen, so "AWS" and "aws" share one page. */
	tag: string;
	posts: Post[];
}

/** Posts grouped by tag slug, sorted by tag name. Each post appears once per slug. */
export function groupByTag(posts: Post[]): TagGroup[] {
	const groups = new Map<string, TagGroup>();
	for (const post of posts) {
		for (const tag of post.data.tags) {
			const slug = tagSlug(tag);
			if (!slug) continue;
			const group = groups.get(slug) ?? { slug, tag, posts: [] };
			if (!group.posts.includes(post)) group.posts.push(post);
			groups.set(slug, group);
		}
	}
	return [...groups.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Estimated reading time in whole minutes, ignoring markup. */
export function readingMinutes(body: string | undefined): number {
	const text = (body ?? "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/<[^>]+>/g, " ")
		// Keep link and image text, drop their URLs.
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[#>*_`|]/g, " ");
	// Count only tokens with a letter or digit, so list markers and rules are ignored.
	const words = text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
	return Math.max(1, Math.round(words / 220));
}

export function formatDate(date: Date, month: "short" | "long" = "short"): string {
	return date.toLocaleDateString("en-AU", { year: "numeric", month, day: "numeric" });
}
