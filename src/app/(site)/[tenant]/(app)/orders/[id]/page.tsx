// src/app/(site)/[tenant]/(app)/orders/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { endpoints, tenantHeader, claimPhotoSrc } from "@/lib/api/endpoints";
import { compressImageForClaim } from "@/lib/images/compressClaimPhoto";
import { loadGuestOrderRefs } from "@/lib/orders/guestOrderRefs";
import { toneByOrderStatus } from "@/lib/orders/customerOrderDisplay";

type OrderDetailItem = {
    id: string;
    productId: string;
    title: string;
    goodsCode?: string;
    price: number;
    origPrice: number;
    qty: number;
    optionId: number;
    optionName?: string;
    status: number;
    status2: number;
    effectiveStatus?: number;
    statusLabel?: string;
    displayStatus?: string;
    canCancelImmediate?: boolean;
    canCancelRequest?: boolean;
    canWithdrawCancelRequest?: boolean;
    canConfirm?: boolean;
    canReturn?: boolean;
    canExchange?: boolean;
    canWithdrawClaimRequest?: boolean;
    claimUid?: number;
    claimCause?: "change_of_mind" | "defect" | null;
    claimReasonLabel?: string;
    claimPhotos?: string[];
    cancelMode?: "immediate" | "request" | "none";
    canTrackDelivery?: boolean;
    deliveryCarrierName?: string;
    deliveryInvoiceNo?: string;
    deliveryTrackUrl?: string;
    createdAt?: string | null;
};

type OrderDetailResponse = {
    ok: boolean;
    tenant?: string;
    order?: {
        id: string;
        orderNum: string;
        buyerName: string;
        buyerPhone: string;
        receiverName: string;
        receiverPhone: string;
        postcode?: string;
        address1?: string;
        address2?: string;
        addressLine?: string;
        message?: string;
        memo?: string;
        totalAmount: number;
        goodsTotal?: number;
        couponTotal?: number;
        coupons?: Array<{ name: string; kind: string; amount: number }>;
        cancelTotal: number;
        refundTotal: number;
        deliveryTotal: number;
        outboundDelivery?: number;
        returnDelivery?: number;
        remainingAmount?: number;
        allReturnCompleted?: boolean;
        shippingOnlyRemaining?: boolean;
        payType: string;
        payStatus: string;
        payTypeLabel?: string;
        payStatusLabel?: string;
        isOnlinePrepaid?: boolean;
        pickupAt?: string | null;
        status: number;
        status2?: number;
        statusLabel: string;
        displayStatus?: string;
        badgeText?: string | null;
        footerText?: string | null;
        statusNotice?: string | null;
        canCancel?: boolean;
        cancelMode?: "immediate" | "request" | "none";
        canReturn?: boolean;
        canExchange?: boolean;
        canConfirm?: boolean;
        isPartiallyCanceled?: boolean;
        activeItemCount?: number;
        canceledItemCount?: number;
        totalItemCount?: number;
        createdAt?: string | null;
        statusDate?: string | null;
        items: OrderDetailItem[];
        timeline?: Array<{
            id: string;
            source: string;
            eventType: string;
            label: string;
            detail: string | null;
            orderGoodsUid: number | null;
            actor: string | null;
            amount: number | null;
            at: string;
        }>;
    };
    message?: string;
};

type CancelOrderResponse = {
    ok: boolean;
    orderNum?: string;
    status?: number;
    statusLabel?: string;
    message?: string;
};

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

function formatMoney(value: number) {
    return `${Number(value ?? 0).toLocaleString()}원`;
}

function buildOrderPayExplain(input: {
    goods: number;
    outbound: number;
    returnDelivery: number;
    coupon: number;
}) {
    const goods = Math.max(0, Math.trunc(input.goods));
    const outbound = Math.max(0, Math.trunc(input.outbound));
    const returnDelivery = Math.max(0, Math.trunc(input.returnDelivery));
    const coupon = Math.max(0, Math.trunc(input.coupon));
    const total = Math.max(0, goods + outbound + returnDelivery - coupon);

    const bits = [formatMoney(goods)];
    if (coupon > 0) bits.push(`- ${formatMoney(coupon)}`);
    if (outbound > 0) bits.push(`+ ${formatMoney(outbound)}`);
    if (returnDelivery > 0) bits.push(`+ ${formatMoney(returnDelivery)}`);

    let story = "";
    if (returnDelivery > 0 && outbound > 0) {
        story = coupon > 0
            ? `상품 ${formatMoney(goods)}에서 쿠폰 ${formatMoney(coupon)}을 빼고, 처음 낸 배송비 ${formatMoney(outbound)}과 변심 반품 왕복 ${formatMoney(returnDelivery)}을 더해 ${formatMoney(total)}이 되었습니다.`
            : `상품 ${formatMoney(goods)}에 처음 낸 배송비 ${formatMoney(outbound)}과 변심 반품 왕복 ${formatMoney(returnDelivery)}을 더해 ${formatMoney(total)}이 되었습니다.`;
    } else if (returnDelivery > 0) {
        story = coupon > 0
            ? `상품 ${formatMoney(goods)}에서 쿠폰 ${formatMoney(coupon)}을 빼고, 변심 반품 배송비 ${formatMoney(returnDelivery)}을 더해 ${formatMoney(total)}이 되었습니다.`
            : `상품 ${formatMoney(goods)}에 변심 반품 배송비 ${formatMoney(returnDelivery)}을 더해 ${formatMoney(total)}이 되었습니다.`;
    } else if (coupon > 0 && outbound > 0) {
        story = `상품 ${formatMoney(goods)}에서 쿠폰 ${formatMoney(coupon)}을 빼고, 배송비 ${formatMoney(outbound)}을 더해 ${formatMoney(total)}이 되었습니다.`;
    } else if (coupon > 0) {
        story = `상품 ${formatMoney(goods)}에서 쿠폰 ${formatMoney(coupon)}을 빼 ${formatMoney(total)}이 되었습니다. 배송비는 없습니다.`;
    } else if (outbound > 0) {
        story = `상품 ${formatMoney(goods)}에 배송비 ${formatMoney(outbound)}을 더해 ${formatMoney(total)}이 되었습니다.`;
    } else {
        story = `상품 ${formatMoney(goods)}만 결제했고 배송비는 없습니다.`;
    }

    return {
        total,
        formula: `${bits.join(" ")} = ${formatMoney(total)}`,
        story,
    };
}

