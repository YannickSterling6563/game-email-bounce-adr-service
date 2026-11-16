import { z } from "zod";

export const moderationMailRequestSchema = z.object({
  player: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    displayName: z.string().min(1)
  }),
  asset: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: z.enum(["map", "skin", "sticker"])
  }),
  liveEvent: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    phase: z.enum(["submitted", "featured"])
  }),
  moderationQueue: z.object({
    id: z.string().min(1),
    reason: z.enum(["copyright", "abuse", "unsafe"])
  }),
  delivery: z.object({
    bounceSignal: z.enum(["none", "hard"]).default("none")
  })
});

export type ModerationMailRequest = z.infer<typeof moderationMailRequestSchema>;

export type ModerationMailDecision =
  | {
      action: "suppressed";
      playerId: string;
      email: string;
      suppressionReason: string;
    }
  | {
      action: "skipped";
      playerId: string;
      email: string;
      reason: "already-suppressed";
    }
  | {
      action: "sent";
      playerId: string;
      email: string;
      messageId: string;
    };
