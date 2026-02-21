"use client";

type Chip = { key: string; label: string };

export default function FilterChips({
                                        items,
                                        activeKey,
                                        onChangeAction,
                                    }: {
    items: Chip[];
    activeKey: string;
    onChangeAction: (k: string) => void;
}) {
    return (
        <div className="mt-3">
            <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map((c) => {
                    const active = c.key === activeKey;
                    return (
                        <button
                            key={c.key}
                            type="button"
                            onClick={() => onChangeAction(c.key)}
                            className={[
                                "shrink-0 rounded-full px-3 py-2 text-xs font-semibold",
                                active
                                    ? "bg-emerald-600 text-white"
                                    : "bg-white text-gray-700 ring-1 ring-gray-200",
                            ].join(" ")}
                        >
                            {c.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}