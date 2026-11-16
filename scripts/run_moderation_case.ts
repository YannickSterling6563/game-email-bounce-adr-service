import { handleModerationMailRequest } from "../src/moderation_mail_route.js";

const email = process.env.DEMO_EMAIL_TO;
if (!email) {
  throw new Error("DEMO_EMAIL_TO is required");
}

const response = await handleModerationMailRequest({
  player: {
    id: "player_42",
    email,
    displayName: "Mika"
  },
  asset: {
    id: "asset_map_7",
    title: "Neon Drift Arena",
    kind: "map"
  },
  liveEvent: {
    id: "event_summer_qualifier",
    name: "Summer Qualifier",
    phase: "submitted"
  },
  moderationQueue: {
    id: "mq_991",
    reason: "copyright"
  },
  delivery: {
    bounceSignal: "none"
  }
});

console.log(await response.json());
