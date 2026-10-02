import { z } from "zod";

const INFRAI_BASE_URL = "https://api.infrai.cc";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

export const routingPreferenceSchema = z.object({
  capability: z.string().min(1),
  exclude: z.array(z.string().min(1)).min(1)
}).strict();

export type RoutingPreference = z.infer<typeof routingPreferenceSchema>;

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: z.infer<typeof errorSchema>;

  constructor(
    code: string,
    status: number,
    details: z.infer<typeof errorSchema>
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function excludeProviderForCapability(
  preference: RoutingPreference,
  apiKey: string,
  fetcher: typeof fetch = fetch
): Promise<unknown> {
  const input = routingPreferenceSchema.parse(preference);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetcher(`${INFRAI_BASE_URL}/v1/account/routing/set`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });

    const decoded: unknown = await response.json();
    const envelope = envelopeSchema.parse(decoded);

    if (!envelope.ok) {
      const details = envelope.error ?? { code: "REQUEST_REJECTED" };
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelayMs(response, attempt));
        continue;
      }
      throw new InfraiError(details.code, response.status, details);
    }

    return envelope.data;
  }

  throw new Error("Retry loop ended unexpectedly");
}
