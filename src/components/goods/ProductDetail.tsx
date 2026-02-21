"use client";

import { useMemo } from "react";
import StickyActionBar from "./StickyActionBar";
import InfoRow from "./InfoRow";

type Props = {
    tenant: string;
    id: string;
};

export default function ProductDetail({ tenant, id }: Props) {
    const product = useMemo(() => {
        const map: Record<
            string,
            { title: string; price: number; summary: string; badges: string[] }
        > = {
            d1: {
                title: "[워크클리공구] 도무스 트래블 폴딩 전기포트 6종",
                price: 49800,
                summary: "여행/캠핑에 딱 좋은 접이식 전기포트",
                badges: ["공구", "한정", "가성비"],
            },
            d2: {
                title: "[2/20] 프리미엄 소스 닭가슴살 4종",
                price: 19900,
                summary: "간편하게 먹는 프리미엄 단백질",
                badges: ["오늘의 공구", "특가", "한정"],
            },
            t1: {
                title: "[태안 오션더힐] 숙박 구독권",
                price: 25000,
                summary: "여행을 떠나요! 숙박 혜택 구독형 상품",
                badges: ["여행", "추천", "핫딜"],
            },
        };

        return (
            map[id] ?? {
                title: `샘플 상품 (${id})`,
                price: 12900,
                summary: "상품 요약 설명(임시)",
                badges: ["샘플", "공구"],
            }
        );
    }, [id]);

    return (
        <div className="pb-20">
            <div className="relative aspect-[4/3] w-full bg-gray-200">
                <div className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                    {tenant.toUpperCase()}
                </div>
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
                    {product.badges.map((b) => (
                        <span
                            key={b}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white"
                        >
              {b}
            </span>
                    ))}
                </div>
            </div>

            <div className="p-4">
                <div className="text-lg font-extrabold leading-snug text-gray-900">
                    {product.title}
                </div>
                <div className="mt-2 text-sm text-gray-600">{product.summary}</div>

                <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="flex items-end justify-between">
                        <div className="text-xs font-semibold text-gray-500">가격</div>
                        <div className="text-xl font-extrabold text-gray-900">
                            {product.price.toLocaleString()}원
                        </div>
                    </div>

                    <div className="mt-3 border-t pt-3">
                        <InfoRow label="배송" value="무료배송(예시)" />
                        <InfoRow label="수량" value="재고 연동 예정" />
                        <InfoRow label="혜택" value="쿠폰/적립(연동 예정)" />
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="text-sm font-extrabold text-gray-900">상품 상세</div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">
                        여기는 상세 페이지 영역입니다. 추후 PHP API에서 상세 HTML/이미지들을
                        내려주면 그대로 렌더링하도록 붙일 예정입니다.
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="aspect-square rounded-xl bg-gray-100" />
                        <div className="aspect-square rounded-xl bg-gray-100" />
                        <div className="aspect-square rounded-xl bg-gray-100" />
                        <div className="aspect-square rounded-xl bg-gray-100" />
                    </div>
                </div>

                <div className="h-10" />
            </div>

            <StickyActionBar
                primaryText="주문하기"
                secondaryText="자세히 보기"
                onPrimaryAction={() => alert("주문하기(임시)")}
                onSecondaryAction={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            />
        </div>
    );
}