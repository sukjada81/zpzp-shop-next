"use client";

import { useEffect, useRef } from "react";

type DaumPostcodeData = {
    zonecode: string;
    address: string;
    roadAddress: string;
    jibunAddress: string;
    userSelectedType: "R" | "J";
};

declare global {
    interface Window {
        daum?: {
            Postcode: new (options: {
                oncomplete: (data: DaumPostcodeData) => void;
            }) => { open: () => void };
        };
    }
}

const DAUM_SCRIPT_SRC = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

let scriptPromise: Promise<void> | null = null;

function loadDaumPostcodeScript(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (window.daum?.Postcode) return Promise.resolve();

    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(
                `script[src="${DAUM_SCRIPT_SRC}"]`
            );
            if (existing) {
                existing.addEventListener("load", () => resolve());
                existing.addEventListener("error", () => reject(new Error("postcode script")));
                return;
            }

            const script = document.createElement("script");
            script.src = DAUM_SCRIPT_SRC;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("postcode script"));
            document.head.appendChild(script);
        });
    }

    return scriptPromise;
}

export type PostcodeResult = {
    postcode: string;
    address1: string;
};

export default function DaumPostcodeSearch(props: {
    onSelect: (result: PostcodeResult) => void;
    disabled?: boolean;
    className?: string;
    label?: string;
}) {
    const { onSelect, disabled, className, label = "주소 검색" } = props;
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    async function openSearch() {
        if (disabled) return;

        try {
            await loadDaumPostcodeScript();
            if (!mounted.current || !window.daum?.Postcode) return;

            new window.daum.Postcode({
                oncomplete(data) {
                    const road = data.roadAddress || data.address || "";
                    const jibun = data.jibunAddress || "";
                    const address1 =
                        data.userSelectedType === "J" && jibun ? jibun : road || jibun;

                    onSelect({
                        postcode: String(data.zonecode ?? "").trim(),
                        address1: String(address1 ?? "").trim(),
                    });
                },
            }).open();
        } catch {
            alert("주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    return (
        <button
            type="button"
            onClick={openSearch}
            disabled={disabled}
            className={
                className ??
                "h-12 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-extrabold text-slate-800 disabled:opacity-40"
            }
        >
            {label}
        </button>
    );
}
