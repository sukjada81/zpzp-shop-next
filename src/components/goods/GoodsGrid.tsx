import ProductCard from "@/components/goods/ProductCard";

export type GoodsItem = {
    id: string;
    title: string;
    price: number;
    badgeLeft?: string;
    badgeRight?: string;
};

export default function GoodsGrid({
                                      tenant,
                                      items,
                                  }: {
    tenant: string;
    items: GoodsItem[];
}) {
    return (
        <div className="mt-3 grid grid-cols-2 gap-3">
            {items.map((it) => (
                <ProductCard
                    key={it.id}
                    tenant={tenant}
                    id={it.id}
                    title={it.title}
                    price={it.price}
                    badgeLeft={it.badgeLeft}
                    badgeRight={it.badgeRight}
                />
            ))}
        </div>
    );
}