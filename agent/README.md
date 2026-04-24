# Autonomous Company AEO Agent

A production-style autonomous agent system for Answer Engine Optimization (AEO).

This project turns a company name plus a small set of URLs into:

- a structured company knowledge profile
- citation-ready AEO answer blocks
- generated marketing content
- a Substack-ready editorial edition
- a visible end-to-end agent execution trace

It is built to be demo-ready in under 3 minutes.

## Why This Project

Modern discovery is shifting from traditional search results to AI-generated answers.
Companies now need structured, source-grounded, answer-ready knowledge that can be surfaced by LLMs.

This app solves that by running an autonomous pipeline that:

1. fetches company sources
2. extracts and cleans content
3. structures facts
4. synthesizes knowledge
5. generates AEO-friendly outputs for content and outreach

## What Judges Should Notice

- Real working system, not pseudo-code
- Sponsor tech is integrated into the product flow
- Settings UI avoids asking for API keys in chat
- End-to-end pipeline is visible in the UI
- Clean architecture with separable agent stages
- Local demo path is simple: save keys, run agent, show outputs

## Sponsor Technology Usage

### TinyFish

TinyFish is used as the primary browsing and scraping layer.

- The pipeline fetches pages through TinyFish first
- TinyFish Agent API automates Substack web publishing
- If TinyFish is not configured, the app falls back to built-in fetch so the demo still runs locally

Relevant files:

- [src/lib/clients/tinyfish.ts](./src/lib/clients/tinyfish.ts)
- [src/lib/agent/fetcher.ts](./src/lib/agent/fetcher.ts)

### WunderGraph

WunderGraph is used as the API orchestration layer pattern for the system.

The frontend calls a unified API surface:

- `POST /api/analyze`
- `POST /api/generate`
- `GET /api/results`
- `GET /api/results/[id]`

Those routes delegate into typed WunderGraph-style operations under `wundergraph/operations/*`.

Relevant files:

- [wundergraph/operations/analyze.ts](./wundergraph/operations/analyze.ts)
- [wundergraph/operations/generate.ts](./wundergraph/operations/generate.ts)
- [wundergraph/operations/results.ts](./wundergraph/operations/results.ts)
- [wundergraph/wundergraph.config.ts](./wundergraph/wundergraph.config.ts)

### Ghost

Ghost is used as an optional publishing/storage layer for generated content.

- Blog drafts can be pushed to Ghost as drafts
- This gives the demo a tangible “generation to publishing” story

Relevant file:

- [src/lib/clients/ghost.ts](./src/lib/clients/ghost.ts)

### Substack

Substack is used as the final distribution channel for generated UGC.

- The app converts blog, podcast, outreach, FAQ, and sources into a single Substack-ready edition
- Publishing is automated through TinyFish Agent API because Substack’s documented publishing flow is web-editor based
- The UI supports `draft` and `publish` modes for safer demos

Relevant files:

- [src/lib/clients/substack.ts](./src/lib/clients/substack.ts)
- [src/components/SettingsForm.tsx](./src/components/SettingsForm.tsx)
- [src/components/ResultsView.tsx](./src/components/ResultsView.tsx)

## Core Product Flow

### 1. Settings Page

The app does not request secrets in chat.

Instead, `/settings` provides a UI for:

- LLM API key
- TinyFish config
- WunderGraph endpoint
- Ghost Admin URL / key
- Database URL

For demo purposes, settings are stored in browser `localStorage` and attached to API requests.

### 2. Main Dashboard

The dashboard lets the user:

- enter a company name
- paste one or more URLs
- run the autonomous agent
- view recent runs

### 3. Autonomous Agent Pipeline

```txt
Source Classifier
-> Fetch (TinyFish)
-> Extract
-> Clean
-> Structure
-> Knowledge Synthesis
-> Content Generation
-> Optional Ghost Publish
```

### 4. UI Output

The result screen shows:

- Company Profile
- Answer Blocks
- Generated Blog Draft
- Podcast Script
- Outreach Messages
- Substack Edition
- Structured Sources
- Pipeline Execution Trace

## Architecture

