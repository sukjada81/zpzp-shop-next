"use client";

export default function StickyActionBar({
                                            primaryText,
                                            secondaryText = "자세히 보기",
                                            onPrimaryAction,
                                            onSecondaryAction,
                                        }: {
    primaryText: string;
    secondaryText?: string;
    onPrimaryAction?: () => void;
    onSecondaryAction?: () => void;
}) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
            <div className="mx-auto flex h-16 max-w-md items-center gap-3 px-4">
                <button
                    type="button"
                    onClick={onSecondaryAction}
                    className="flex-1 rounded-2xl border bg-white py-3 text-sm font-semibold text-gray-900 shadow-sm active:scale-[0.99]"
                >
                    {secondaryText}
                </button>
                <button
                    type="button"
                    onClick={onPrimaryAction}
                    className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-extrabold text-white shadow-sm active:scale-[0.99]"
                >
                    {primaryText}
                </button>
            </div>
        </div>
    );
}