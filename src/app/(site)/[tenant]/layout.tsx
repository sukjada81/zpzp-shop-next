import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart/CartProvider";

export default async function AppLayout({
                                            children,
                                            params,
                                        }: {
    children: React.ReactNode;
    params: { tenant: string };
}) {
    const { tenant } = params;

    return (
        <CartProvider>
            {children}
        </CartProvider>
    );
}