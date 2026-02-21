"use client";

export default function SearchBar({
                                      value,
                                      onChangeAction,
                                      placeholder = "검색어를 입력해 주세요",
                                  }: {
    value: string;
    onChangeAction: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <div className="mt-3">
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm">
                <span className="text-gray-500">⌕</span>
                <input
                    value={value}
                    onChange={(e) => onChangeAction(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                />
            </div>
        </div>
    );
}