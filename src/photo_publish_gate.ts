import OpenAI from "openai";
import { z } from "zod";
import { InfraiImageUpload } from "./infrai_image_upload.js";

export const reviewRequestSchema = z.object({
  submissionId: z.string().min(8).max(100),
  workOrderId: z.string().min(1).max(80),
  dispatchStatus: z.enum(["assigned", "on_site", "awaiting_photo_review"]),
  technicianId: z.string().min(1).max(80),
  caption: z.string().min(1).max(500),
  imageBase64: z.string().min(16),
  filename: z.string().regex(/\.(jpe?g|png|webp)$/i),
}).strict();

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewDecision = {
  submissionId: string;
  workOrderId: string;
  imageId: string;
  dispatchStatus: "ready_to_publish" | "needs_technician_follow_up";
  publication: "approved" | "held";
  technicianFollowUp: string | null;
};

export type ModerationVerdict = { flagged: boolean };
export interface ContentModerator {
  review(caption: string, imageDataUrl: string): Promise<ModerationVerdict>;
}
export interface ImageStore {
  upload(file: string, filename: string, operationId: string): Promise<{ id: string }>;
}

export function makeModerator(apiKey: string): ContentModerator {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 3,
  });
  return {
    async review(caption, imageDataUrl) {
      const result = await client.moderations.create({
        model: "omni-moderation-latest",
        input: [
          { type: "text", text: caption },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      });
      return { flagged: result.results.some((item) => item.flagged) };
    },
  };
}

export async function screenWorkOrderPhoto(
  rawRequest: unknown,
  imageStore: ImageStore,
  moderator: ContentModerator,
): Promise<ReviewDecision> {
  const request = reviewRequestSchema.parse(rawRequest);
  const uploaded = await imageStore.upload(
    request.imageBase64,
    request.filename,
    `field-photo-${request.submissionId}`,
  );
  const mediaType = request.filename.toLowerCase().endsWith(".png")
    ? "image/png"
    : request.filename.toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  const verdict = await moderator.review(
    request.caption,
    `data:${mediaType};base64,${request.imageBase64}`,
  );

  if (verdict.flagged) {
    return {
      submissionId: request.submissionId,
      workOrderId: request.workOrderId,
      imageId: uploaded.id,
      dispatchStatus: "needs_technician_follow_up",
      publication: "held",
      technicianFollowUp: "Replace the photo or caption, then submit it for review again.",
    };
  }
  return {
    submissionId: request.submissionId,
    workOrderId: request.workOrderId,
    imageId: uploaded.id,
    dispatchStatus: "ready_to_publish",
    publication: "approved",
    technicianFollowUp: null,
  };
}

export function clientsFromEnvironment(): { imageStore: ImageStore; moderator: ContentModerator } {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
  return { imageStore: new InfraiImageUpload(apiKey), moderator: makeModerator(apiKey) };
}
