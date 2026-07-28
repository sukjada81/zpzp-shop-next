// src/lib/brand.ts

/** 사용자 노출 브랜드명. 이전 값은 "디스카운트 올데이"(DAD 잔재). */
export const BRAND_NAME = "줍줍링크";

/**
 * 로고를 이미지 대신 텍스트 워드마크로 그릴지.
 *
 * public/logo*.png 는 파일 자체는 멀쩡하지만 **DAD 로고 이미지**다.
 * 줍줍 로고 파일을 아직 못 받아서, 받을 때까지 텍스트로 대체한다.
 *
 * ★로고 파일 수령 시 되돌리는 법: 이 상수만 false 로 바꾸면 된다.
 *   (public/logo_top.png · logo_side.png 를 새 파일로 교체한 뒤)
 * 사용처: MobileHeader(상단), SideDrawer(좌측 서랍), Footer(하단).
 */
export const USE_TEXT_LOGO = true;
