# Netkuki

Netkuki is a personal corner of the internet for things made, things learned, and ideas worth sharing. It is built with Astro and Tailwind CSS, with custom CSS for the site’s visual design.

## Getting started

You’ll need Node.js 20 or later and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Astro (usually `http://localhost:4321`). The development server reloads when you edit files.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run build` | Build the site into `dist/`. |
| `npm run preview` | Preview the production build locally. Run `npm run build` first. |
| `npm run astro -- --help` | Show Astro CLI options. |

## Pages

- `/` — Home page and introduction to the site.
- `/blog` — Writing page.
- `/about` — About Netkuki and the tools behind it.

## Project structure

```text
src/
  content/      Markdown content
  layouts/      Shared page header, footer, and layout
  pages/        Astro routes
  styles/       Global styles
public/         Static files served as-is
```

The home page illustration is drawn with CSS. Shared page styling lives in `src/styles/global.css`.

## Writing posts

Copy `src/content/blog/_template.md` to a new `.md` file anywhere under `src/content/blog/`. Its path becomes its URL, so `src/content/blog/my-first-note.md` is published at `/blog/my-first-note/`. Posts appear on `/blog` automatically after the development server refreshes or the site is rebuilt.

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

The repository includes a GitHub Actions workflow at `.github/workflows/astro.yml` that builds and deploys the site to GitHub Pages when changes are pushed to `main`. `wrangler.jsonc` also configures the generated `dist/` directory as Cloudflare static assets.
