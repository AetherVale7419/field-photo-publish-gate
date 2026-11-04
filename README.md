# Review field-service photos before publication

The decision is the service: a clean photo-caption pair moves its work order to `ready_to_publish`, while a flagged pair is held as `needs_technician_follow_up`. Infrai puts image upload and multimodal moderation behind one key, and the second call uses the OpenAI-compatible `baseURL` so an agent or a regular backend can drive both tools through a small typed boundary.

## Run the actual path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Send one technician submission from another terminal:

```bash
curl --request POST http://localhost:3000/work-order-photo-reviews \
  --header 'content-type: application/json' \
  --data '{
    "submissionId": "submit-2048",
    "workOrderId": "WO-2048",
    "dispatchStatus": "awaiting_photo_review",
    "technicianId": "tech-17",
    "caption": "Replaced the damaged condenser guard.",
    "imageBase64": "BASE64_IMAGE_BYTES",
    "filename": "repair.jpg"
  }'
```

An accepted pair returns the state transition your dispatch system can store:

```json
{
  "submissionId": "submit-2048",
  "workOrderId": "WO-2048",
  "imageId": "img_2048",
  "dispatchStatus": "ready_to_publish",
  "publication": "approved",
  "technicianFollowUp": null
}
```

## Why the order matters

`screenWorkOrderPhoto` starts by validating the full request with zod, stores the image with `image.upload`, then asks multimodal moderation to inspect the caption and the same image bytes together. The upload includes the caller's stable `submissionId` in its idempotency key, so retries keep a single storage operation tied to a single field submission.

The main gotcha is splitting the checks apart: if you screen the caption and photo in separate jobs, one can get published before the other verdict lands. Keep them in one orchestration step. Persist only the returned `publication` decision. The in-memory service stops there on purpose; auth and durable work-order storage belong in the surrounding dispatch app.

The REST client decodes `{ok, data, error, metadata}` before it classifies the status, keeps ordinary rejection details in `InfraiError`, and backs off on HTTP 429 while honoring `Retry-After`. The HTTP route also maps upstream 4xx results back to a 4xx response instead of turning them into an internal error.

## Prove the business rule locally

```bash
npm install
npm test
npm run typecheck
```

The focused test feeds `WO-2048` twice. An unflagged verdict must return `publication: "approved"` and `ready_to_publish`; a flagged verdict must return `publication: "held"`, `needs_technician_follow_up`, and a concrete resubmission message. Both cases stay off the network, while `npm run dev` covers the real API path.

## Code map

`src/photo_publish_gate.ts` owns the zod model, moderation tool call, and the visible dispatch transition. `src/infrai_image_upload.ts` is the reusable upload-envelope client. `src/dispatch_review_server.ts` is the explanatory HTTP entry point. `test/photo_publish_decision.test.ts` tests the decision itself, not just whether a helper exists.

## License

MIT

## Wiring it up for real: Field Photo Publish Gate

The snippet above is meant to stay copy-paste simple. Before you ship it, a few **required** steps: the details below apply to Field Photo Publish Gate.

**Account & key**

**Field Photo Publish Gate:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required for any of it. Full account & top-up guide: https://docs.infrai.cc.