"use client";

import { useState } from "react";

export type HomeTabKey = "today" | "limited" | "event";

export default function HomeQuickTabs({
                                          onChangeAction,
                                      }: {
    onChangeAction: (key: HomeTabKey) => void;
}) {
    const [active, setActive] = useState<HomeTabKey>("today");

    const handleClick = (key: HomeTabKey) => {
        setActive(key);
        onChangeAction(key);
    };

    const base = "px-4 py-2 rounded-full text-sm font-bold border transition";
    const activeStyle = "bg-emerald-600 text-white border-emerald-600";
    const inactiveStyle = "bg-white text-slate-700 border-slate-200";

    return (
        <div className="mt-4 flex gap-2">
            <button
                type="button"
                onClick={() => handleClick("today")}
                className={`${base} ${active === "today" ? activeStyle : inactiveStyle}`}
            >
                오늘의 공구
            </button>

            <button
                type="button"
                onClick={() => handleClick("limited")}
                className={`${base} ${active === "limited" ? activeStyle : inactiveStyle}`}
            >
                오늘의 한정특가
            </button>

            <button
                type="button"
                onClick={() => handleClick("event")}
                className={`${base} ${active === "event" ? activeStyle : inactiveStyle}`}
            >
                이벤트
            </button>
        </div>
    );
}