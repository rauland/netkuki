---
title: Building a self-hosted platform with infrastructure as code
description: A look inside my Proxmox automation project, from Terraform plans to Ansible-managed virtual machines.
pubDate: 2026-10-15
tags:
  - Infrastructure
  - Terraform
  - Proxmox
draft: false
---

I’ve been working on a project to make my self-hosted platform easier to create, change, and rebuild. The repository is the definition of the platform: it brings together infrastructure provisioning, machine configuration, and the automation that connects them.

The project is called [Platform Automation](https://github.com/rauland/iac), and Proxmox is at its center.

## The path from a change to a running machine

The workflow starts with a change in GitHub. GitHub Actions runs the infrastructure pipeline, which asks Terraform to compare the desired configuration with the current state. Terraform provisions virtual machines on Proxmox, using an S3 backend for remote state and locking.

The pipeline separates planning from changes that affect infrastructure. A plan runs with read-only access so its proposed changes can be reviewed. The apply or destroy step receives write access only after approval. There are also workflows for bootstrapping the S3 state storage and unlocking Terraform state when needed.

That separation gives the infrastructure a useful paper trail: the configuration lives in Git, the plan shows what would change, and an approved workflow makes the change.

## Terraform builds the base; Ansible configures it

Terraform creates the virtual machines, but it doesn’t need to know every detail of how each machine should be configured. That work belongs to Ansible.

Ansible gets its inventory dynamically from the Proxmox API. Roles are selected using VM tags, so a machine tagged `managed` is included in the managed configuration. That makes the VM definition and its intended role visible together in the environment configuration.

The repository includes example definitions for k3s nodes, along with service and workload groupings. The supported machine configurations currently include AlmaLinux 10 and Ubuntu.

## Keeping the control path private

The automation needs to reach the Proxmox API, but I don’t want to expose that API publicly just to let a pipeline reach it. The project uses WireGuard for that connection, so the automation runner can reach Proxmox through the private network without requiring a runner inside the home environment.

That choice keeps the control plane tucked away while still allowing the platform to be managed from the repository’s workflows.

## The practical edge cases

Virtual machines are disposable and can be recreated, scaled, or destroyed. That flexibility means networking needs to be predictable: the project assumes DHCP with dynamic DNS, or static addresses that can be managed reliably.

There’s still work ahead. The repository lists more Ansible roles, SSH certificates, secrets management, linting, and GitOps as planned improvements. For now, the useful part is having a clear path from a reviewed change to a configured machine—and keeping the whole path versioned alongside the platform it describes.

You can explore the configuration, workflows, and environment examples in the [iac repository](https://github.com/rauland/iac).
