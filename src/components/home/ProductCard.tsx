// src/components/home/ProductCard.tsx
import Link from "next/link";

type Item = {
    id: string;
    title: string;
    price: number;
    badgeLeft?: string;
    badgeRight?: string;
    imageLabel?: string;
    metaLeft?: string;
    metaRight?: string;
    thumbnailUrl?: string;
};

export default function ProductCard(props: { tenant: string; item: Item }) {
    const { tenant, item } = props;

    return (
        <div className="flex min-w-[260px] max-w-[260px] flex-col rounded-2xl bg-white">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f5f5f4]">
                {item.thumbnailUrl ? (
                    <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                    />
                ) : null}

                {item.imageLabel ? (
                    <span className="absolute left-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-bold text-white">
                        {item.imageLabel}
                    </span>
                ) : null}

                <div className="absolute left-3 top-3 flex gap-2">
                    {item.badgeLeft ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                            {item.badgeLeft}
                        </span>
                    ) : null}
                    {item.badgeRight ? (
                        <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-bold text-white">
                            {item.badgeRight}
                        </span>
                    ) : null}
                </div>
            </div>

            <Link
                href={`/${tenant}/goods/${item.id}`}
                className="mt-3 block"
            >
                <div className="line-clamp-2 text-[17px] font-bold leading-snug tracking-tight text-slate-900">
                    {item.title}
                </div>
            </Link>

            <div className="mt-2 text-2xl font-extrabold leading-none text-slate-900 tabular-nums">
                {item.price.toLocaleString()}원
            </div>

            {(item.metaLeft || item.metaRight) && (
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="truncate">{item.metaLeft}</span>
                    <span className="truncate">{item.metaRight}</span>
                </div>
            )}

            <div className="mt-auto pt-3">
                <Link
                    href={`/${tenant}/goods/${item.id}`}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] bg-white shadow-sm transition-all duration-150 active:scale-[0.98]"
                >
                    <span className="text-sm font-bold text-slate-900">자세히 보기</span>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-slate-400"
                        aria-hidden="true"
                    >
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </Link>
            </div>
        </div>
    );
}