import { createServer } from "node:http";
import { z } from "zod";
import {
  appointmentEventSchema,
  buildOperationalNotification
} from "./appointment_notifications.js";
import {
  excludeProviderForCapability,
  InfraiError,
  routingPreferenceSchema
} from "./routing_policy.js";

const port = Number(process.env.PORT ?? "3000");

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/routing-preference") {
      const apiKey = process.env.INFRAI_API_KEY;
      if (!apiKey) return send(response, 503, { error: "INFRAI_API_KEY is required" });

      const preference = routingPreferenceSchema.parse(await readJson(request));
      const result = await excludeProviderForCapability(preference, apiKey);
      return send(response, 200, { routing: result });
    }

    if (request.method === "POST" && request.url === "/appointment-events") {
      const event = appointmentEventSchema.parse(await readJson(request));
      return send(response, 200, buildOperationalNotification(event));
    }

    return send(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return send(response, 400, { error: "Invalid request body", issues: error.issues });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(response, status, { error: error.code, details: error.details });
    }
    return send(response, 500, { error: "Request could not be processed" });
  }
});

server.listen(port, () => {
  console.log(`Appointment routing service listening on http://localhost:${port}`);
});
