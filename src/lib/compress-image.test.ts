import { describe, expect, it } from "vitest";
import { compressImage, MAX_IMAGE_BYTES } from "./compress-image";

describe("image attachment limit", () => {
  it("uses an exact 750 KB maximum", () => {
    expect(MAX_IMAGE_BYTES).toBe(750 * 1024);
  });

  it("keeps a valid image at the size limit unchanged", async () => {
    const file = new File([new Uint8Array(MAX_IMAGE_BYTES)], "attachment.png", {
      type: "image/png",
    });
    await expect(compressImage(file)).resolves.toBe(file);
  });
});
