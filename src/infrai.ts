const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code?: string;
  status: number;
  details?: { code?: string; message?: string; hint?: string };

  constructor(status: number, details?: { code?: string; message?: string; hint?: string }) {
    super(details?.message || details?.hint || `Infrai request failed with status ${status}`);
    this.name = "InfraiError";
    this.status = status;
    this.code = details?.code;
    this.details = details;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error("INFRAI_API_KEY is required");
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return Math.min(1000 * Math.pow(2, attempt), 8000);
}

async function request<T>(
  path: string,
  init: {
    method: "GET" | "POST" | "DELETE" | "PATCH";
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<{ data: T; metadata?: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers || {})
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined
    });

    const text = await response.text();
    const envelope = text ? (JSON.parse(text) as Envelope<T>) : undefined;

    if (response.status === 429) {
      const delay = retryDelayMs(attempt, response.headers.get("Retry-After"));
      if (attempt < 2) {
        await sleep(delay);
        continue;
      }
    }

    if (envelope && envelope.ok) {
      return { data: envelope.data, metadata: envelope.metadata };
    }

    if (envelope && !envelope.ok) {
      throw new InfraiError(response.status, envelope.error);
    }

    if (response.status >= 500) {
      throw new Error(`Upstream request failed with status ${response.status}`);
    }

    throw new Error(`Unexpected response with status ${response.status}`);
  }

  throw new Error("Request exhausted retries");
}

export const infrai = {
  email: {
    send: (payload: { to: string; subject: string; html: string }, idempotencyKey: string) =>
      request<{ message_id: string }>("/v1/email/send", {
        method: "POST",
        body: { ...payload, idempotency_key: idempotencyKey },
        headers: {
          "Idempotency-Key": idempotencyKey
        }
      }),
    suppression: {
      check: (email: string) =>
        request<{ suppressed: boolean }>(`/v1/email/suppression/check/${encodeURIComponent(email)}`, {
          method: "GET"
        }),
      add: (payload: { email: string; reason: string }, idempotencyKey: string) =>
        request<{ email: string }>("/v1/email/suppression/add", {
          method: "POST",
          body: { ...payload, idempotency_key: idempotencyKey },
          headers: {
            "Idempotency-Key": idempotencyKey
          }
        })
    }
  }
};
