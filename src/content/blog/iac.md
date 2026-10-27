---
title: Building a self-hosted platform with infrastructure as code
description: How I’m making a home server platform easier to build, change, and look after.
pubDate: 2026-10-15
updatedDate: 2026-10-25
tags:
  - Infrastructure
  - Terraform
  - Proxmox
draft: false
---

Running services at home is a good way to learn. It also leaves you with machines to set up, settings to remember, and changes to keep track of.

[Platform Automation](https://github.com/rauland/iac) is my project to make that work more repeatable. I describe how the platform should be built in files, then use automation to create and configure it. That’s the idea behind infrastructure as code.

The useful part is having a record of the setup. When I need another machine, or want to change an existing one, I can start from what’s already written down.

## How the pieces fit together

Proxmox provides the home for the virtual machines. Terraform creates those machines from their definitions, and Ansible sets up the software and settings on the service machines. GitHub Actions runs the automation when changes are ready.

The Kubernetes side now uses Talos Linux. Kubernetes manages applications running in containers, while Talos provides the operating system for those machines. It has its own setup process, separate from the services Ansible looks after.

<figure class="post-diagram" aria-labelledby="iac-architecture-title">
  <figcaption><span class="diagram-label">THE BIG PICTURE</span><strong id="iac-architecture-title">From written instructions to running services.</strong></figcaption>
  <div class="diagram-source"><span class="diagram-kicker">THE STARTING POINT</span><strong>Configuration in GitHub</strong><span>What to build, and how to set it up</span></div>
  <div class="diagram-connection"><span aria-hidden="true">↓</span> Automation follows those instructions</div>
  <div class="diagram-platform">
    <div class="diagram-platform-label"><strong>Proxmox</strong><span>Runs the virtual machines in the homelab</span></div>
    <div class="diagram-lanes">
      <div class="diagram-lane">
        <span class="diagram-kicker">EVERYDAY SERVICES</span>
        <strong class="diagram-machine">Service machines</strong>
        <div class="diagram-connection"><span aria-hidden="true">↓</span> Set up with Ansible</div>
        <div class="diagram-outcome"><strong>Web server + Vault</strong><span>A place to test services and work on secrets management</span></div>
      </div>
      <div class="diagram-lane">
        <span class="diagram-kicker">CONTAINER APPLICATIONS</span>
        <strong class="diagram-machine">Talos Linux</strong>
        <div class="diagram-connection"><span aria-hidden="true">↓</span> Runs Kubernetes</div>
        <div class="diagram-outcome"><strong>Kubernetes cluster</strong><span>A group of machines for running container applications</span></div>
      </div>
    </div>
  </div>
  <p class="diagram-caption">Terraform creates the machines. Each side then follows its own configuration path.</p>
</figure>

## Making changes easier to follow

A change starts in the repository. Automated checks look for problems, and a preview shows what an infrastructure change would do before it is applied.

Development changes can deploy automatically after they reach the main branch. Production changes require approval. This gives me room to experiment while keeping a deliberate review step for production.

<figure class="post-diagram" aria-labelledby="iac-delivery-title">
  <figcaption><span class="diagram-label">MAKING A CHANGE</span><strong id="iac-delivery-title">A repeatable path from idea to update.</strong></figcaption>
  <ol class="diagram-steps">
    <li><span class="diagram-step-number" aria-hidden="true">01</span><div><strong>Describe the change</strong><span>Update the files that define the platform.</span></div></li>
    <li><span class="diagram-step-number" aria-hidden="true">02</span><div><strong>Check and preview</strong><span>Look for problems and see what would change.</span></div></li>
    <li><span class="diagram-step-number" aria-hidden="true">03</span><div><strong>Review</strong><span>Bring the change into the main branch, with deployment approval where required.</span></div></li>
    <li><span class="diagram-step-number" aria-hidden="true">04</span><div><strong>Let automation do the work</strong><span>Create or update machines and configure the affected services.</span></div></li>
  </ol>
  <p class="diagram-caption">Service settings can be updated without rebuilding the machine.</p>
</figure>

The automation also chooses the work that’s needed. Changing a service’s settings can update that service without rebuilding its machine. Editing documentation runs checks without deploying anything.

## Keeping the connection private

The automation runs on GitHub, but the servers live on my private network. WireGuard provides a private connection between them, so I don’t have to make the server management interface publicly accessible.

That connection lets the project use GitHub’s automation while keeping management access inside the homelab network.

## Still a work in progress

The project now covers creating machines, configuring services, and setting up a Talos Kubernetes cluster. There’s more to build, including workload backups and more automation for deploying applications.

For me, the value is being able to return to the project and understand how it fits together. The configuration records the setup, the change history records how it evolved, and the automation helps me repeat the work.

The [iac repository](https://github.com/rauland/iac) has the configuration, setup guides, and technical details if you’d like to explore further.
