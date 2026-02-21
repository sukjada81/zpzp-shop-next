"use client";

import { useState } from "react";
import HomeQuickTabs, { HomeTabKey } from "./HomeQuickTabs";
import ProductCard from "./ProductCard";

export default function ClientHomeShell({
                                            tenant,
                                            todayDeals,
                                        }: {
    tenant: string;
    todayDeals: any[];
}) {
    const [tab, setTab] = useState<HomeTabKey>("today");

    return (
        <>
            <HomeQuickTabs onChangeAction={setTab} />

            {tab === "today" && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {todayDeals.map((it) => (
                        <ProductCard key={it.id} tenant={tenant} item={it} />
                    ))}
                </div>
            )}

            {tab === "limited" && (
                <div className="mt-4 text-center text-slate-500 text-sm">
                    오늘의 한정특가 준비중입니다.
                </div>
            )}

            {tab === "event" && (
                <div className="mt-4 text-center text-slate-500 text-sm">
                    진행중 이벤트를 준비중입니다.
                </div>
            )}
        </>
    );
}