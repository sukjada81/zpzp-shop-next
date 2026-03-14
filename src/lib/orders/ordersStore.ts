// src/lib/orders/ordersStore.ts


export type OrderStatus = "주문완료" | "결제완료" | "픽업대기" | "픽업완료" | "취소";

export type OrderLine = {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    thumbnailUrl?: string;
};

export type OrderRecord = {
    orderNo: string;
    tenant: string;
    status: OrderStatus;
    title: string;
    totalPrice: number;
    createdAt: string;
    lines: OrderLine[];
};

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function formatKST(d: Date) {
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `${y}-${m}-${day} ${hh}:${mm}`;
}

function makeOrderNo() {
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
    return `orders:${tenant}`;
}

export function updateOrderStatus(
    tenant: string,
    orderNo: string,
    status: OrderStatus,
) {
    const orders = loadOrders(tenant);
    const updated = orders.map((o) => (o.orderNo === orderNo ? { ...o, status } : o));
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

    const normalizedLines = lines.map((line) => ({
        productId: String(line.productId),
        name: String(line.name ?? ""),
        price: Number(line.price ?? 0),
        quantity: Number(line.quantity ?? 0),
        thumbnailUrl: String(line.thumbnailUrl ?? ""),
    }));

    const record: OrderRecord = {
        orderNo: makeOrderNo(),
        tenant,
        status: "결제완료",
        title,
        totalPrice,
        createdAt: formatKST(new Date()),
        lines: normalizedLines,
    };

    const prev = loadOrders(tenant);
    saveOrders(tenant, [record, ...prev]);
    return record;
}

export function findOrder(tenant: string, orderNo: string): OrderRecord | null {
    const orders = loadOrders(tenant);
    return orders.find((o) => o.orderNo === orderNo) ?? null;
}

export function clearOrders(tenant: string) {
    if (typeof window === "undefined") return;
    localStorage.removeItem(storageKey(tenant));
}
