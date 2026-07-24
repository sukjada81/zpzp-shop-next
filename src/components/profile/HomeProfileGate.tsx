// src/components/profile/HomeProfileGate.tsx
"use client";

import { useEffect, useState } from "react";
import ProfileSetupModal from "@/components/profile/ProfileSetupModal";
import { shouldOpenProfileSetupModal } from "@/lib/profile/quickOrderProfile";

type AuthSession = {
    ok?: boolean;
    loggedIn?: boolean;
    member?: {
        uid?: string | number;
        id?: string;
        name?: string;
        email?: string;
        phone?: string;
        tenantSlug?: string;
    } | null;
};

export default function HomeProfileGate({ tenant }: { tenant: string }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            try {
                const res = await fetch("/auth/session", {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                });

                const data = (await res.json().catch(() => null)) as AuthSession | null;
                if (cancelled) return;

                if (!data?.loggedIn) return;

                // (줍줍) DAD 오픈채팅 안내 제거로 tenant openchatUrl 조회 폐지.
                if (shouldOpenProfileSetupModal(tenant)) {
                    setOpen(true);
                }
            } catch {
                // ignore
            }
        }

        if (tenant) run();

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    return (
        <ProfileSetupModal
            open={open}
            tenant={tenant}
            onClose={() => setOpen(false)}
            onSaved={() => setOpen(false)}
        />
    );
}