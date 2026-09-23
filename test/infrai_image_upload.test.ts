import assert from "node:assert/strict";
import test from "node:test";
import { InfraiImageUpload } from "../src/infrai_image_upload.js";

test("upload sends only contracted JSON fields", async () => {
  const fetcher: typeof fetch = async (_url, init) => {
    assert.deepEqual(JSON.parse(init?.body as string), {
      file: "aGVsbG8=", filename: "repair.jpg", idempotency_key: "field-photo-submit-2048",
    });
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
    assert.equal((init?.headers as Record<string, string>)["Content-Type"], "application/json");
    assert.equal((init?.headers as Record<string, string>)["Idempotency-Key"], undefined);
    return Response.json({ ok: true, data: { id: "img-2048" } });
  };
  const image = await new InfraiImageUpload("test-key", fetcher).upload(
    "aGVsbG8=", "repair.jpg", "field-photo-submit-2048",
  );
  assert.equal(image.id, "img-2048");
});
