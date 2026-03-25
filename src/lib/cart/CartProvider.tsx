// src/lib/cart/CartProvider.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    tenant?: string;
    thumbnailUrl?: string;
    optionId?: number | string;
    optionName?: string;
    rawOptionId?: number | string;
    qtyType?: number;
    stockQty?: number;
    soldout?: boolean;
    stockNote?: string;
    optionCode?: string;
};

type CartContextType = {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    addItems: (items: CartItem[]) => void;
    updateQuantity: (productId: string, quantity: number, optionKey?: string) => void;
    removeItem: (productId: string, optionKey?: string) => void;
    clear: () => void;
    totalPrice: number;
};

const CartContext = createContext<CartContextType | null>(null);

function toFiniteNumber(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function getOptionKey(item: Pick<CartItem, "optionId" | "optionName">) {
    if (item.optionId != null && String(item.optionId).trim() !== "") {
        return `id:${String(item.optionId)}`;
    }
    if (item.optionName != null && String(item.optionName).trim() !== "") {
        return `name:${String(item.optionName).trim()}`;
    }
    return "default";
}

function isSameCartItem(a: CartItem, b: CartItem) {
    return a.productId === b.productId && getOptionKey(a) === getOptionKey(b);
}

function getMaxSelectableQty(item?: Partial<CartItem>) {
    if (!item) return Number.POSITIVE_INFINITY;
    if (Number(item.qtyType ?? 1) === 1) return Number.POSITIVE_INFINITY;
    return Math.max(0, toFiniteNumber(item.stockQty, 0));
}

function clampQuantityByStock(item: CartItem, nextQty: number) {
    const safeNext = Math.max(0, toFiniteNumber(nextQty, 0));
    const maxQty = getMaxSelectableQty(item);

    if (maxQty === Number.POSITIVE_INFINITY) {
        return safeNext;
    }

    return Math.min(safeNext, maxQty);
}

function normalizeCartItem(raw: any): CartItem | null {
    if (!raw || raw.productId == null) return null;

    const item: CartItem = {
        productId: String(raw.productId),
        name: String(raw.name ?? ""),
        price: toFiniteNumber(raw.price, 0),
        quantity: Math.max(0, toFiniteNumber(raw.quantity, 0)),
        tenant: raw.tenant ? String(raw.tenant) : undefined,
        thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : undefined,
        optionId:
            raw.optionId != null && String(raw.optionId).trim() !== ""
                ? raw.optionId
                : undefined,
        optionName:
            raw.optionName != null && String(raw.optionName).trim() !== ""
                ? String(raw.optionName)
                : undefined,
        rawOptionId:
            raw.rawOptionId != null && String(raw.rawOptionId).trim() !== ""
                ? raw.rawOptionId
                : undefined,
        qtyType:
            raw.qtyType != null && Number.isFinite(Number(raw.qtyType))
                ? Number(raw.qtyType)
                : undefined,
        stockQty:
            raw.stockQty != null && Number.isFinite(Number(raw.stockQty))
                ? Number(raw.stockQty)
                : undefined,
        soldout: !!raw.soldout,
        stockNote: raw.stockNote ? String(raw.stockNote) : undefined,
        optionCode: raw.optionCode ? String(raw.optionCode) : undefined,
    };

    if (item.soldout) {
        item.quantity = 0;
    } else {
        item.quantity = clampQuantityByStock(item, item.quantity);
    }

    if (item.quantity <= 0) return null;
    return item;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("cart");
            if (!raw) return;

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                setItems([]);
                return;
            }

            const normalized = parsed
                .map((item) => normalizeCartItem(item))
                .filter(Boolean) as CartItem[];

            setItems(normalized);
        } catch {
            setItems([]);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(items));
    }, [items]);

    const addItem = (item: CartItem) => {
        const normalized = normalizeCartItem(item);
        if (!normalized || normalized.soldout) return;

        setItems((prev) => {
            const idx = prev.findIndex((p) => isSameCartItem(p, normalized));
            if (idx >= 0) {
                return prev
                    .map((p, i) => {
                        if (i !== idx) return p;

                        const merged: CartItem = {
                            ...p,
                            ...normalized,
                            quantity: clampQuantityByStock(
                                { ...p, ...normalized },
                                toFiniteNumber(p.quantity, 0) + toFiniteNumber(normalized.quantity, 0)
                            ),
                        };

                        return merged;
                    })
                    .filter((item) => Number(item.quantity ?? 0) > 0);
            }

            return [...prev, normalized];
        });
    };

    const addItems = (nextItems: CartItem[]) => {
        setItems((prev) => {
            let out = [...prev];

            for (const raw of nextItems) {
                const item = normalizeCartItem(raw);
                if (!item || item.soldout) continue;

                const idx = out.findIndex((p) => isSameCartItem(p, item));
                if (idx >= 0) {
                    out = out.map((p, i) => {
                        if (i !== idx) return p;

                        const merged: CartItem = {
                            ...p,
                            ...item,
                            quantity: clampQuantityByStock(
                                { ...p, ...item },
                                toFiniteNumber(p.quantity, 0) + toFiniteNumber(item.quantity, 0)
                            ),
                        };

                        return merged;
                    });
                } else {
                    out.push(item);
                }
            }

            return out.filter((item) => Number(item.quantity ?? 0) > 0);
        });
    };

    const updateQuantity = (productId: string, quantity: number, optionKey?: string) => {
        setItems((prev) =>
            prev
                .map((item) => {
                    const currentKey = getOptionKey(item);
                    if (item.productId !== productId) return item;
                    if ((optionKey ?? "default") !== currentKey) return item;
                    return {
                        ...item,
                        quantity: clampQuantityByStock(item, quantity),
                    };
                })
                .filter((item) => Number(item.quantity ?? 0) > 0)
        );
    };

    const removeItem = (productId: string, optionKey?: string) => {
        setItems((prev) =>
            prev.filter((item) => {
                const currentKey = getOptionKey(item);
                if (item.productId !== productId) return true;
                return (optionKey ?? "default") !== currentKey;
            })
        );
    };

    const clear = () => setItems([]);

    const totalPrice = useMemo(
        () => items.reduce((sum, i) => sum + toFiniteNumber(i.price, 0) * toFiniteNumber(i.quantity, 0), 0),
        [items]
    );

    return (
        <CartContext.Provider
            value={{ items, addItem, addItems, updateQuantity, removeItem, clear, totalPrice }}
        >
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used inside CartProvider");
    return ctx;
}