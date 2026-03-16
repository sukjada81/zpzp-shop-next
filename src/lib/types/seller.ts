// src/lib/types/seller.ts

export type SellerMemberSummary = {
    totalMembers: number;
    todaySignups: number;
    weekSignups: number;
    todayInflows: number;
    todayLogins: number;
    sourceReady: boolean;
};

export type SellerMemberItem = {
    id: string;
    memberUid: string;
    loginId: string;
    name: string;
    phone: string;
    email: string;
    status: string;
    primaryRole: string;
    joinedAt: string;
    lastLoginAt: string;
};

export type SellerMembersResponse = {
    ok: boolean;
    tenant: string;
    summary: SellerMemberSummary;
    items: SellerMemberItem[];
};