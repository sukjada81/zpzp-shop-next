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
};

export default function ProductCard(props: { tenant: string; item: Item }) {
    const { tenant, item } = props;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* 이미지 영역(더미) */}
            <div className="relative aspect-[4/3] bg-slate-100">
                {item.imageLabel ? (
                    <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[11px] font-bold text-white">
            {item.imageLabel}
          </span>
                ) : null}

                <div className="absolute left-0 top-0 flex gap-2 p-2">
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

            {/* 텍스트 영역 */}
            <div className="p-3">
                <div className="line-clamp-2 text-sm font-bold text-slate-900">
                    {item.title}
                </div>

                <div className="mt-2 flex items-end justify-between gap-2">
                    <div className="text-lg font-extrabold text-slate-900 tabular-nums">
                        {item.price.toLocaleString()}원
                    </div>

                    <Link
                        href={`/${tenant}/goods/${item.id}`}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                        자세히 보기 →
                    </Link>
                </div>

                {(item.metaLeft || item.metaRight) && (
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate">{item.metaLeft}</span>
                        <span className="truncate">{item.metaRight}</span>
                    </div>
                )}
            </div>
        </div>
    );
}