"use client";

type Tab = { key: string; label: string };

export default function QuickTabs({
                                      tabs,
                                      activeKey,
                                      onChangeAction,
                                  }: {
    tabs: Tab[];
    activeKey: string;
    onChangeAction: (k: string) => void;
}) {
    return (
        <div className="mt-3">
            <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {tabs.map((t) => {
                    const active = t.key === activeKey;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => onChangeAction(t.key)}
                            className={[
                                "shrink-0 rounded-full px-3 py-2 text-xs font-semibold",
                                active
                                    ? "bg-emerald-600 text-white"
                                    : "bg-white text-gray-700 ring-1 ring-gray-200",
                            ].join(" ")}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}