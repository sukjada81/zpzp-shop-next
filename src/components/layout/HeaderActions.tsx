"use client";

export default function HeaderActions({
                                          onSearchAction,
                                          onCartAction,
                                      }: {
    onSearchAction?: () => void;
    onCartAction?: () => void;
}) {
    return (
        <div className="flex items-center gap-1">
            <button
                type="button"
                aria-label="검색"
                onClick={onSearchAction}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg active:bg-gray-100"
            >
                <span className="text-lg">⌕</span>
            </button>
            <button
                type="button"
                aria-label="장바구니"
                onClick={onCartAction}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg active:bg-gray-100"
            >
                <span className="text-lg">🛒</span>
            </button>
        </div>
    );
}