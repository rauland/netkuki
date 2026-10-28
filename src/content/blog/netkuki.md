---
title: "Netkuki: a website on a cookie"
description: Why “kuki” sounds like cookie, and how a name became a homepage you can fly around.
pubDate: 2026-10-25
tags:
  - Design
  - Astro
  - Three.js
draft: false
---

Kuki is a phonetic spelling of cookie. Put “net” in front of it, and you get Netkuki: a place on the internet with a cookie at its centre.

That gives the name something to do. On the homepage, the cookie floats in space, turns slowly, and carries the places you can visit. Notes live on one side. About lives on the other. Choose a destination and the camera flies you there.

<figure class="post-diagram name-diagram" aria-labelledby="netkuki-name-title">
  <figcaption><span class="diagram-label">THE NAME</span><strong id="netkuki-name-title">Net + kuki</strong></figcaption>
  <div class="name-equation"><div><strong>net</strong><span>A place on the internet</span></div><span aria-hidden="true">+</span><div><strong>kuki</strong><span>Cookie, written as it sounds</span></div></div>
  <p class="diagram-caption">Together: Netkuki. The cookie became the homepage.</p>
</figure>

## A cookie you can visit

The cookie gives the site a physical layout. The notes area is a notebook on its surface, with links to posts. The back introduces me and the things I work with. You can fly between the two, return to the whole cookie, or drag it around to look at it yourself.

Those camera movements help connect the views. Going to About feels like travelling to the other side of the same object. Opening a post zooms towards the selected link before taking you to the article.

The articles themselves have room to read and scroll. The header also keeps Home, Notes, and About within reach, so you can move around directly whenever you want.

## The surface is real text

The homepage uses Three.js for the cookie, chocolate chips, lighting, and camera. The buttons and writing on its surface are HTML, positioned in the same 3D scene.

That matters for a site built around words. The links behave like links, the text can be selected, and the buttons can receive keyboard focus. The camera moves around the content while the browser continues to render the words.

Getting that balance right took some adjustment. Text on a moving surface can look soft, and a detailed cookie texture can compete with the words. The surface content renders at a larger size before being scaled into the scene. As you fly into a reading area, the fine texture softens and nearby chips fade away. Flying back restores the detail.

## Cookie by day, moon by night

Day mode gives the cookie a baked brown surface and dark chocolate chips. The back is a lighter golden brown to help the About text stand out.

At night, it takes on a pale, moon-like appearance against a field of stars. The shape stays familiar, but the surroundings give it a different mood.

The floating buttons have a glass-like finish, with a clearer highlight on hover. They need to be easy to spot against the changing background, and still readable while the cookie turns.

Motion has controls too. You can pause the rotation, reset the view, and press Escape to fly back from a surface. The site also responds to reduced-motion preferences.

## Something tucked into the chocolate

A cookie that you can turn over deserves a surprise.

<details>
  <summary>A hint for the curious</summary>
  <p>On the About side, try the larger chocolate chip halfway down the right edge. It sends a moving rainbow across the cookie for ten seconds, then the usual colours return.</p>
</details>

## Still taking shape

Underneath the cookie, Netkuki is an Astro site. Posts are written in Markdown, and the 3D homepage sits alongside straightforward writing and profile pages.

It’s a place to share things I build and learn, and a project to keep experimenting with. Sometimes that means working on the infrastructure behind another project. Sometimes it means making a chocolate chip turn a cookie rainbow.

You can [explore the cookie](/), [read about the infrastructure project](/notes/iac/), or look through the [Netkuki source on GitHub](https://github.com/rauland/netkuki).
