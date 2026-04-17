import Link from "next/link";

export default function ProductCard({
                                        tenant,
                                        id,
                                        title,
                                        price,
                                        badgeLeft,
                                        badgeRight,
                                    }: {
    tenant: string;
    id: string;
    title: string;
    price: number;
    badgeLeft?: string;
    badgeRight?: string;
}) {
    return (
        <Link
            href={`/${tenant}/goods/${id}`}
            className="block overflow-hidden rounded-2xl border bg-white shadow-sm active:scale-[0.99] transition"
        >
            <div className="relative aspect-[4/3] w-full bg-gray-100">
                {badgeLeft ? (
                    <span className="absolute left-2 top-2 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">
            {badgeLeft}
          </span>
                ) : null}

                {badgeRight ? (
                    <span className="absolute right-2 top-2 rounded-md bg-black/80 px-2 py-1 text-[10px] font-semibold text-white">
            {badgeRight}
          </span>
                ) : null}

                <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                    DISCOUNT ALLDAY
                </div>
            </div>

            <div className="p-3">
                <div className="line-clamp-2 text-sm font-semibold text-gray-900">
                    {title}
                </div>

                <div className="mt-2 flex items-end justify-between">
                    <div className="text-base font-extrabold text-gray-900">
                        {price.toLocaleString()}원
                    </div>
                    <span className="text-xs text-gray-500">자세히 보기 ›</span>
                </div>
            </div>
        </Link>
    );
}