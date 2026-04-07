// src/components/ui/BottomToast.tsx
"use client";

export type BottomToastTone = "success" | "error";

export default function BottomToast({
                                        open,
                                        message,
                                        onClose,
                                        tone = "success",
                                    }: {
    open: boolean;
    message: string;
    onClose: () => void;
    tone?: BottomToastTone;
}) {
    const isError = tone === "error";

    return (
        <div
            className={[
                "pointer-events-none fixed inset-x-0 bottom-24 z-[95] flex justify-center px-4 transition-all duration-300",
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            ].join(" ")}
        >
            <div className="pointer-events-auto w-full max-w-[520px]">
                <div
                    className={[
                        "rounded-[24px] px-5 py-4 shadow-lg backdrop-blur",
                        isError
                            ? "border border-rose-200 bg-rose-50/95"
                            : "border border-emerald-200 bg-emerald-50/95",
                    ].join(" ")}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={[
                                "grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl font-black text-white",
                                isError ? "bg-rose-500" : "bg-green-500",
                            ].join(" ")}
                        >
                            {isError ? "!" : "✓"}
                        </div>

                        <div
                            className={[
                                "min-w-0 flex-1 text-[15px] font-extrabold",
                                isError ? "text-rose-900" : "text-emerald-900",
                            ].join(" ")}
                        >
                            {message}
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className={[
                                "grid h-8 w-8 place-items-center rounded-full text-xl font-bold",
                                isError ? "text-rose-700" : "text-emerald-700",
                            ].join(" ")}
                            aria-label="닫기"
                        >
                            ×
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}