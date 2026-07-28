// src/lib/brand.ts

/** 사용자 노출 브랜드명. 이전 값은 "디스카운트 올데이"(DAD 잔재). */
export const BRAND_NAME = "줍줍링크";

/**
 * 로고를 이미지 대신 텍스트 워드마크로 그릴지.
 *
 * 2026-07-29 줍줍 로고 수령 → false 로 전환(이미지 사용).
 * 출처: shop-php `skin/seriesWhite/img/logo.png` (zpzp.kr 홈 헤더의 그 로고)를
 * `public/logo_zpzp.png` 로 복사했다. 320x320 **정사각**이고 아이콘+"줍줍링크"
 * 워드마크가 한 이미지에 들어 있다(DAD 의 가로형 logo_top.png 와 형태가 다르다).
 *
 * 텍스트 워드마크 분기는 지우지 않고 남겨둔다 — 로고 교체/사고 시 이 상수만 true 로
 * 되돌리면 즉시 복구된다. 사용처: MobileHeader(상단), SideDrawer(좌측 서랍), Footer(하단).
 */
export const USE_TEXT_LOGO = false;

/** 브랜드 로고 이미지 경로. 정사각(1:1) 이미지라 슬롯도 정사각으로 잡아야 한다. */
export const BRAND_LOGO_SRC = "/logo_zpzp.png";
