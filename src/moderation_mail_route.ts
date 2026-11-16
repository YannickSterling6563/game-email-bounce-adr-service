import { moderationMailRequestSchema } from "./game_mail_types.js";
import { createInfraiMailGateway, handleModerationMailflow } from "./moderation_mailflow.js";
import { InfraiError } from "./infrai.js";

export async function handleModerationMailRequest(body: unknown): Promise<Response> {
  const parsed = moderationMailRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          message: "Invalid moderation mail request",
          issues: parsed.error.flatten()
        }
      },
      { status: 400 },
    );
  }

  try {
    const decision = await handleModerationMailflow(parsed.data, createInfraiMailGateway());
    return Response.json({ ok: true, data: decision }, { status: 200 });
  } catch (error) {
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      return Response.json(
        {
          ok: false,
          error: {
            message: error.message,
            code: error.code
          }
        },
        { status: 422 },
      );
    }

    throw error;
  }
}
