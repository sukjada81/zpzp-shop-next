"use client";

import ProductCard from "./ProductCard";

type Item = {
    id: string;
    title: string;
    price: number;
    badgeLeft?: string;
    badgeRight?: string;
    imageLabel?: string;
    metaLeft?: string;
    metaRight?: string;
};

export default function HomeSection({
                                        tenant,
                                        title,
                                        items,
                                    }: {
    tenant: string;
    title: string;
    items: Item[];
}) {
    return (
        <section className="pt-4">
            <div className="text-lg font-extrabold text-slate-900">{title}</div>

            <div className="mt-3 grid grid-cols-2 gap-3">
                {items.map((it) => (
                    <ProductCard key={it.id} tenant={tenant} item={it} />
                ))}
            </div>
        </section>
    );
}