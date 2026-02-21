import Image from "next/image";

export default function HomeBanner({
                                       title,
                                       desc,
                                       badge = "이벤트",
                                       imageUrl,
                                   }: {
    title: string;
    desc: string;
    badge?: string;
    imageUrl?: string;
}) {
    return (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="inline-flex rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {badge}
                    </div>
                    <div className="mt-2 text-[15px] font-extrabold leading-snug text-gray-900">
                        {title}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-gray-600">{desc}</div>

                    <button
                        type="button"
                        className="mt-3 inline-flex items-center justify-center rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm active:scale-[0.99]"
                    >
                        자세히 보기
                    </button>
                </div>

                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-50">
                    {imageUrl ? (
                        <Image
                            src={imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="80px"
                            priority={false}
                        />
                    ) : (
                        <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-50" />
                    )}
                </div>
            </div>
        </div>
    );
}