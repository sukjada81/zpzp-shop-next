/** 증빙 사진: 긴 변 1600px, JPEG 82%. 화면·상세 보기에 충분하고 용량은 크게 줄어든다. */
export const CLAIM_PHOTO_MAX_EDGE = 1600;
export const CLAIM_PHOTO_JPEG_QUALITY = 0.82;

export async function compressImageForClaim(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) return file;

    try {
        const bitmap = await createImageBitmap(file, {
            imageOrientation: "from-image",
        } as ImageBitmapOptions);
        const scale = Math.min(1, CLAIM_PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return file;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
        if (typeof bitmap.close === "function") bitmap.close();

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((next) => resolve(next), "image/jpeg", CLAIM_PHOTO_JPEG_QUALITY);
        });
        if (!blob || blob.size <= 0) return file;
        if (blob.size >= file.size && file.type === "image/jpeg" && scale === 1) return file;

        const name = String(file.name || "claim").replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
    } catch {
        return file;
    }
}
