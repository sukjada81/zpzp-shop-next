// src/app/(site)/[tenant]/(app)/goods/[id]/page.tsx
import GoodsDetailClient, { type GoodsDetailData } from "@/components/goods/GoodsDetailClient";

export default function GoodsDetailPage({
                                            params,
                                        }: {
    params: { tenant: string; id: string };
}) {
    const { tenant, id } = params;

    const data: GoodsDetailData = {
        id,
        title:
            id === "g1"
                ? "[공구] 도무스 트래블 팟 프로 클라우드 접이식 전기포트 6종"
                : id === "g2"
                    ? "[2/20] 꼬기다 프리미엄 소스 닭가슴살 4종"
                    : id === "g3"
                        ? "[바로픽업가능] 샤르르콩 3종(딸기/바나나/요거트)"
                        : id === "g4"
                            ? "[2/20] 바삭 전 2종(해물파전/감자채전)"
                            : id === "g5"
                                ? "[여행] [태안 오션더힐] 오션뷰 숙박 구독권"
                                : "[공구] 샘플 상품",
        price:
            id === "g1"
                ? 49800
                : id === "g2"
                    ? 19900
                    : id === "g3"
                        ? 1900
                        : id === "g4"
                            ? 2900
                            : id === "g5"
                                ? 25000
                                : 12900,
        badges: {
            left: id === "g3" ? "바로 픽업" : id === "g5" ? "여행" : id === "g4" ? "진행중" : "오늘의 공구",
            right: id === "g2" ? "한정" : id === "g1" ? "특가" : id === "g3" ? "인기" : "공구",
        },
        meta: {
            timeLeft: id === "g5" ? "마감 임박" : "11시간 남음",
            pickup: id === "g5" ? "예약형" : "픽업: 02/27(금) ~ 02/28(토)",
        },
        images: [
            { key: "i1", label: "" },
            { key: "i2", label: "" },
            { key: "i3", label: "" },
        ],
        options:
            id === "g3"
                ? [
                    { id: "o1", name: "샤르르콩 (딸기)", price: 1900, soldout: true, stockNote: "22개 남았습니다!" },
                    { id: "o2", name: "샤르르콩 (바나나)", price: 1900, soldout: true, stockNote: "2개 남았습니다!" },
                    { id: "o3", name: "샤르르콩 (요거트)", price: 1900, soldout: false, stockNote: "바로 픽업 가능" },
                ]
                : [{ id: "o1", name: "기본 구성", price: null, soldout: false, stockNote: "바로 주문 가능" }],
        notices: [
            { icon: "⚡", text: "바로 픽업 가능 / 주문 후 매장에서 수령" },
            { icon: "🛍️", text: "공구 상품은 픽업/배송 일정이 있을 수 있어요" },
        ],
    };

    return <GoodsDetailClient tenant={tenant} data={data} />;
}