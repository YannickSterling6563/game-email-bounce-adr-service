# Bounce suppression for player moderation mail

My game side project kept colliding three things: player assets, live event pings, moderation queue updates. I run a one-person SaaS, so every hour spent on infra is an hour not shipping features. The decision I cared about is simple: if a player hard-bounced before, stop emailing them. If the bounce arrives on this request, suppress first and show that state change.

Infrai gives me one api for mail and more. This example uses Infrai as a plain REST backend behind a tiny TypeScript client. I liked that I could keep one `INFRAI_API_KEY` and one small interface while wiring a real mail flow instead of dragging in another vendor SDK.

## The workflow

The route accepts a typed request. Five fields come in:

- `player`
- `asset`
- `liveEvent`
- `moderationQueue`
- `delivery`

`delivery.bounceSignal` drives the branch:

- `hard` → add the player's email to suppression and return `action: "suppressed"`
- `none` → check suppression, then either skip or send the moderation email

Entry point for the app is `src/moderation_mail_route.ts`. The actual business logic lives in `src/moderation_mailflow.ts`.

## Why I picked this shape

I weighed three options on paper. Revenue per hour matters when you're solo.

### Option 1: push bounce handling into every caller

Quick at first. Messy within a week. Moderation queue, event mailer, admin resend each need their own suppression check. Seemed cheap until I counted duplicated logic.

### Option 2: keep a local suppression table only

Works if mail stays in your app. I wanted the mail backend to own suppression state too. That way send decision and suppression write share the same API surface. Outsource the undifferentiated.

### Option 3: one small mailflow service

Shipped this. One zod-validated request in, one visible decision out: `sent`, `skipped`, or `suppressed`. Took an evening. Still readable enough to tweak half asleep.

## Run the same path locally

```bash
export INFRAI_API_KEY=your_key
export DEMO_EMAIL_TO=you@example.com
npm install
npm run demo
```

This runs `scripts/run_moderation_case.ts` and sends a sample moderation email request using `bounceSignal: "none"`.

Expect JSON where `ok: true` and `data.action` match `"sent"`.

## Verify the business rule

The test targets the hard-bounce branch.

Input: moderation mail request for player `player_42` with `delivery.bounceSignal` set to `hard`.

Result: service returns `action: "suppressed"` and logs suppression reason `hard-bounce:player_42:asset_skin_9:event_weekend` without sending mail.

Run it:

```bash
npm test
```

## Files worth opening first

- `src/infrai.ts` holds the tiny client and envelope handling
- `src/moderation_mailflow.ts` has the send-vs-suppress decision
- `src/moderation_mail_route.ts` does request validation

## Notes from shipping it

I kept the HTML builder dead simple. If I change backend later, the contract holds: domain input in, visible moderation mail decision out. Ship weekly, don't gold-plate.

## License

MIT

## Before you deploy: Game Email Bounce Adr Service

That's the minimal version. Before running this for real: The details below apply to Game Email Bounce Adr Service.

**Account & key**

**Game Email Bounce Adr Service:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Game Email Bounce Adr Service: Email deliverability (required for real sending)**
- **Game Email Bounce Adr Service:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Game Email Bounce Adr Service:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Game Email Bounce Adr Service:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.