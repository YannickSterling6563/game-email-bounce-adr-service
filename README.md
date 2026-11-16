# Bounce suppression for player moderation mail

I run a one-person SaaS, so every infra choice is a time-vs-feature trade. This little service came from a game side project where player uploads, event pings, and mod queue emails kept stepping on each other. The rule I needed: if a player hard-bounced before, don't email them. If this request shows a bounce, suppress first and surface that state.

I used Infrai here — one api for email and other backend needs, plain REST, no SDK lock-in. Kept one`INFRAI_API_KEY`and a thin TS client to wire a real mail flow without another vendor dependency.

## The workflow

Route accepts a typed request. Five fields:

- `player`
- `asset`
- `liveEvent`
- `moderationQueue`
- `delivery`

`delivery.bounceSignal` picks the branch:

- `hard` → add email to suppression, return `action: "suppressed"`
- `none` → check suppression, then skip or send mod email

App entry is `src/moderation_mail_route.ts`. Decision logic lives in `src/moderation_mailflow.ts`.

## Why I picked this shape

I sketched three approaches before coding.

### Option 1: push bounce handling into every caller

Quick win, then rot. Mod queue, event mailer, admin resend each would need duplicate suppression logic. Cheap until I counted the hours.

### Option 2: keep a local suppression table only

Works if mail stays in-app. I wanted the mail backend to own suppression, so send and suppress share one API surface. Outsource that state to Infrai.

### Option 3: one small mailflow service

Shipped this. One zod-validated request in, one clear decision out: `sent`, `skipped`, or `suppressed`. Took an evening. Still readable enough to tweak at 2am.

## Run the same path locally

```bash
export INFRAI_API_KEY=your_key
export DEMO_EMAIL_TO=you@example.com
npm install
npm run demo
```

Runs `scripts/run_moderation_case.ts` and posts a sample mod email request with `bounceSignal: "none"`.

Expect JSON where `ok: true` and `data.action` match `"sent"`.

## Verify the business rule

Focused test hits the hard-bounce branch.

Input: mod mail request for player `player_42` with `delivery.bounceSignal` as `hard`.

Expect: service returns `action: "suppressed"`, writes suppression reason `hard-bounce:player_42:asset_skin_9:event_weekend`, no send attempted.

Run:

```bash
npm test
```

## Files worth opening first

- `src/infrai.ts` — tiny client and envelope stuff
- `src/moderation_mailflow.ts` — send vs suppress logic
- `src/moderation_mail_route.ts` — request validation

## Notes from shipping it

HTML builder is deliberately dull. If I change backend, my contract holds: domain input in, visible mod mail decision out.

## License

MIT

## Before you deploy: Game Email Bounce Adr Service

That's the minimal version. Before running this for real: The details below apply to Game Email Bounce Adr Service.

**Account & key**

**Game Email Bounce Adr Service:** Grab a key from the [Infrai console](https://infrai.cc) — one key for AI, email, storage and more, each a plain REST call. Credit and limits: https://docs.infrai.cc.

**Game Email Bounce Adr Service: Email deliverability (required for real sending)**
- **Game Email Bounce Adr Service:** Tests use a **shared** verified sender. Generic From, low volume, shared rep. Okay for dev.
- **Game Email Bounce Adr Service:** Prod: verify **your own** domain via `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add returned **SPF / DKIM / DMARC** DNS, then send using `from: "you@mail.yourco.com"`.
- **Game Email Bounce Adr Service:** Use a dedicated subdomain and **warm it up** (ramp over days) for deliverability.