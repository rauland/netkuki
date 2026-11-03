---
title: Building a self-hosted platform with infrastructure as code
description: How I’m making a home server platform easier to build, change, and look after.
pubDate: 2026-10-15
updatedDate: 2026-11-04
tags:
  - Infrastructure
  - Terraform
  - Proxmox
  - Kubernetes
draft: false
---

Running services at home is a good way to learn. It also leaves you with machines to set up, settings to remember, and changes to keep track of.

[Platform Automation](https://github.com/rauland/iac) is my project to make that work more repeatable. I describe how the platform should be built in files, then use automation to create and configure it. That’s the idea behind infrastructure as code.

The useful part is having a record of the setup. When I need another machine, or want to change an existing one, I can start from what’s already written down.

The project has changed direction since I first wrote this. The general-purpose service machines, Ansible, and Vault are gone. Everything now runs on Kubernetes.

## How the pieces fit together

Proxmox provides the home for the virtual machines, and the only ones left are Kubernetes nodes. Kubernetes manages applications running in containers, while Talos Linux provides the operating system for those machines. Terraform creates the machines and sets up the clusters, and GitHub Actions runs it when changes are ready.

There are now two clusters. New apps get tried on dev before they’re added to prod.

Once a cluster exists, Flux takes over what runs on it. Flux lives inside each cluster, watches GitHub, and applies whatever has been merged. The platform stays in the public repository, while the apps I run at home live in a private one.

<figure class="post-diagram" aria-labelledby="iac-architecture-title">
  <figcaption><span class="diagram-label">THE BIG PICTURE</span><strong id="iac-architecture-title">Terraform pushes. Flux pulls.</strong></figcaption>
  <div class="diagram-zone"><strong>GitHub</strong><span>The platform in a public repository, my apps in a private one</span></div>
  <div class="diagram-links">
    <div class="diagram-link"><span class="diagram-arrow" aria-hidden="true"></span><div><strong>Terraform</strong> builds the clusters, run by GitHub Actions over Tailscale</div></div>
    <div class="diagram-link"><span class="diagram-arrow is-up" aria-hidden="true"></span><div><strong>Flux</strong> runs inside each cluster and pulls what has been merged</div></div>
  </div>
  <div class="diagram-zone">
    <strong>Homelab</strong>
    <span>Proxmox runs the Talos virtual machines</span>
    <div class="diagram-nodes">
      <div class="diagram-node"><strong>Dev cluster</strong><span>Where new apps get tried first.</span><span>Infrastructure deploys automatically.</span></div>
      <div class="diagram-node"><strong>Prod cluster</strong><span>Apps that have been tried on dev, plus monitoring and alerts.</span><span>Infrastructure deploys after approval.</span></div>
    </div>
  </div>
  <div class="diagram-link"><span class="diagram-arrow" aria-hidden="true"></span><div><strong>VolSync</strong> sends encrypted copies of the volumes I choose</div></div>
  <div class="diagram-zone"><strong>Amazon S3</strong><span>Off-site backups</span></div>
  <p class="diagram-caption">Arrows point from the side that starts the connection.</p>
</figure>

## Why the service machines went away

The platform started with ordinary virtual machines that Ansible configured over SSH. That meant keeping SSH keys and root access around, and rebuilding a machine meant replaying its configuration.

The Talos cluster showed a simpler way to work. Nodes are configured through an API, apps are declared in Git, and data is handled one volume at a time. So I made Kubernetes the default and removed the rest.

Now no automation logs in to a host. A rebuild comes from three places: the cluster from Terraform, the apps from Git, and the data from backups.

There’s a trade-off. Anything that can’t run on Kubernetes now needs its own exception, and a written reason for it.

## Making changes easier to follow

A change starts in a pull request. Automated checks look for problems, and a preview shows what an infrastructure change would do before it is applied.

From there, the path depends on what changed. Infrastructure changes deploy automatically to dev once they reach the main branch, while production requires approval. App changes don’t go through that pipeline at all, because Flux picks them up from the main branch about a minute after they merge. Editing documentation runs checks without deploying anything.

<figure class="post-diagram" aria-labelledby="iac-delivery-title">
  <figcaption><span class="diagram-label">MAKING A CHANGE</span><strong id="iac-delivery-title">One way in, three ways out.</strong></figcaption>
  <ol class="diagram-path">
    <li><span class="diagram-path-number" aria-hidden="true">1</span><strong>Pull request</strong><span>Describe the change in files.</span></li>
    <li><span class="diagram-path-number" aria-hidden="true">2</span><strong>Check and preview</strong><span>Look for problems and see what would change.</span></li>
    <li><span class="diagram-path-number" aria-hidden="true">3</span><strong>Merge</strong><span>Bring it into the main branch.</span></li>
  </ol>
  <dl class="diagram-routes">
    <div><dt>Infrastructure</dt><dd>Terraform updates dev automatically. Prod waits for my approval.</dd></div>
    <div><dt>Apps</dt><dd>Flux picks them up in about a minute.</dd></div>
    <div><dt>Documentation</dt><dd>Checks only. Nothing deploys.</dd></div>
  </dl>
  <p class="diagram-caption">Renovate starts at step one too, by proposing new versions each week.</p>
</figure>

Renovate takes care of the chore of noticing updates. It proposes new versions of container images, Helm charts, Terraform providers, GitHub Actions, Talos, Kubernetes, and Flux. Nothing merges on its own, and major versions wait for my approval. A separate manual workflow upgrades Talos one node at a time, moving workloads off each worker first.

## Keeping the connection private

The automation runs on GitHub, but the servers live on my private network. Tailscale now provides the connection between them, replacing WireGuard. Each run joins my private network as a temporary device, so I don’t have to make the server management interface publicly accessible.

The bigger change is how that automation proves who it is. GitHub issues each run a short-lived identity token, which it uses to join Tailscale and to take on a limited role in AWS. There are no AWS access keys to look after, and the workflows don’t use GitHub secrets. The secrets they do need live in AWS Parameter Store. Kubernetes secrets are stored encrypted in the repository with SOPS, for Flux to decrypt inside the cluster.

## Looking after the data

The nodes can be rebuilt from Git, but the data on them can’t. Apps store it on persistent volumes, which the Proxmox CSI plugin provides and which are encrypted with LUKS on the nodes.

VolSync copies the volumes I choose to Amazon S3. It uses restic, which encrypts the data before upload and only sends what changed since the last run. The clusters reach S3 with the same kind of short-lived identity as the automation, so they hold no AWS keys either.

Backing up one volume at a time also means deciding what’s worth keeping. Files I can’t replace and settings get backed up. Caches and media I can download again don’t.

## What the clusters provide

Each cluster has the same shared services, so a new app has less to set up. MetalLB and Traefik make apps reachable on my home network, and cert-manager gets wildcard certificates from Let’s Encrypt.

Prod has a little more. Prometheus and Grafana collect and show metrics, with alerts sent through ntfy. One worker also has an NVIDIA GPU passed through from Proxmox, ready for apps that need it.

## Still a work in progress

The project now covers building the clusters, running apps on them, backing up their data, and keeping it all up to date. There’s more to build. Monitoring doesn’t yet cover missed backups, the Proxmox host, or the dev cluster, and IP addresses are still set by hand or through DHCP.

For me, the value is being able to return to the project and understand how it fits together. The configuration records the setup, the change history records how it evolved, and the automation helps me repeat the work. That history now includes removing a large part of what I first built.

The [iac repository](https://github.com/rauland/iac) has the configuration, setup guides, and technical details if you’d like to explore further.