type ClaimCause = "change_of_mind" | "defect";
type ClaimReasonItem = { code: string; label: string; cause: ClaimCause };
type ClaimPolicy = {
    photoMin: number;
    photoMax: number;
    mindConfirmRequired: boolean;
    mindNotice: string;
    defectPhotoNotice: string;
    reasons: { change_of_mind: ClaimReasonItem[]; defect: ClaimReasonItem[] };
};

const FALLBACK_REASONS: ClaimPolicy["reasons"] = {
    change_of_mind: [
        { code: "mind_simple", cause: "change_of_mind", label: "단순 변심 (필요 없어짐)" },
        { code: "mind_wrong_order", cause: "change_of_mind", label: "다른 상품·옵션을 잘못 주문함" },
        { code: "mind_size_color", cause: "change_of_mind", label: "사이즈·색상·디자인이 생각과 다름" },
        { code: "mind_cheaper", cause: "change_of_mind", label: "다른 곳에서 더 저렴한 상품을 발견함" },
        { code: "mind_delay", cause: "change_of_mind", label: "배송이 너무 늦어짐" },
    ],
    defect: [
        { code: "defect_broken", cause: "defect", label: "상품 불량·고장" },
        { code: "defect_damaged", cause: "defect", label: "배송 중 파손" },
        { code: "defect_wrong_item", cause: "defect", label: "오배송 (다른 상품이 옴)" },
        { code: "defect_missing", cause: "defect", label: "구성품·부품 누락" },
        { code: "defect_mismatch", cause: "defect", label: "상세페이지 설명과 다름" },
        { code: "defect_expired", cause: "defect", label: "유통기한 경과·임박" },
    ],
};

type ClaimShippingQuote = {
    allowed: boolean;
    message: string;
    oneWay: number;
    roundTrip: number;
    emergingOutbound: number;
    buyerCharge: number;
    prepaid: number;
    netRefund: number;
    depositDue: number;
};

type ClaimOrderResponse = {
    ok: boolean;
    statusLabel?: string;
    message?: string;
    shipping?: ClaimShippingQuote;
};

type ConfirmOrderResponse = {
    ok: boolean;
    status?: number;
    statusLabel?: string;
    message?: string;
};

function formatAddress(order: NonNullable<OrderDetailResponse["order"]>) {
    const line = String(order.addressLine ?? "").trim();
    if (line) return line;

    return [order.postcode, order.address1, order.address2].filter(Boolean).join(" ").trim();
}

function toneByStatus(statusLabel: string) {
    return toneByOrderStatus(statusLabel);
}

function findGuestPhone(orderNum: string, tenant: string) {
    if (typeof window === "undefined") return "";

    const refs = loadGuestOrderRefs();
    const found = refs.find((row) => row.orderNum === orderNum && row.tenant === tenant);

    return String(found?.phone ?? "").replace(/[^\d]/g, "");
}

