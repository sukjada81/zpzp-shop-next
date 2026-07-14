// src/lib/media/resolveMediaUrl.ts

/**
 * ✅ 서버 이미지/에디터 이미지 URL 정규화
 *
 * 입력 예:
 * - "image/goods/img2/1/10351.png?t=123"
 * - "/image/goods/img2/1/10351.png?t=123"
 * - "https://specialoffer.kr/data/editor/....jpg"
 *
 * 출력:
 * - (ASSET_ORIGIN이 있으면) "https://zpzp.kr/image/goods/img2/1/10351.png?t=123"
 * - 없으면 "/image/goods/img2/1/10351.png?t=123"
 */
export function resolveMediaUrl(raw?: string) {
    const s = String(raw ?? "").trim();
    if (!s) return "";

    // 이미 절대 URL이면 그대로
    if (/^https?:\/\//i.test(s)) return s;

    const base = (process.env.NEXT_PUBLIC_ASSET_ORIGIN || "").replace(/\/$/, "");

    // query 포함한 상대경로 처리
    const path = s.startsWith("/") ? s : `/${s}`;

    // base 없으면 same-origin relative로
    if (!base) return path;

    return `${base}${path}`;
}

/**
 * ✅ HTML 내부 img/src 같은 상대경로를 절대경로로 교체
 * - src="image/..." -> src="ASSET_ORIGIN/image/..."
 * - src='/image/...' -> src='ASSET_ORIGIN/image/...'
 *
 * 주의: 아주 복잡한 HTML 파싱까지는 안 하고, 실무에서 흔한 케이스를 커버하는 수준.
 */
export function absolutizeHtmlImageSrc(html: string) {
    const base = (process.env.NEXT_PUBLIC_ASSET_ORIGIN || "").replace(/\/$/, "");
    if (!base) return html;

    // src="image/...." 또는 src='image/...'
    const re1 = /\bsrc\s*=\s*(["'])(image\/[^"']+)\1/gi;
    // src="/image/...." 또는 src='/image/...'
    const re2 = /\bsrc\s*=\s*(["'])(\/image\/[^"']+)\1/gi;

    let out = html;
    out = out.replace(re1, (_m, q, p) => `src=${q}${base}/${p}${q}`);
    out = out.replace(re2, (_m, q, p) => `src=${q}${base}${p}${q}`);

    return out;
}