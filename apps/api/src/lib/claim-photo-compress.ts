/**
 * 증빙 사진 저장용. 긴 변 1600, JPEG 82.
 * sharp 가 없으면 원본을 그대로 둔다.
 */
export const CLAIM_PHOTO_MAX_EDGE = 1600;
export const CLAIM_PHOTO_JPEG_QUALITY = 82;

export async function compressClaimPhotoBuffer(input: Buffer): Promise<{ buf: Buffer; ext: string }> {
    try {
        const sharpMod = await import("sharp");
        const sharp = sharpMod.default;
        const out = await sharp(input)
            .rotate()
            .resize(CLAIM_PHOTO_MAX_EDGE, CLAIM_PHOTO_MAX_EDGE, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .jpeg({ quality: CLAIM_PHOTO_JPEG_QUALITY, mozjpeg: true })
            .toBuffer();
        if (!out.length) return { buf: input, ext: "" };
        return { buf: out, ext: ".jpg" };
    } catch {
        return { buf: input, ext: "" };
    }
}