export default function OrderDetailPage() {
    const params = useParams<{ tenant: string; id: string }>();
    const router = useRouter();

    const tenant = String(params?.tenant ?? "").trim();
    const id = String(params?.id ?? "").trim();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [order, setOrder] = useState<OrderDetailResponse["order"] | null>(null);
    const [canceling, setCanceling] = useState(false);
    const [itemActionId, setItemActionId] = useState("");
    const [claimModal, setClaimModal] = useState<{
        item: OrderDetailItem;
        type: "return" | "exchange";
    } | null>(null);
    const [claimCause, setClaimCause] = useState<ClaimCause | "">("");
    const [claimReasonCode, setClaimReasonCode] = useState("");
    const [claimDetail, setClaimDetail] = useState("");
    const [claimMindOk, setClaimMindOk] = useState(false);
    const [claimPhotos, setClaimPhotos] = useState<string[]>([]);
    const [claimPolicy, setClaimPolicy] = useState<ClaimPolicy | null>(null);
    const [claimUploading, setClaimUploading] = useState(false);
    const [claimPreview, setClaimPreview] = useState<ClaimShippingQuote | null>(null);
    const [claimPreviewLoading, setClaimPreviewLoading] = useState(false);
    const [isGuestMode, setIsGuestMode] = useState(false);
    const [guestPhone, setGuestPhone] = useState("");
    const [showTimeline, setShowTimeline] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!tenant || !id) {
                setError("주문 정보가 올바르지 않습니다.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const localGuestPhone = findGuestPhone(id, tenant);
                if (!cancelled) {
                    setGuestPhone(localGuestPhone);
                }

                let res = await fetch(endpoints.myOrderDetail(tenant, id), {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        ...tenantHeader(tenant),
                    },
                });

                if (res.status === 401 && localGuestPhone) {
                    setIsGuestMode(true);
                    res = await fetch(endpoints.guestOrderDetail(tenant, id, localGuestPhone), {
                        method: "GET",
                        credentials: "include",
                        cache: "no-store",
                        headers: {
                            Accept: "application/json",
                            ...tenantHeader(tenant),
                        },
                    });
                } else {
                    setIsGuestMode(false);
                }

                const json = (await res.json().catch(() => null)) as OrderDetailResponse | null;
                if (cancelled) return;

                if (!res.ok || !json?.ok || !json?.order) {
                    setOrder(null);
                    setError(json?.message || "주문 정보를 불러오지 못했습니다.");
                    return;
                }

                setOrder(json.order);
            } catch {
                if (!cancelled) {
                    setOrder(null);
                    setError("주문 정보를 불러오는 중 오류가 발생했습니다.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [tenant, id]);

    async function reloadOrder() {
        const res = await fetch(endpoints.myOrderDetail(tenant, id), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
                Accept: "application/json",
                ...tenantHeader(tenant),
            },
        });
        const json = (await res.json().catch(() => null)) as OrderDetailResponse | null;
        if (res.ok && json?.ok && json.order) {
            setOrder(json.order);
        }
    }

    async function handleItemCancel(item: OrderDetailItem) {
        if (!order?.orderNum || itemActionId) return;

        const ok = window.confirm("선택한 상품 주문을 취소할까요?");
        if (!ok) return;

        try {
            setItemActionId(item.id);
            const res = await fetch(endpoints.cancelOrderItem(tenant, order.orderNum, item.id), {
                method: "POST",
                credentials: "include",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                    ...tenantHeader(tenant),
                },
            });
            const json = (await res.json().catch(() => null)) as CancelOrderResponse | null;
            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "상품 취소에 실패했습니다.");
            }
            alert(json.message || "상품의 주문이 취소 되었습니다.");
            await reloadOrder();
        } catch (e: any) {
            alert(e?.message || "상품 취소 처리 중 오류가 발생했습니다.");
        } finally {
            setItemActionId("");
        }
    }

    async function handleItemCancelRequest(item: OrderDetailItem) {
        if (!order?.orderNum || itemActionId) return;

        const reason = window.prompt("취소 사유를 입력해 주세요.");
        if (!reason?.trim()) return;

        try {
            setItemActionId(item.id);
            const res = await fetch(
                endpoints.cancelOrderItemRequest(tenant, order.orderNum, item.id),
                {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        ...tenantHeader(tenant),
                    },
                    body: JSON.stringify({ reason: reason.trim() }),
                }
            );
            const json = (await res.json().catch(() => null)) as CancelOrderResponse | null;
            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "취소요청 접수에 실패했습니다.");
            }
            alert(json.message || "상품 취소 요청이 접수 되었습니다.");
            await reloadOrder();
        } catch (e: any) {
            alert(e?.message || "취소요청 처리 중 오류가 발생했습니다.");
        } finally {
            setItemActionId("");
        }
    }

    async function handleItemCancelWithdraw(item: OrderDetailItem) {
        if (!order?.orderNum || itemActionId) return;

        const ok = window.confirm("취소요청을 철회할까요?");
        if (!ok) return;

        try {
            setItemActionId(item.id);
            const res = await fetch(
                endpoints.withdrawCancelOrderItemRequest(tenant, order.orderNum, item.id),
                {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        ...tenantHeader(tenant),
                    },
                }
            );
            const json = (await res.json().catch(() => null)) as CancelOrderResponse | null;
            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "취소요청 철회에 실패했습니다.");
            }
            alert(json.message || "취소철회 처리가 되었습니다.");
            await reloadOrder();
        } catch (e: any) {
            alert(e?.message || "취소요청 철회 중 오류가 발생했습니다.");
        } finally {
            setItemActionId("");
        }
    }

    async function handleCancel() {
        if (!order?.orderNum || canceling) return;

        const ok = window.confirm("주문을 취소할까요?");
        if (!ok) return;

        try {
            setCanceling(true);

            let res: Response;

            if (isGuestMode) {
                res = await fetch(endpoints.guestCancelOrder(tenant, order.orderNum), {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        ...tenantHeader(tenant),
                    },
                    body: JSON.stringify({ phone: guestPhone }),
                });
            } else {
                res = await fetch(endpoints.cancelOrder(tenant, order.orderNum), {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        ...tenantHeader(tenant),
                    },
                });
            }

            const json = (await res.json().catch(() => null)) as CancelOrderResponse | null;

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || `주문취소 실패 (HTTP ${res.status})`);
            }

            router.replace(`/${tenant}/orders?highlight=${encodeURIComponent(order.orderNum)}`);
            router.refresh();
        } catch (e: any) {
            alert(e?.message || "주문취소 처리 중 오류가 발생했습니다.");
        } finally {
            setCanceling(false);
        }
    }

    async function handleItemClaimWithdraw(item: OrderDetailItem) {
        if (!order?.orderNum || itemActionId) return;

        const ok = window.confirm("교환·반품 요청을 철회할까요?");
        if (!ok) return;

        try {
            setItemActionId(item.id);
            const res = await fetch(
                endpoints.withdrawClaimOrderItem(tenant, order.orderNum, item.id),
                {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        ...tenantHeader(tenant),
                    },
                }
            );
            const json = (await res.json().catch(() => null)) as ClaimOrderResponse | null;
            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "요청 철회에 실패했습니다.");
            }
            alert(json.message || "철회 처리가 되었습니다.");
            await reloadOrder();
        } catch (e: any) {
            alert(e?.message || "요청 철회 중 오류가 발생했습니다.");
        } finally {
            setItemActionId("");
        }
    }

    async function handleItemConfirm(item: OrderDetailItem) {
        if (!order?.orderNum || itemActionId || isGuestMode) return;

        const ok = window.confirm("이 상품을 구매 확정할까요?");
        if (!ok) return;

        try {
            setItemActionId(item.id);
            const res = await fetch(endpoints.confirmOrderItem(tenant, order.orderNum, item.id), {
                method: "POST",
                credentials: "include",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                    ...tenantHeader(tenant),
                },
            });
            const json = (await res.json().catch(() => null)) as ConfirmOrderResponse | null;
            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "구매확정에 실패했습니다.");
            }
            alert(json.message || "구매확정이 완료되었습니다.");
            await reloadOrder();
        } catch (e: any) {
            alert(e?.message || "구매확정 처리 중 오류가 발생했습니다.");
        } finally {
            setItemActionId("");
        }
    }

    function openClaimModal(item: OrderDetailItem, type: "return" | "exchange") {
        if (!order?.orderNum || itemActionId) return;
        setClaimModal({ item, type });
        setClaimCause("");
        setClaimReasonCode("");
        setClaimDetail("");
        setClaimMindOk(false);
        setClaimPhotos([]);
        setClaimPreview(null);
        void loadClaimPolicy();
    }

    async function loadClaimPolicy() {
        try {
            const res = await fetch(endpoints.claimPolicy(tenant), {
                credentials: "include",
                cache: "no-store",
                headers: { Accept: "application/json", ...tenantHeader(tenant) },
            });
            const json = (await res.json().catch(() => null)) as { ok?: boolean; policy?: ClaimPolicy } | null;
            if (json?.ok && json.policy) setClaimPolicy(json.policy);
        } catch {
            /* 기본 안내로 진행 */
        }
    }

    async function loadClaimPreview(item: OrderDetailItem, type: "return" | "exchange", cause: ClaimCause) {
        if (!order?.orderNum) return;
        setClaimPreviewLoading(true);
        try {
            const res = await fetch(endpoints.previewClaimOrderItem(tenant, order.orderNum, item.id), {
                method: "POST",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...tenantHeader(tenant),
                },
                body: JSON.stringify({ type, cause }),
            });
            const json = (await res.json().catch(() => null)) as ClaimOrderResponse | null;
            if (res.status === 404) {
                throw new Error("반품·교환 배송비 계산 기능이 아직 서버에 없습니다. 잠시 후 다시 시도해 주세요.");
            }
            if (!res.ok || !json?.ok || !json.shipping) {
                throw new Error(json?.message || "배송비를 계산하지 못했습니다.");
            }
            setClaimPreview(json.shipping);
        } catch (e: any) {
            setClaimPreview(null);
            alert(e?.message || "배송비 미리보기에 실패했습니다.");
        } finally {
            setClaimPreviewLoading(false);
        }
    }

    async function handleClaimPhotoUpload(fileList: FileList | null) {
        if (!fileList?.length) return;
        const max = claimPolicy?.photoMax ?? 5;
        if (claimPhotos.length >= max) {
            alert(`사진은 최대 ${max}장까지 올릴 수 있습니다.`);
            return;
        }
        setClaimUploading(true);
        try {
            const next = [...claimPhotos];
            for (const file of Array.from(fileList)) {
                if (next.length >= max) break;
                if (file.type && !file.type.startsWith("image/")) continue;
                const packed = await compressImageForClaim(file);
                const body = new FormData();
                body.append("file", packed);
                const res = await fetch(endpoints.claimPhotos(tenant), {
                    method: "POST",
                    credentials: "include",
                    headers: { ...tenantHeader(tenant) },
                    body,
                });
                const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; path?: string; message?: string } | null;
                if (!res.ok || !json?.ok) {
                    throw new Error(json?.message || "사진 업로드에 실패했습니다.");
                }
                next.push(json.url || `/${json.path || ""}`);
            }
            setClaimPhotos(next);
        } catch (e: any) {
            alert(e?.message || "사진 업로드 중 오류가 발생했습니다.");
        } finally {
            setClaimUploading(false);
        }
    }

    function handleRemoveClaimPhoto(src: string) {
        setClaimPhotos((prev) => prev.filter((item) => item !== src));
    }

    async function handleItemClaim() {
        if (!order?.orderNum || !claimModal || !claimCause || itemActionId) return;
        const { item, type } = claimModal;
        const label = type === "return" ? "반품" : "교환";
        if (!claimReasonCode) {
            alert("상세 사유를 선택해 주세요.");
            return;
        }
        if (claimCause === "change_of_mind" && (claimPolicy?.mindConfirmRequired ?? true) && !claimMindOk) {
            alert("변심 반품·교환은 상품이 사용하지 않은 완전한 상태임을 확인해 주세요.");
            return;
        }
        if (claimCause === "defect" && claimPhotos.length < (claimPolicy?.photoMin ?? 1)) {
            alert(`하자 증빙 사진을 ${claimPolicy?.photoMin ?? 1}장 이상 올려 주세요.`);
            return;
        }
        if (claimPreview && !claimPreview.allowed) {
            alert(claimPreview.message || "지금은 요청할 수 없습니다.");
            return;
        }

        try {
            setItemActionId(item.id);
            const res = await fetch(endpoints.claimOrderItem(tenant, order.orderNum, item.id), {
                method: "POST",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...tenantHeader(tenant),
                },
                body: JSON.stringify({
                    type,
                    cause: claimCause,
                    reasonCode: claimReasonCode,
                    reason: claimDetail,
                    photos: claimPhotos,
                    mindConfirmed: claimMindOk,
                }),
            });
            const json = (await res.json().catch(() => null)) as ClaimOrderResponse | null;
            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || `${label} 요청에 실패했습니다.`);
            }
            alert(json.message || `${label} 요청이 접수되었습니다.`);
            setClaimModal(null);
            await reloadOrder();
        } catch (e: any) {
            alert(e?.message || `${label} 요청 중 오류가 발생했습니다.`);
        } finally {
            setItemActionId("");
        }
    }

    const tone = useMemo(
        () => toneByStatus(order?.displayStatus || order?.statusLabel || ""),
        [order?.displayStatus, order?.statusLabel]
    );

    const headerStatusText = order?.displayStatus || order?.statusLabel || "주문상세";
    const claimPhotoMin = claimPolicy?.photoMin ?? 1;
    const claimPhotoRequired = claimCause === "defect";
    const claimMindRequired =
        claimCause === "change_of_mind" && (claimPolicy?.mindConfirmRequired ?? true);
    const claimSubmitReady =
        Boolean(claimCause) &&
        Boolean(claimReasonCode) &&
        (!claimMindRequired || claimMindOk) &&
        (!claimPhotoRequired || claimPhotos.length >= claimPhotoMin) &&
        itemActionId === "" &&
        !(claimPreview && !claimPreview.allowed);
    const claimSubmitHint = !claimCause
        ? "변심 또는 하자·오배송을 선택해 주세요."
        : !claimReasonCode
          ? "상세 사유를 선택해 주세요."
          : claimMindRequired && !claimMindOk
            ? "상품 상태 확인에 체크해 주세요."
            : claimPhotoRequired && claimPhotos.length < claimPhotoMin
              ? `증빙 사진을 ${claimPhotoMin}장 이상 올려 주세요.`
              : claimPreview && !claimPreview.allowed
                ? claimPreview.message || "지금은 요청할 수 없습니다."
                : "";

    if (loading) {
        return (
            <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-sm">
                    주문 정보를 불러오는 중입니다.
                </div>
            </main>
        );
    }

    if (!order) {
        return (
            <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
                <div className="mb-3 flex items-center justify-between">
                    <Link
                        href={`/${tenant}/orders`}
                        className="rounded-xl border px-3 py-2 text-sm font-extrabold"
                    >
                        ← 주문내역
                    </Link>

                    <div className="text-sm font-extrabold">주문상세</div>

                    <div className="w-[78px]" />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <div className="text-[15px] font-extrabold text-slate-900">
                        주문 정보를 찾을 수 없습니다.
                    </div>
                    {error ? (
                        <div className="mt-2 text-xs font-semibold text-slate-500">{error}</div>
                    ) : null}
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
            <div className="mb-3 flex items-center justify-between">
                <Link
                    href={`/${tenant}/orders`}
                    className="rounded-xl border px-3 py-2 text-sm font-extrabold"
                >
                    ← 주문내역
                </Link>

                <div className="text-sm font-extrabold">주문상세</div>

                <div className="w-[78px]" />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-slate-500">주문번호</div>
                        <div className="mt-1 break-all text-[15px] font-extrabold text-slate-900">
                            {order.orderNum}
                        </div>
                    </div>

                    <span
                        className={[
                            "inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-extrabold",
                            tone,
                        ].join(" ")}
                    >
                        {headerStatusText}
                    </span>
                </div>

                {Number(order.couponTotal ?? 0) > 0 ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-bold text-rose-700">
                        사용 쿠폰:{" "}
                        {(order.coupons ?? []).filter((c) => Number(c.amount) > 0).length > 0
                            ? (order.coupons ?? [])
                                  .filter((c) => Number(c.amount) > 0)
                                  .map((c) => `${c.name} (−${formatMoney(c.amount)})`)
                                  .join(" / ")
                            : `쿠폰 할인 (−${formatMoney(Number(order.couponTotal))})`}
                    </div>
                ) : null}

                {order.badgeText ? (
                    <div className="mt-3 inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700">
                        {order.badgeText}
                    </div>
                ) : null}

                <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">주문일시</span>
                        <span className="text-right font-bold text-slate-900">
                            {formatDateTime(order.createdAt)}
                        </span>
                    </div>

                    {/* 줍줍은 배송 전용, 정책 변경 대비 보존 — "픽업 일자" 행 노출 중단
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">픽업 일자</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.pickupDateText && order.pickupDateText.trim()
                                ? order.pickupDateText
                                : "-"}
                        </span>
                    </div>
                    */}

                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">상태 변경일시</span>
                        <span className="text-right font-bold text-slate-900">
                            {formatDateTime(order.statusDate)}
                        </span>
                    </div>

                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">결제 방식</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.payTypeLabel || (order.isOnlinePrepaid ? "온라인 결제" : "-")}
                        </span>
                    </div>

                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">결제 상태</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.payStatusLabel || "-"}
                        </span>
                    </div>
                </div>

                {order.statusNotice ? (
                    <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-[13px] font-bold leading-5 text-amber-950">
                        {order.statusNotice}
                    </div>
                ) : null}

                {order.footerText ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-[14px] font-bold text-slate-700">
                        {order.footerText}
                    </div>
                ) : null}

                {order.canCancel ? (
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={canceling}
                        className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-[14px] font-extrabold text-rose-600 disabled:opacity-50"
                    >
                        {canceling
                            ? "처리 중..."
                            : (order.activeItemCount ?? 1) > 1
                              ? "전체 주문 취소"
                              : "주문 취소"}
                    </button>
                ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">주문자 정보</div>

                <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">주문자</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.buyerName || "-"}
                        </span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">연락처</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.buyerPhone || "-"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">배송지</div>

                <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">수령인</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.receiverName || "-"}
                        </span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">연락처</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.receiverPhone || "-"}
                        </span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-[12px] font-semibold text-slate-500">주소</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                            {formatAddress(order) || "-"}
                        </div>
                    </div>
                </div>

                {order.message ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                        <div className="text-[12px] font-semibold text-slate-500">요청사항</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                            {order.message}
                        </div>
                    </div>
                ) : null}

                {order.memo ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                        <div className="text-[12px] font-semibold text-slate-500">메모</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                            {order.memo}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">주문 상품</div>

                <div className="mt-4 space-y-3">
                    {order.items.map((item, idx) => {
                        const itemStatus = item.displayStatus || item.statusLabel || "";
                        const itemTone = toneByStatus(itemStatus);
                        const itemBusy = itemActionId === item.id;

                        return (
                        <div
                            key={`${item.id}_${idx}`}
                            className="rounded-xl border border-slate-200 p-3"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                <div className="line-clamp-2 font-extrabold text-slate-900">
                                    {item.title}
                                </div>

                                {item.optionName && item.optionName.trim() !== item.title.trim() ? (
                                    <div className="mt-1 text-[12px] font-semibold text-slate-500">
                                        옵션: {item.optionName}
                                    </div>
                                ) : null}

                                {item.goodsCode ? (
                                    <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                        상품코드: {item.goodsCode}
                                    </div>
                                ) : null}

                                <div className="mt-3 flex items-center justify-between text-sm">
                                    <span className="font-semibold text-slate-500">{item.qty}개</span>
                                    <span className="font-extrabold text-slate-900">
                                        {formatMoney(item.price * item.qty)}
                                    </span>
                                </div>
                                </div>

                                {itemStatus ? (
                                    <span
                                        className={[
                                            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                                            itemTone,
                                        ].join(" ")}
                                    >
                                        {itemStatus}
                                    </span>
                                ) : null}
                            </div>

                            {item.canTrackDelivery &&
                            item.deliveryTrackUrl &&
                            item.deliveryInvoiceNo ? (
                                <div className="mt-3 space-y-2">
                                    {item.deliveryCarrierName || item.deliveryInvoiceNo ? (
                                        <div className="text-[12px] font-semibold text-slate-500">
                                            {[item.deliveryCarrierName, item.deliveryInvoiceNo]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </div>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const url = `${item.deliveryTrackUrl}${item.deliveryInvoiceNo}`;
                                            window.open(url, "_blank", "noopener,noreferrer");
                                        }}
                                        className="flex h-10 w-full items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-[13px] font-extrabold text-sky-700"
                                    >
                                        배송조회
                                    </button>
                                </div>
                            ) : null}

                            {item.canCancelImmediate ? (
                                <button
                                    type="button"
                                    onClick={() => handleItemCancel(item)}
                                    disabled={itemBusy}
                                    className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-extrabold text-rose-600 disabled:opacity-50"
                                >
                                    {itemBusy ? "처리 중..." : "상품 취소"}
                                </button>
                            ) : null}

                            {item.canCancelRequest ? (
                                <button
                                    type="button"
                                    onClick={() => handleItemCancelRequest(item)}
                                    disabled={itemBusy}
                                    className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-rose-200 bg-white text-[13px] font-extrabold text-rose-600 disabled:opacity-50"
                                >
                                    {itemBusy ? "처리 중..." : "취소 요청"}
                                </button>
                            ) : null}

                            {item.canWithdrawCancelRequest ? (
                                <button
                                    type="button"
                                    onClick={() => handleItemCancelWithdraw(item)}
                                    disabled={itemBusy}
                                    className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-[13px] font-extrabold text-slate-700 disabled:opacity-50"
                                >
                                    {itemBusy ? "처리 중..." : "취소요청 철회"}
                                </button>
                            ) : null}

                            {item.canConfirm ? (
                                <button
                                    type="button"
                                    onClick={() => handleItemConfirm(item)}
                                    disabled={itemBusy}
                                    className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-emerald-600 text-[13px] font-extrabold text-white disabled:opacity-50"
                                >
                                    {itemBusy ? "처리 중..." : "구매확정"}
                                </button>
                            ) : null}

                            {item.canExchange ? (
                                <button
                                    type="button"
                                    onClick={() => openClaimModal(item, "exchange")}
                                    disabled={itemBusy}
                                    className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-[13px] font-extrabold text-sky-700 disabled:opacity-50"
                                >
                                    {itemBusy ? "처리 중..." : "교환 요청"}
                                </button>
                            ) : null}

                            {item.canReturn ? (
                                <button
                                    type="button"
                                    onClick={() => openClaimModal(item, "return")}
                                    disabled={itemBusy}
                                    className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-[13px] font-extrabold text-violet-700 disabled:opacity-50"
                                >
                                    {itemBusy ? "처리 중..." : "반품 요청"}
                                </button>
                            ) : null}

                            {item.canWithdrawClaimRequest ? (
                                <button
                                    type="button"
                                    onClick={() => handleItemClaimWithdraw(item)}
                                    disabled={itemBusy}
                                    className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-[13px] font-extrabold text-slate-700 disabled:opacity-50"
                                >
                                    {itemBusy ? "처리 중..." : "교환·반품 요청 철회"}
                                </button>
                            ) : null}

                            {item.claimUid ? (
                                <Link
                                    href={`/${tenant}/claims/${item.claimUid}`}
                                    className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-[13px] font-extrabold text-slate-600"
                                >
                                    신청 상세 보기
                                </Link>
                            ) : null}
                        </div>
                        );
                    })}
                </div>

                {(() => {
                    const goodsAmount = Number(
                        order.goodsTotal ??
                            Math.max(
                                0,
                                Number(order.totalAmount ?? 0) - Number(order.deliveryTotal ?? 0)
                            )
                    );
                    const deliveryAmount = Number(order.deliveryTotal ?? 0);
                    const returnDelivery = Number(order.returnDelivery ?? 0);
                    const outboundDelivery = Number(
                        order.outboundDelivery ?? Math.max(0, deliveryAmount - returnDelivery)
                    );
                    const couponTotal = Number(order.couponTotal ?? 0);
                    const couponRows = (order.coupons ?? []).filter(
                        (c) => Number(c.amount ?? 0) > 0
                    );
                    const canceledSum =
                        Number(order.cancelTotal ?? 0) + Number(order.refundTotal ?? 0);
                    const allCanceled =
                        Number(order.totalItemCount ?? 0) > 0 &&
                        Number(order.activeItemCount ?? 0) === 0;
                    const gross = Math.max(0, goodsAmount + deliveryAmount - couponTotal);
                    const displayCancel = allCanceled
                        ? Math.max(canceledSum, gross)
                        : canceledSum;
                    const displayPay = allCanceled
                        ? 0
                        : Math.max(0, Number(order.totalAmount ?? 0) - displayCancel);
                    const payExplain = buildOrderPayExplain({
                        goods: goodsAmount,
                        outbound: outboundDelivery,
                        returnDelivery,
                        coupon: couponTotal,
                    });
                    const remainingAmount = Math.max(
                        0,
                        Number(order.remainingAmount ?? displayPay)
                    );
                    let extraStory = "";
                    if (order.shippingOnlyRemaining) {
                        extraStory =
                            returnDelivery > 0
                                ? `반품이 끝나 상품 ${formatMoney(goodsAmount)}은 환불됩니다. 처음 낸 배송비 ${formatMoney(outboundDelivery)}과 변심 반품 왕복 ${formatMoney(returnDelivery)}은 환불되지 않아, 남은 금액은 ${formatMoney(remainingAmount)}입니다.`
                                : `반품이 끝나 상품 ${formatMoney(goodsAmount)}은 환불되고, 처음에 낸 배송비 ${formatMoney(deliveryAmount)}은 환불되지 않습니다. 그래서 남은 금액은 ${formatMoney(remainingAmount)}입니다.`;
                    } else if (displayCancel > 0 && displayPay !== payExplain.total) {
                        extraStory = `원래 ${formatMoney(payExplain.total)}에서 취소·환불 ${formatMoney(displayCancel)}을 빼면 지금 금액은 ${formatMoney(displayPay)}입니다.`;
                    }

                    return (
                        <>
                            <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-sm">
                                <span className="font-semibold text-slate-500">상품 금액</span>
                                <span className="font-bold text-slate-900">
                                    {formatMoney(goodsAmount)}
                                </span>
                            </div>

                            {couponRows.length > 0
                                ? couponRows.map((c, i) => (
                                      <div
                                          key={`${c.kind}_${i}`}
                                          className="mt-2 flex justify-between gap-3 text-sm"
                                      >
                                          <span className="font-semibold text-rose-600">
                                              {c.name || "쿠폰"}
                                          </span>
                                          <span className="shrink-0 font-bold text-rose-600">
                                              -{formatMoney(c.amount)}
                                          </span>
                                      </div>
                                  ))
                                : couponTotal > 0
                                  ? (
                                        <div className="mt-2 flex justify-between text-sm">
                                            <span className="font-semibold text-rose-600">
                                                쿠폰 할인
                                            </span>
                                            <span className="font-bold text-rose-600">
                                                -{formatMoney(couponTotal)}
                                            </span>
                                        </div>
                                    )
                                  : null}

                            {returnDelivery > 0 ? (
                                <>
                                    <div className="mt-2 flex justify-between text-sm">
                                        <span className="font-semibold text-slate-500">
                                            처음 낸 배송비
                                        </span>
                                        <span className="font-bold text-slate-900">
                                            {outboundDelivery > 0
                                                ? formatMoney(outboundDelivery)
                                                : "무료"}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex justify-between text-sm">
                                        <span className="font-semibold text-slate-500">
                                            반품 배송비(왕복)
                                        </span>
                                        <span className="font-bold text-slate-900">
                                            {formatMoney(returnDelivery)}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="mt-2 flex justify-between text-sm">
                                    <span className="font-semibold text-slate-500">배송비</span>
                                    <span className="font-bold text-slate-900">
                                        {deliveryAmount > 0
                                            ? formatMoney(deliveryAmount)
                                            : "무료"}
                                    </span>
                                </div>
                            )}

                            {displayCancel > 0 ? (
                                <div className="mt-2 flex justify-between text-sm">
                                    <span className="font-semibold text-slate-500">취소 금액</span>
                                    <span className="font-bold text-rose-600">
                                        {formatMoney(displayCancel)}
                                    </span>
                                </div>
                            ) : null}

                            <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-base font-extrabold">
                                <span className="text-slate-900">
                                    {order.isOnlinePrepaid
                                        ? "총 결제 금액"
                                        : "총 결제 예정 금액"}
                                </span>
                                <span className="text-slate-900">
                                    {formatMoney(displayPay)}
                                </span>
                            </div>

                            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3">
                                <div className="text-[13px] font-extrabold tracking-tight text-slate-900">
                                    {payExplain.formula}
                                </div>
                                <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-600">
                                    {payExplain.story}
                                </p>
                                {extraStory ? (
                                    <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-600">
                                        {extraStory}
                                    </p>
                                ) : null}
                            </div>

                            {order.shippingOnlyRemaining ? (
                                <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-[13px] font-bold leading-5 text-amber-950">
                                    {returnDelivery > 0
                                        ? `전체 반품이 완료되어 상품은 환불됩니다. 처음 낸 배송비 ${formatMoney(outboundDelivery)}과 변심 반품 왕복 ${formatMoney(returnDelivery)}은 환불되지 않습니다.`
                                        : `전체 반품이 완료되었으나 배송비 ${formatMoney(deliveryAmount)}은 환불 처리되지 않았습니다.`}{" "}
                                    환불이 필요하면 고객센터에 문의해 주세요.
                                </div>
                            ) : null}
                        </>
                    );
                })()}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[15px] font-extrabold text-slate-900">주문 처리 내역</div>
                        <div className="mt-1 text-[12px] font-semibold text-slate-500">
                            결제, 배송, 반품·교환 신청과 처리 결과를 주문 단위로 볼 수 있습니다.
                        </div>
                    </div>
                    {(order.timeline ?? []).length > 0 ? (
                        <button
                            type="button"
                            onClick={() => setShowTimeline((open) => !open)}
                            className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-extrabold text-slate-700"
                        >
                            {showTimeline ? "접기" : `더보기 (${(order.timeline ?? []).length}건)`}
                        </button>
                    ) : null}
                </div>
                {(order.timeline ?? []).length === 0 ? (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[13px] font-semibold text-slate-400">
                        아직 기록된 처리 내역이 없습니다.
                    </div>
                ) : showTimeline ? (
                    <ol className="mt-3 space-y-2">
                        {(order.timeline ?? []).map((entry) => (
                            <li
                                key={entry.id}
                                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-extrabold text-slate-900">
                                            {entry.label}
                                        </div>
                                        {entry.detail ? (
                                            <div className="mt-1 text-[12px] font-semibold leading-5 text-slate-600">
                                                {entry.detail}
                                            </div>
                                        ) : null}
                                        {entry.actor ? (
                                            <div className="mt-1 text-[11px] font-bold text-slate-400">
                                                {entry.actor}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="shrink-0 text-right text-[11px] font-bold text-slate-400">
                                        {formatDateTime(entry.at)}
                                        {entry.amount != null && entry.amount > 0 ? (
                                            <div className="mt-1 text-[12px] font-extrabold text-slate-700">
                                                {formatMoney(entry.amount)}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-[12px] font-semibold text-slate-400">
                        처리 로그는 더보기를 누르면 나옵니다.
                    </div>
                )}
            </div>

            {!order.isOnlinePrepaid ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700 shadow-sm">
                    이 주문은 온라인 선결제가 아닌{" "}
                    <span className="font-extrabold">매장 오프라인 결제</span> 방식입니다. 방문 후
                    현장에서 결제해 주세요.
                </div>
            ) : null}

            {claimModal ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
                    <div className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
                        <div className="text-[16px] font-extrabold text-slate-900">
                            {claimModal.type === "return" ? "반품 신청" : "교환 신청"}
                        </div>
                        <p className="mt-1 text-[13px] font-semibold text-slate-500">
                            {claimModal.item.title} · 변심은 편도×2, 하자·오배송은 구매자 0원
                        </p>
                        <div className="mt-3 text-[12px] font-extrabold text-slate-700">
                            신청 사유 <span className="text-rose-600">필수</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setClaimCause("change_of_mind");
                                    setClaimReasonCode("");
                                    setClaimMindOk(false);
                                    void loadClaimPreview(claimModal.item, claimModal.type, "change_of_mind");
                                }}
                                className={[
                                    "rounded-xl border px-3 py-3 text-[13px] font-extrabold",
                                    claimCause === "change_of_mind"
                                        ? "border-amber-400 bg-amber-50 text-amber-800"
                                        : "border-slate-200 bg-white text-slate-700",
                                ].join(" ")}
                            >
                                단순 변심
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setClaimCause("defect");
                                    setClaimReasonCode("");
                                    void loadClaimPreview(claimModal.item, claimModal.type, "defect");
                                }}
                                className={[
                                    "rounded-xl border px-3 py-3 text-[13px] font-extrabold",
                                    claimCause === "defect"
                                        ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                        : "border-slate-200 bg-white text-slate-700",
                                ].join(" ")}
                            >
                                하자·오배송
                            </button>
                        </div>
                        {claimCause ? (
                            <>
                            <div className="mt-3 text-[12px] font-extrabold text-slate-700">
                                상세 사유 <span className="text-rose-600">필수</span>
                            </div>
                            <select
                                value={claimReasonCode}
                                onChange={(e) => setClaimReasonCode(e.target.value)}
                                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800"
                            >
                                <option value="">상세 사유 선택</option>
                                {(claimPolicy?.reasons?.[claimCause] || FALLBACK_REASONS[claimCause]).map((row) => (
                                    <option key={row.code} value={row.code}>
                                        {row.label}
                                    </option>
                                ))}
                            </select>
                            </>
                        ) : null}
                        {claimCause === "change_of_mind" ? (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-semibold leading-5 text-amber-950">
                                {claimPolicy?.mindNotice ||
                                    "변심 반품은 상품이 사용하지 않은 완전한 상태로 돌아와야 합니다. 택·구성품이 없고 사용 흔적이 있으면 거절될 수 있습니다."}
                                <div className="mt-2 text-[12px] font-extrabold">
                                    상품 상태 확인 <span className="text-rose-600">필수</span>
                                </div>
                                <label className="mt-1 flex items-start gap-2 text-[13px] font-extrabold">
                                    <input
                                        type="checkbox"
                                        checked={claimMindOk}
                                        onChange={(e) => setClaimMindOk(e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    상품이 사용하지 않은 완전한 상태로 반송됨을 확인합니다.
                                </label>
                            </div>
                        ) : null}
                        {claimCause ? (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] font-semibold leading-5 text-emerald-950">
                                <div className="text-[13px] font-extrabold">
                                    증빙 사진{" "}
                                    {claimPhotoRequired ? (
                                        <span className="text-rose-600">필수 {claimPhotoMin}장</span>
                                    ) : (
                                        <span className="font-bold text-emerald-800">선택</span>
                                    )}
                                </div>
                                <p className="mt-1">
                                    {claimCause === "defect"
                                        ? claimPolicy?.defectPhotoNotice ||
                                          "하자·파손·오배송이 보이는 사진을 올려 주세요."
                                        : "상품 상태를 확인할 수 있는 사진을 올리면 처리가 빨라집니다."}
                                </p>
                                <label className="mt-3 flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-emerald-700 text-[13px] font-extrabold text-white">
                                    {claimUploading ? "올리는 중..." : "사진 선택하기"}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => {
                                            void handleClaimPhotoUpload(e.target.files);
                                            e.target.value = "";
                                        }}
                                    />
                                </label>
                                {claimPhotos.length ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {claimPhotos.map((src) => (
                                            <div key={src} className="relative h-16 w-16">
                                                <img
                                                    src={claimPhotoSrc(src)}
                                                    alt=""
                                                    className="h-16 w-16 rounded-lg object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveClaimPhoto(src)}
                                                    aria-label="사진 삭제"
                                                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[13px] font-extrabold leading-none text-white shadow"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        className={[
                                            "mt-2 text-[12px] font-bold",
                                            claimPhotoRequired ? "text-rose-600" : "text-emerald-800",
                                        ].join(" ")}
                                    >
                                        {claimPhotoRequired
                                            ? `아직 선택한 사진이 없습니다. ${claimPhotoMin}장 이상 올려야 요청할 수 있습니다.`
                                            : "아직 선택한 사진이 없습니다. 없어도 요청할 수 있습니다."}
                                    </div>
                                )}
                            </div>
                        ) : null}
                        <textarea
                            value={claimDetail}
                            onChange={(e) => setClaimDetail(e.target.value)}
                            placeholder="기타사항 · 선택"
                            className="mt-3 h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-800"
                        />
                        <div className="mt-3 min-h-[72px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] font-semibold text-slate-700">
                            {claimPreviewLoading
                                ? "배송비를 계산하는 중..."
                                : claimPreview
                                  ? (
                                        <>
                                            <div>{claimPreview.message}</div>
                                            {claimModal.type === "return" && claimPreview.buyerCharge > 0 ? (
                                                <div className="mt-1 text-slate-500">
                                                    예상 환불 {formatMoney(claimPreview.netRefund)}
                                                    {claimPreview.depositDue > 0
                                                        ? ` · 부족분 ${formatMoney(claimPreview.depositDue)} 입금 후 완료`
                                                        : ""}
                                                </div>
                                            ) : null}
                                            {claimModal.type === "exchange" && claimPreview.prepaid > 0 ? (
                                                <div className="mt-1 text-amber-700">
                                                    재발송 전 왕복 {formatMoney(claimPreview.prepaid)} 선결제
                                                </div>
                                            ) : null}
                                        </>
                                    )
                                  : "사유를 선택하면 배송비가 나옵니다."}
                        </div>
                        <div className="mt-3 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setClaimModal(null)}
                                className="h-11 flex-1 rounded-xl border border-slate-300 text-[13px] font-extrabold text-slate-700"
                            >
                                닫기
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleItemClaim()}
                                disabled={!claimSubmitReady}
                                className="h-11 flex-1 rounded-xl bg-slate-900 text-[13px] font-extrabold text-white disabled:opacity-40"
                            >
                                {itemActionId ? "처리 중..." : "요청하기"}
                            </button>
                        </div>
                        {!claimSubmitReady && claimSubmitHint ? (
                            <div className="mt-2 text-center text-[12px] font-bold text-rose-600">
                                {claimSubmitHint}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </main>
    );
}