"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type CartItem = {
    productId: string;
    name: string;
    price: number;
    quantity: number;
};

type CartContextType = {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    clear: () => void;
    totalPrice: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);

    // 최초 로딩 시 localStorage 복구
    useEffect(() => {
        const raw = localStorage.getItem("cart");
        if (raw) {
            setItems(JSON.parse(raw));
        }
    }, []);

    // 변경될 때 저장
    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(items));
    }, [items]);

    const addItem = (item: CartItem) => {
        setItems((prev) => {
            const existing = prev.find((p) => p.productId === item.productId);
            if (existing) {
                return prev.map((p) =>
                    p.productId === item.productId
                        ? { ...p, quantity: p.quantity + item.quantity }
                        : p
                );
            }
            return [...prev, item];
        });
    };

    const clear = () => setItems([]);

    const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    return (
        <CartContext.Provider value={{ items, addItem, clear, totalPrice }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used inside CartProvider");
    return ctx;
}