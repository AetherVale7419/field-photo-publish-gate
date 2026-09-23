import { createServer } from "node:http";
import OpenAI from "openai";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_image_upload.js";
import { clientsFromEnvironment, screenWorkOrderPhoto } from "./photo_publish_gate.js";

const clients = clientsFromEnvironment();

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/work-order-photo-reviews") {
    send(response, 404, { error: "route_not_found" });
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    send(response, 200, await screenWorkOrderPhoto(body, clients.imageStore, clients.moderator));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code });
      return;
    }
    if (error instanceof OpenAI.APIError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code ?? "moderation_rejected" });
      return;
    }
    send(response, 502, { error: "review_unavailable" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Field photo review listening on http://localhost:${port}`));