```txt
src/
  app/
    page.tsx
    settings/page.tsx
    api/
      analyze/route.ts
      generate/route.ts
      results/route.ts
      results/[id]/route.ts
  components/
    Dashboard.tsx
    SettingsForm.tsx
    ResultsView.tsx
  lib/
    agent/
      classifier.ts
      fetcher.ts
      extractor.ts
      cleaner.ts
      structurer.ts
      knowledge.ts
      generator.ts
      pipeline.ts
    clients/
      llm.ts
      tinyfish.ts
      ghost.ts
    config.ts
    settings.ts
    store.ts
    types.ts
wundergraph/
  operations/
    analyze.ts
    generate.ts
    results.ts
  wundergraph.config.ts
```

## Agent Stage Breakdown

### URL Classification

The system identifies likely source types such as docs, blog, profile, github, or video.

File:

- [src/lib/agent/classifier.ts](./src/lib/agent/classifier.ts)

### Fetching

Pages are fetched through TinyFish when configured, with a local fallback for resilience.

File:

- [src/lib/agent/fetcher.ts](./src/lib/agent/fetcher.ts)

### Extraction and Cleaning

HTML is parsed, paragraphs/headings/metadata are extracted, and noisy content is removed.

Files:

- [src/lib/agent/extractor.ts](./src/lib/agent/extractor.ts)
- [src/lib/agent/cleaner.ts](./src/lib/agent/cleaner.ts)

### Structuring

Each source is converted into a normalized fact object with:

- summary
- sections
- entities
- claims

File:

- [src/lib/agent/structurer.ts](./src/lib/agent/structurer.ts)

### Knowledge Synthesis

The system merges structured sources into:

- a company profile
- 6 AEO answer blocks

File:

- [src/lib/agent/knowledge.ts](./src/lib/agent/knowledge.ts)

### Content Generation

The final stage generates:

- AEO blog post
- podcast script
- outreach messages

File:

- [src/lib/agent/generator.ts](./src/lib/agent/generator.ts)

## Local Setup

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

### Verification

```bash
npm run typecheck
npm run build
```

## Environment and Settings

The app supports two config sources:

1. browser-side Settings UI
2. server-side env fallback

Example env file:

- [.env.example](./.env.example)

Example variables:

```env
LLM_PROVIDER=openai
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini

TINYFISH_API_KEY=
TINYFISH_ENDPOINT=https://api.fetch.tinyfish.ai
TINYFISH_AGENT_ENDPOINT=https://agent.tinyfish.ai/v1/automation

WUNDERGRAPH_ENDPOINT=/api

GHOST_ADMIN_URL=
GHOST_ADMIN_KEY=

SUBSTACK_PUBLICATION_URL=
SUBSTACK_EMAIL=
SUBSTACK_PASSWORD=
SUBSTACK_PUBLISH_MODE=draft
SUBSTACK_SEND_EMAIL=false
SUBSTACK_AUDIENCE=everyone

DATABASE_URL=
```

## Demo Script

This is the fastest clean judge demo:

### Step 1

Open `/settings`

- paste LLM key
- paste TinyFish config
- optionally add Ghost config
- optionally add Substack config
- click `Save settings`

### Step 2

Open `/`

- enter a company name
- paste company URLs such as homepage, docs, and pricing

### Step 3

Click `Run Agent`

### Step 4

Walk the judge through:

- Company Profile
- Answer Blocks
- Blog Draft
- Podcast Script
- Outreach Messages
- Substack Edition
- Sources
- Pipeline Trace

### Step 5

If Ghost is configured:

- enable `Publish blog draft to Ghost`
- run again
- show the Ghost draft result

If Substack is configured:

- enable `Publish Substack-ready edition via TinyFish`
- run again
- show the created draft or published Substack URL

## API Surface

### `POST /api/analyze`

Input:

- `company`
- `urls`
- `publishGhost`

Output:

- full `AnalysisJob`

### `POST /api/generate`

Input:

- `profile`
- `answerBlocks`

Output:

- generated content bundle

### `GET /api/results`

Returns recent runs.

### `GET /api/results/[id]`

Returns a single run by id.

## Validation Status

The current project has been verified with:

- `npm install`
- `npm run typecheck`
- `npm run build`
- `npm run dev`

## Current Limitations

- External provider behavior depends on real API keys
- `DATABASE_URL` is captured in settings, but the current demo store is in-memory
- WunderGraph is implemented in a WunderGraph-style operation layer for portability, rather than a deployed cloud setup

## Next Iterations

- persist jobs to a real database
- add async polling / background job execution
- improve retry and timeout handling for fetch failures
- add export/share actions for generated outputs
- add more vertical-specific AEO templates
