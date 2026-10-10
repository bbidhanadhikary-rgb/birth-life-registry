export const MAX_IMAGE_BYTES = 150 * 1024;

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image compression failed"))),
      "image/jpeg",
      quality,
    );
  });
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file");
  }
  if (file.size <= MAX_IMAGE_BYTES) return file;
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot compress images");
  }

  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    for (let dimensionPass = 0; dimensionPass < 8; dimensionPass++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image compression is unavailable");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46]) {
        const blob = await canvasBlob(canvas, quality);
        if (blob.size <= MAX_IMAGE_BYTES) {
          const baseName = file.name.replace(/\.[^.]+$/, "") || "attachment";
          return new File([blob], `${baseName}.jpg`, {
            type: "image/jpeg",
            lastModified: file.lastModified,
          });
        }
      }
      scale *= 0.78;
    }
  } finally {
    bitmap.close();
  }

  throw new Error("Image could not be compressed below 150 KB");
}
