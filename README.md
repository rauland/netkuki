# Netkuki

Netkuki is a personal corner of the internet for things made, things learned, and ideas worth sharing. It is built with Astro and Tailwind CSS, with custom CSS for the site’s visual design.

## Getting started

Use Node.js 24 LTS (as specified in `.nvmrc`) and npm 9.6.5 or later. Astro requires at least Node.js 22.23.4; older Node 22 releases and Node 20 are not supported.

```sh
npm ci
npm run dev
```

Open the local URL printed by Astro (usually `http://localhost:4321`). The development server reloads when you edit files.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run check` | Check TypeScript configuration and Astro source files. |
| `npm run build` | Build the site into `dist/`. |
| `npm run preview` | Preview the production build locally. Run `npm run build` first. |
| `npm run astro -- --help` | Show Astro CLI options. |

## Pages

- `/` — Home page and introduction to the site.
- `/writing` — Writing page, with articles at `/writing/<slug>/` and tag pages at `/writing/tags/<tag>/`.
- `/about` — About Netkuki and the tools behind it.
- `/rss.xml` — RSS feed of published writing. A sitemap is generated at `/sitemap-index.xml`.
- `404` — Not-found page, served by Cloudflare for unknown routes.

## Project structure

```text
src/
  content/      Markdown content
  layouts/      Shared page header, footer, and layout
  pages/        Astro routes
  styles/       Global styles
public/         Static files served as-is
```

The home page features an interactive Three.js cookie moon, built from procedural geometry and textures in `src/scripts/cookie-moon.ts` and mounted by `src/components/CookieMoon.astro`. Drag to rotate, scroll or pinch to zoom, or use the on-screen controls. The focused canvas also supports arrow keys, plus/minus, R to reset, and Space to pause. Automatic rotation respects reduced-motion preferences. Shared page styling lives in `src/styles/global.css`. Tailwind CSS 4 runs through its Vite plugin and discovers source files automatically, so no Tailwind JavaScript config is needed.

The npm override for Miniflare’s `undici` dependency selects a patched 7.x release until Wrangler includes it upstream.

## Writing posts

Copy `src/content/blog/_template.md` to a new `.md` file anywhere under `src/content/blog/`. Its path becomes its URL, so `src/content/blog/my-first-note.md` is published at `/writing/my-first-note/`. Published posts appear on `/writing` after the development server refreshes or the site is rebuilt. Previous `/blog` URLs redirect to their `/writing` equivalents; Astro supplies development and static HTML redirects, and `public/_redirects` supplies permanent redirects on Cloudflare.

Each post needs a title and publication date. Description and tags are optional; set `draft: true` to keep a post out of the listing and generated pages. The `_template.md` file is a draft and is not published.

```md
---
title: My first note
description: A short introduction to the post.
pubDate: 2026-10-15
tags:
  - Notes
  - Web
draft: false
---

Write the post here using **Markdown**.
```

## Deployment

All routes, including blog posts, are generated as static HTML in `dist/`. Cloudflare can serve this directory directly; the Astro Cloudflare adapter is only needed if the site adds on-demand server rendering or other server features.

`wrangler.jsonc` configures `dist/` as Cloudflare static assets. Set the Cloudflare build environment to Node.js 24, the build command to `npm run build`, and the output directory to `dist`. The GitHub Actions workflow at `.github/workflows/astro.yml` checks types and builds the site on pushes to `main` and on pull requests; publishing is handled by Cloudflare. The workflow uses the Node.js version from `.nvmrc`.
