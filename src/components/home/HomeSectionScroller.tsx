import HomeDealCard from "./HomeDealCard";

type Deal = {
    id: string;
    title: string;
    price: number;
    imageLabel?: string;
    badgeLeft?: string;
    badgeRight?: string;
    metaLeft?: string;
    metaRight?: string;
};

export default function HomeSectionScroller({
                                                tenant,
                                                deals,
                                            }: {
    tenant: string;
    deals: Deal[];
}) {
    return (
        <div className="-mx-4 px-4">
            <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {deals.map((d) => (
                    <HomeDealCard key={d.id} tenant={tenant} deal={d} />
                ))}
            </div>
        </div>
    );
}