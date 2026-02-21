import Link from "next/link";

export default function SectionHeader({
                                          title,
                                          href,
                                          moreText = "더보기 →",
                                      }: {
    title: string;
    href?: string; // ✅ 더보기 링크 (없으면 숨김)
    moreText?: string;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-slate-900">{title}</span>
            </div>

            {href ? (
                <Link
                    href={href}
                    className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                >
                    {moreText}
                </Link>
            ) : (
                <span className="text-sm text-transparent select-none">{moreText}</span>
            )}
        </div>
    );
}