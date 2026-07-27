"use client";

import { useState } from "react";
import LinkerProductDetailModal from "../linker-products/LinkerProductDetailModal";

export default function ProductLinkerCountCell({
    productId,
    productTitle,
    linkerCount,
}: {
    productId: string;
    productTitle: string;
    linkerCount: number;
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={linkerCount <= 0}
                className="inline-flex min-w-10 items-center justify-center rounded-full bg-violet-50 px-3 py-1 text-sm font-extrabold text-violet-700 hover:bg-violet-100 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-400"
            >
                {linkerCount}
            </button>
            {open ? (
                <LinkerProductDetailModal
                    kind="product-linkers"
                    productId={productId}
                    productTitle={productTitle}
                    onClose={() => setOpen(false)}
                />
            ) : null}
        </>
    );
}
