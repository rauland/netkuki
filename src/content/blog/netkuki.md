---
title: "Netkuki: a website on a cookie"
description: Why “kuki” sounds like cookie, and how a name became a homepage you can fly around.
pubDate: 2026-10-25
updatedDate: 2026-11-22
tags:
  - Design
  - Astro
  - Three.js
draft: false
---

Cookie was my nickname as a kid. “Kuki” is just “cookie” spelled the way it sounds. Put “net” in front and you get Netkuki, so of course the homepage is a cookie floating in space.

<figure class="post-diagram" aria-labelledby="netkuki-name-title">
  <figcaption><span class="diagram-label">THE NAME</span><strong id="netkuki-name-title">How the name adds up.</strong></figcaption>
  <div class="name-sum">
    <div><strong>net</strong><span>A place on the internet</span></div>
    <span class="name-operator" aria-hidden="true">+</span>
    <div><strong>kuki</strong><span>My childhood nickname, spelled as it sounds</span></div>
    <span class="name-operator" aria-hidden="true">=</span>
    <div class="name-result"><span class="name-cookie" aria-hidden="true"></span><strong>Netkuki</strong><span>A website on a cookie</span></div>
  </div>
</figure>

The cookie turns slowly: baked brown by day, and pale as a moon against the stars at night. “Notes” is printed on one side and “About” on the other. Pick one and the camera flies down to the surface, where a sign springs up out of the dough.

## HTML in a 3D scene

Three.js draws the cookie, the chocolate chips, the lighting, and the camera. The signs are plain HTML, placed in the same scene with Three.js’s CSS3D renderer.

That matters on a site that’s mostly words. Links work like links, you can select the text, and everything takes keyboard focus. The camera flies around, but the browser is still rendering ordinary, crisp text.

There’s a catch: HTML always draws on top of the 3D canvas, so it can’t hide behind the cookie. A sign seen mid-flight would show straight through the dough. So each sign waits, out of sight, until you’ve landed in front of it. The words on the dough work the other way round. They’re painted into the 3D scene, where the cookie can hide them, with an invisible HTML button over each one so they’re still real links.

## Made from simple shapes

There are no 3D model files. Everything is built in code from simple Three.js shapes. The chips are squashed spheres, and by day a donut and a macaron orbit the cookie. A server rack with blinking lights stands beside the Notes sign, and a rocket beside About.

They do more than decorate. Open a note and you fly into the server rack. Head to About and the rocket blasts off, and you follow it up. A trail of boot prints also winds between the chips from one side to the other, a hint that there’s more round the back. If your device is set to reduce motion, the flights and animations are skipped.

## Something hidden in the chocolate

If you’re going to turn a cookie over, there should be something to find.

<details>
  <summary>A hint for the curious</summary>
  <p>Five of the chocolate chips twinkle now and then: two on the front and three round the back. Tap all five and see what happens.</p>
</details>

## Under the cookie

Netkuki is an Astro site, with posts written in Markdown. I use it to share what I build and learn, and to keep experimenting. Some days that’s infrastructure for another project. Other days it’s making a chocolate chip turn a cookie rainbow.

You can [go play with the cookie](/), [read about the infrastructure project](/notes/iac/), or look through the [source on GitHub](https://github.com/rauland/netkuki).
