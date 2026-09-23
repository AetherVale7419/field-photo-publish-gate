import assert from "node:assert/strict";
import test from "node:test";
import { screenWorkOrderPhoto, type ContentModerator, type ImageStore } from "../src/photo_publish_gate.js";

const request = {
  submissionId: "submit-2048",
  workOrderId: "WO-2048",
  dispatchStatus: "awaiting_photo_review",
  technicianId: "tech-17",
  caption: "Replaced the damaged condenser guard.",
  imageBase64: "aGVsbG8tZmllbGQtcGhvdG8=",
  filename: "repair.jpg",
};

const imageStore: ImageStore = {
  async upload(file, filename, operationId) {
    assert.equal(file, request.imageBase64);
    assert.equal(filename, "repair.jpg");
    assert.equal(operationId, "field-photo-submit-2048");
    return { id: "img-2048" };
  },
};

test("approved photo advances the work order to publishable", async () => {
  const moderator: ContentModerator = { async review() { return { flagged: false }; } };
  const decision = await screenWorkOrderPhoto(request, imageStore, moderator);
  assert.deepEqual(decision, {
    submissionId: "submit-2048",
    workOrderId: "WO-2048",
    imageId: "img-2048",
    dispatchStatus: "ready_to_publish",
    publication: "approved",
    technicianFollowUp: null,
  });
});

test("flagged photo stays held and requests technician follow-up", async () => {
  const moderator: ContentModerator = { async review() { return { flagged: true }; } };
  const decision = await screenWorkOrderPhoto(request, imageStore, moderator);
  assert.equal(decision.dispatchStatus, "needs_technician_follow_up");
  assert.equal(decision.publication, "held");
  assert.match(decision.technicianFollowUp ?? "", /submit it for review again/);
});
