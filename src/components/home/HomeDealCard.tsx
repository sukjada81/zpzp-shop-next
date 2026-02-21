import Link from "next/link";

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

export default function HomeDealCard({
                                         tenant,
                                         deal,
                                     }: {
    tenant: string;
    deal: Deal;
}) {
    return (
        <Link
            href={`/${tenant}/goods/${deal.id}`}
            className="block w-[260px] shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition"
        >
            {/* image */}
            <div className="relative aspect-[4/3] bg-slate-100">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-slate-200" />
                {deal.imageLabel ? (
                    <div className="absolute left-3 bottom-3 rounded-lg bg-black/75 px-2 py-1 text-xs font-semibold text-white">
                        {deal.imageLabel}
                    </div>
                ) : null}

                <div className="absolute left-3 top-3 flex gap-2">
                    {deal.badgeLeft ? (
                        <span className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">
              {deal.badgeLeft}
            </span>
                    ) : null}
                    {deal.badgeRight ? (
                        <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-bold text-white">
              {deal.badgeRight}
            </span>
                    ) : null}
                </div>
            </div>

            {/* body */}
            <div className="p-3">
                <div className="line-clamp-2 text-sm font-bold text-slate-900">
                    {deal.title}
                </div>

                <div className="mt-2 flex items-end justify-between gap-2">
                    <div className="text-lg font-extrabold text-slate-900 tabular-nums">
                        {deal.price.toLocaleString()}원
                    </div>
                    <div className="text-xs font-semibold text-slate-500">자세히 보기 →</div>
                </div>

                {(deal.metaLeft || deal.metaRight) && (
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              {deal.metaLeft ? `⏱ ${deal.metaLeft}` : ""}
            </span>
                        <span className="inline-flex items-center gap-1">
              {deal.metaRight ? `📦 ${deal.metaRight}` : ""}
            </span>
                    </div>
                )}
            </div>
        </Link>
    );
}