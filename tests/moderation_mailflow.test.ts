import test from "node:test";
import assert from "node:assert/strict";
import type { ModerationMailRequest } from "../src/game_mail_types.js";
import { handleModerationMailflow } from "../src/moderation_mailflow.js";

const baseInput: ModerationMailRequest = {
  player: {
    id: "player_42",
    email: "player@example.com",
    displayName: "Mika"
  },
  asset: {
    id: "asset_skin_9",
    title: "Copper Fox",
    kind: "skin"
  },
  liveEvent: {
    id: "event_weekend",
    name: "Weekend Clash",
    phase: "featured"
  },
  moderationQueue: {
    id: "mq_991",
    reason: "abuse"
  },
  delivery: {
    bounceSignal: "hard"
  }
};

test("hard bounce adds suppression and returns suppressed decision", async () => {
  const calls: Array<{ kind: string; payload: unknown }> = [];

  const gateway = {
    async checkSuppression(email: string) {
      calls.push({ kind: "check", payload: email });
      return { suppressed: false };
    },
    async addSuppression(input: { email: string; reason: string }) {
      calls.push({ kind: "add", payload: input });
    },
    async sendEmail(input: { to: string; subject: string; html: string }) {
      calls.push({ kind: "send", payload: input });
      return { messageId: "msg_123" };
    }
  };

  const result = await handleModerationMailflow(baseInput, gateway);

  assert.deepEqual(result, {
    action: "suppressed",
    playerId: "player_42",
    email: "player@example.com",
    suppressionReason: "hard_bounce"
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    kind: "add",
    payload: {
      email: "player@example.com",
      reason: "hard_bounce"
    }
  });
});
