// src/app/(site)/[tenant]/(app)/goods/page.tsx
import GoodsListClient, { type GoodsListItem } from "@/components/goods/GoodsListClient";

export default function GoodsListPage({
                                          params,
                                      }: {
    params: { tenant: string };
}) {
    const { tenant } = params;

    const items: GoodsListItem[] = [
        {
            id: "g1",
            title: "[공구] 도무스 트래블 팟 프로 클라우드 접이식 전기포트 6종",
            price: 49800,
            badgeLeft: "오늘의 공구",
            badgeRight: "특가",
            metaLeft: "11시간 남음",
            metaRight: "픽업: 02/27",
        },
        {
            id: "g2",
            title: "[2/20] 꼬기다 프리미엄 소스 닭가슴살 4종",
            price: 19900,
            badgeLeft: "오늘의 공구",
            badgeRight: "한정",
            metaLeft: "11시간 남음",
            metaRight: "픽업: 02/27",
        },
        {
            id: "g3",
            title: "[바로픽업가능] 샤르르콩 3종(딸기/바나나/요거트)",
            price: 1900,
            badgeLeft: "바로 픽업",
            badgeRight: "인기",
            metaLeft: "오늘 수령",
            metaRight: "매장 픽업",
        },
        {
            id: "g4",
            title: "[2/20] 바삭 전 2종(해물파전/감자채전)",
            price: 2900,
            badgeLeft: "진행중",
            badgeRight: "공구",
            metaLeft: "11시간 남음",
            metaRight: "픽업: 02/26",
        },
        {
            id: "g5",
            title: "[여행] [태안 오션더힐] 오션뷰 숙박 구독권",
            price: 25000,
            badgeLeft: "여행",
            badgeRight: "추천",
            metaLeft: "마감 임박",
            metaRight: "예약형",
        },
        {
            id: "g6",
            title: "[공구] 샘플 상품 6",
            price: 12900,
            badgeLeft: "오늘의 공구",
            badgeRight: "한정",
            metaLeft: "2일 남음",
            metaRight: "픽업 가능",
        },
    ];

    return <GoodsListClient tenant={tenant} initialItems={items} />;
}