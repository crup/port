# Security Policy

## Supported Versions

Security fixes are applied to the latest development line on `main`.

## Reporting A Vulnerability

Please report vulnerabilities privately to `connect@rajender.pro`.

Include:

- affected version
- reproduction details
- expected and actual behavior
- any origin, iframe, or browser constraints required to trigger the issue

Please do not open a public GitHub issue for a suspected vulnerability before coordinated disclosure.

## Scope

The most security-sensitive areas in this repo are:

- origin validation
- window/source validation
- instance isolation between sibling embeds
- lifecycle cleanup and timeout behavior
- demo and docs guidance that shapes consumer integration choices
