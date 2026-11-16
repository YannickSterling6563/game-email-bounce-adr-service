import { infrai } from "./infrai.js";
import type { ModerationMailDecision, ModerationMailRequest } from "./game_mail_types.js";

export type MailGateway = {
  checkSuppression(email: string): Promise<{ suppressed: boolean }>;
  addSuppression(input: { email: string; reason: string }, idempotencyKey: string): Promise<void>;
  sendEmail(input: { to: string; subject: string; html: string }, idempotencyKey: string): Promise<{ messageId: string }>;
};

export function createInfraiMailGateway(): MailGateway {
  return {
    async checkSuppression(email: string) {
      const reply = await infrai.email.suppression.check(email);
      return reply.data;
    },
    async addSuppression(input: { email: string; reason: string }, idempotencyKey: string) {
      await infrai.email.suppression.add(input, idempotencyKey);
    },
    async sendEmail(input: { to: string; subject: string; html: string }, idempotencyKey: string) {
      const reply = await infrai.email.send(input, idempotencyKey);
      return { messageId: reply.data.message_id };
    }
  };
}

export function buildModerationEmail(input: ModerationMailRequest): { subject: string; html: string } {
  const subject = `${input.liveEvent.name}: update for ${input.asset.title}`;
  const html = [
    `<h1>Hi ${input.player.displayName}</h1>`,
    `<p>Your ${input.asset.kind} <b>${input.asset.title}</b> is in the moderation queue for ${input.liveEvent.name}.</p>`,
    `<p>Queue: ${input.moderationQueue.id}</p>`,
    `<p>Reason: ${input.moderationQueue.reason}</p>`,
    `<p>Event phase: ${input.liveEvent.phase}</p>`
  ].join("");
  return { subject, html };
}

export function suppressionReason(input: ModerationMailRequest): string {
  return "hard_bounce";
}

export function emailIdempotencyKey(input: ModerationMailRequest): string {
  return `moderation-mail:${input.player.id}:${input.asset.id}:${input.liveEvent.id}:${input.moderationQueue.id}`;
}

export async function handleModerationMailflow(
  input: ModerationMailRequest,
  gateway: MailGateway,
): Promise<ModerationMailDecision> {
  if (input.delivery.bounceSignal === "hard") {
    const reason = suppressionReason(input);
    await gateway.addSuppression({ email: input.player.email, reason }, `suppress:${emailIdempotencyKey(input)}`);
    return {
      action: "suppressed",
      playerId: input.player.id,
      email: input.player.email,
      suppressionReason: reason
    };
  }

  const suppression = await gateway.checkSuppression(input.player.email);
  if (suppression.suppressed) {
    return {
      action: "skipped",
      playerId: input.player.id,
      email: input.player.email,
      reason: "already-suppressed"
    };
  }

  const email = buildModerationEmail(input);
  const sent = await gateway.sendEmail(
    {
      to: input.player.email,
      subject: email.subject,
      html: email.html
    },
    emailIdempotencyKey(input),
  );

  return {
    action: "sent",
    playerId: input.player.id,
    email: input.player.email,
    messageId: sent.messageId
  };
}
