// src/lib/orders/ordersStore.ts

export type OrderStatus = "주문완료" | "결제완료" | "픽업대기" | "픽업완료" | "취소";

export type OrderLine = {
    productId: string;
    name: string;
    price: number;
    quantity: number;
};

export type OrderRecord = {
    orderNo: string;
    tenant: string;
    status: OrderStatus;
    title: string; // 대표 상품명
    totalPrice: number;
    createdAt: string; // "YYYY-MM-DD HH:mm"
    lines: OrderLine[];
};

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function formatKST(d: Date) {
    // 브라우저 로컬이 한국이라 가정 (지금 프로젝트 환경 기준)
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `${y}-${m}-${day} ${hh}:${mm}`;
}

function makeOrderNo() {
    // 예: 20260222-001530-4832
    const d = new Date();
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    return `${y}${m}${day}-${hh}${mm}${ss}-${rnd}`;
}

function storageKey(tenant: string) {
    // ✅ tenant별 주문 분리 (중요)
    return `orders:${tenant}`;
}

export function updateOrderStatus(
    tenant: string,
    orderNo: string,
    status: OrderStatus,
) {
    const orders = loadOrders(tenant);

    const updated = orders.map((o) =>
        o.orderNo === orderNo ? { ...o, status } : o
    );

    saveOrders(tenant, updated);
}

export function loadOrders(tenant: string): OrderRecord[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(storageKey(tenant));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as OrderRecord[]) : [];
    } catch {
        return [];
    }
}

export function saveOrders(tenant: string, orders: OrderRecord[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey(tenant), JSON.stringify(orders));
}

export function addOrder(tenant: string, lines: OrderLine[]): OrderRecord {
    const totalPrice = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

    const title =
        lines.length === 0
            ? "주문"
            : lines.length === 1
                ? lines[0].name
                : `${lines[0].name} 외 ${lines.length - 1}건`;

    const record: OrderRecord = {
        orderNo: makeOrderNo(),
        tenant,
        status: "결제완료",
        title,
        totalPrice,
        createdAt: formatKST(new Date()),
        lines,
    };

    const prev = loadOrders(tenant);
    saveOrders(tenant, [record, ...prev]); // 최신순
    return record;
}

export function findOrder(tenant: string, orderNo: string): OrderRecord | null {
    const orders = loadOrders(tenant);
    return orders.find((o) => o.orderNo === orderNo) ?? null;
}

