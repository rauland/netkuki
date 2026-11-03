---
title: "Netkuki: a website on a cookie"
description: Why “kuki” sounds like cookie, and how a name became a homepage you can fly around.
pubDate: 2026-10-25
updatedDate: 2026-11-04
tags:
  - Design
  - Astro
  - Three.js
draft: false
---

“Kuki” is just “cookie” spelled the way it sounds. Put “net” in front and you get Netkuki, so of course the homepage is a cookie floating in space.

<figure class="post-diagram" aria-labelledby="netkuki-name-title">
  <figcaption><span class="diagram-label">THE NAME</span><strong id="netkuki-name-title">How the name adds up.</strong></figcaption>
  <div class="name-sum">
    <div><strong>net</strong><span>A place on the internet</span></div>
    <span class="name-operator" aria-hidden="true">+</span>
    <div><strong>kuki</strong><span>Cookie, spelled as it sounds</span></div>
    <span class="name-operator" aria-hidden="true">=</span>
    <div class="name-result"><span class="name-cookie" aria-hidden="true"></span><strong>Netkuki</strong><span>A website on a cookie</span></div>
  </div>
</figure>

The cookie turns slowly, and you can fly around it. Notes are on one side and About is on the other. Pick one and the camera takes you there.

## A cookie you can visit

The notes area is a notebook on the cookie’s surface, with links to posts. The back has a short intro to me and the things I work with. You can fly between the two, pull back to see the whole cookie, or just drag it around.

The camera moves make it all feel like one place. Going to About takes you round to the other side of the same cookie, and opening a post zooms in on its link before the article loads.

Articles are normal pages that you can read and scroll. Home, Notes, and About stay in the header if you’d rather skip the flying.

## The writing is real text

Three.js draws the cookie, the chocolate chips, the lighting, and the camera. The buttons and writing on the surface are plain HTML, placed in the same 3D scene.

That’s important on a site that’s mostly words. Links work like links, you can select the text, and buttons take keyboard focus. The camera moves around, but the browser is still rendering ordinary text.

It took some fiddling to get it looking right. Text on a moving surface can go soft, and a detailed cookie texture fights with the words. So the surface content renders larger than it needs to and gets scaled down into the scene. When you fly into a reading area, the fine texture softens and the nearby chips fade out. Fly back and it all returns.

## Cookie by day, moon by night

By day, it’s a baked brown cookie with dark chocolate chips. The back is a lighter golden brown so the About text stands out.

At night, it turns pale like a moon, with a field of stars behind it.

The floating buttons look like glass and brighten when you hover over them. They have to stay easy to spot and read while the cookie turns and the background changes.

You can also pause the rotation, reset the view, or press Escape to fly back from a surface. If your device is set to reduce motion, the site follows that too.

## Something hidden in the chocolate

If you’re going to turn a cookie over, there should be something to find.

<details>
  <summary>A hint for the curious</summary>
  <p>Fly to the About side and tap the chocolate chips around the outside of the cookie. One of them turns the whole cookie rainbow for ten seconds.</p>
</details>

## Under the cookie

Netkuki is an Astro site. Posts are written in Markdown, and the writing and profile pages are ordinary pages sitting next to the 3D homepage.

I use it to share what I build and learn, and to keep experimenting. Some days that’s infrastructure for another project. Other days it’s making a chocolate chip turn a cookie rainbow.

You can [go play with the cookie](/), [read about the infrastructure project](/notes/iac/), or look through the [source on GitHub](https://github.com/rauland/netkuki).
