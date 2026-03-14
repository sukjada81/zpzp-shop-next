// src/lib/orders/guestOrderRefs.ts
export const GUEST_ORDER_STORAGE_KEY = "dad_guest_orders_v1";

export type GuestOrderRef = {
    tenant: string;
    orderNum: string;
    phone: string;
    buyerName: string;
    createdAt: string;
};

export function loadGuestOrderRefs(): GuestOrderRef[] {
    try {
        const raw = localStorage.getItem(GUEST_ORDER_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveGuestOrderRef(next: GuestOrderRef) {
    try {
        const prev = loadGuestOrderRefs().filter(
            (row) => !(row.tenant === next.tenant && row.orderNum === next.orderNum)
        );

        const merged = [next, ...prev].slice(0, 50);

        localStorage.setItem(GUEST_ORDER_STORAGE_KEY, JSON.stringify(merged));
    } catch {}
}