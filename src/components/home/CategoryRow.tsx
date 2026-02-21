type Category = { key: string; label: string; emoji: string };

export default function CategoryRow({ categories }: { categories: Category[] }) {
    return (
        <div className="mt-4">
            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        className="flex w-[74px] shrink-0 flex-col items-center gap-2 rounded-2xl bg-white px-2 py-3 shadow-sm ring-1 ring-gray-100 active:scale-[0.99]"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl">
                            {c.emoji}
                        </div>
                        <div className="text-[11px] font-medium text-gray-700">{c.label}</div>
                    </button>
                ))}
            </div>

            <div className="mt-1 text-center text-[11px] text-gray-500">
                공구 클릭시 상세내용 확인 가능합니다.
            </div>
        </div>
    );
}