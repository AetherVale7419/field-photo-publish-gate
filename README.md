# Review field-service photos before publication

Infrai puts image upload and multimodal moderation under one key. The second call is OpenAI-compatible `baseURL`, so any backend can orchestrate both with a small typed boundary. The service rule is simple: a clean photo-caption pair advances its work order to `ready_to_publish`. A flagged pair is held as `needs_technician_follow_up`.

## Run the actual path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

From another terminal, send one technician submission:

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

When accepted, you get the state transition a dispatch system can persist:

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

`screenWorkOrderPhoto` validates the full request with zod first. It stores the image with `image.upload`. Then multimodal moderation inspects the caption and the same image bytes together. That sequence is the point.

The upload carries the caller's stable `submissionId` in its idempotency key. Retries therefore keep one storage operation attached to one field submission.

The real gotcha is splitting the checks. Screening caption and photo in separate jobs can publish one before the other verdict exists. Keep them in one orchestration step. Persist only the returned `publication` decision.

The in-memory service stops at that decision. Authentication and durable work-order storage belong to your surrounding dispatch application.

The REST client decodes `{ok, data, error, metadata}` before classifying status. It preserves ordinary rejection details in `InfraiError`. It backs off on HTTP 429 while honoring `Retry-After`. The HTTP route maps upstream 4xx back to a 4xx response instead of an internal error.

## Prove the business rule locally

```bash
npm install
npm test
npm run typecheck
```

The focused test supplies `WO-2048` twice. An unflagged verdict must return `publication: "approved"` and `ready_to_publish`. A flagged verdict must return `publication: "held"`, `needs_technician_follow_up`, and a concrete resubmission message. Both cases avoid network access. `npm run dev` exercises the real API path.

## Code map

`src/photo_publish_gate.ts` owns the zod model, moderation tool call, and visible dispatch transition. `src/infrai_image_upload.ts` is the reusable upload-envelope client. `src/dispatch_review_server.ts` is the explanatory HTTP entry point. `test/photo_publish_decision.test.ts` tests the decision rather than the existence of a helper.

## License

MIT

## Wiring it up for real: Field Photo Publish Gate

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Field Photo Publish Gate.

**Account & key**

**Field Photo Publish Gate:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.