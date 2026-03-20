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

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("cart");
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setItems(parsed);
            }
        } catch {
            setItems([]);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(items));
    }, [items]);

    const addItem = (item: CartItem) => {
        setItems((prev) => {
            const idx = prev.findIndex((p) => isSameCartItem(p, item));
            if (idx >= 0) {
                return prev.map((p, i) =>
                    i === idx
                        ? {
                            ...p,
                            quantity: Number(p.quantity ?? 0) + Number(item.quantity ?? 0),
                        }
                        : p
                );
            }
            return [...prev, item];
        });
    };

    const addItems = (nextItems: CartItem[]) => {
        setItems((prev) => {
            let out = [...prev];

            for (const item of nextItems) {
                const idx = out.findIndex((p) => isSameCartItem(p, item));
                if (idx >= 0) {
                    out = out.map((p, i) =>
                        i === idx
                            ? {
                                ...p,
                                quantity: Number(p.quantity ?? 0) + Number(item.quantity ?? 0),
                            }
                            : p
                    );
                } else {
                    out.push(item);
                }
            }

            return out;
        });
    };

    const updateQuantity = (productId: string, quantity: number, optionKey?: string) => {
        setItems((prev) =>
            prev
                .map((item) => {
                    const currentKey = getOptionKey(item);
                    if (item.productId !== productId) return item;
                    if ((optionKey ?? "default") !== currentKey) return item;
                    return { ...item, quantity: Math.max(0, quantity) };
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
        () => items.reduce((sum, i) => sum + Number(i.price ?? 0) * Number(i.quantity ?? 0), 0),
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