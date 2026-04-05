# Podium — AI Agent Development Guide

> **Main branch protection:**
> Never commit or push directly to `main`.
> Always use a feature or fix branch created from `main`.

## Project Overview

Podium is a PWA that helps non-verbal people deliver speeches. Built with Next.js, Clerk, Convex, and ElevenLabs TTS.

**Key Technologies:**
- Next.js 16 with React 19 (Turbopack)
- TypeScript
- Convex (realtime data)
- Clerk (authentication)
- ElevenLabs (text-to-speech)
- Tailwind CSS

## Development Workflow

### 1. Issue Creation
Every piece of work starts with a GitHub issue.

### 2. Branch Strategy
- Create a new branch from `main` referencing the issue
- e.g. `feature/issue-3-acronym-handling`

### 3. Build Requirements
```bash
npm run build
```
Ensure the build passes before creating a PR.

### 4. Pull Request Process
- PR against `main`
- Reference the issue number
- Ensure all checks pass

### 5. Release Process
See sayit-web AGENTS.md for the full release process (same flow applies).

## Project Structure

```
podium-web/
├── app/              # Next.js app directory
│   ├── (auth)/       # Sign-in / sign-up routes
│   ├── library/      # Talk library
│   ├── talk/[id]/    # Present a talk
│   └── settings/     # User settings
├── components/       # Shared React components
├── convex/           # Convex backend functions and schema
├── lib/              # Utility functions
└── public/           # Static assets
```

## Convex Schema
- `users` — Clerk-linked user profiles
- `talks` — Scripts with ordered segments (text, tempo, emphasis)
- `talkVersions` — Version history per talk
- `talkSets` — Named collections of talks for events
- `pronunciations` — Custom word pronunciations
- `acronymRules` — Per-acronym speak-as-letters or speak-as-word rules
