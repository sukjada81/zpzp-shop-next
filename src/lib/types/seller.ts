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

export type SellerDashboardTone = "green" | "blue" | "orange" | "red";
export type SellerSalesRange = "day" | "month" | "year";

export type SellerDashboardRow = {
    key: string;
    label: string;
    value: number;
    text: string;
    percent: number;
    tone: SellerDashboardTone;
};

export type SellerDashboardKpi = {
    key: string;
    label: string;
    value: number;
    unit: string;
    hint: string;
    tone: Exclude<SellerDashboardTone, "red">;
};

export type SellerSalesCard = {
    key: string;
    label: string;
    value: number;
    unit: string;
    text: string;
    hint: string;
    tone: SellerDashboardTone;
};

export type SellerSalesChartPoint = {
    key: string;
    label: string;
    amount: number;
    orderCount: number;
    amountText: string;
};

export type SellerSalesLegend = {
    key: string;
    label: string;
    type: "bar" | "line";
    colorClass: string;
};

export type SellerSalesChart = {
    range: SellerSalesRange;
    legend: SellerSalesLegend[];
    points: SellerSalesChartPoint[];
    amountMax: number;
    orderCountMax: number;
};

export type SellerSalesDetailItem = {
    id: string;
    orderNo: string;
    buyerName: string;
    itemSummary: string;
    qty: number;
    itemCount: number;
    amount: number;
    amountText: string;
    supplyAmount: number;
    supplyAmountText: string;
    profitAmount: number;
    profitAmountText: string;
    status: number;
    statusLabel: string;
    orderedAt: string | null;
    orderedAtText: string;
};

export type SellerDashboardData = {
    ok: boolean;
    tenant: string;
    summary: {
        title: string;
        subtitle: string;
        dateLabel: string;
        updatedAt: string;
        memberKpis: SellerDashboardKpi[];
        operationKpis: SellerDashboardKpi[];
        recentWeek: {
            total: number;
            rows: SellerDashboardRow[];
            note: string;
        };
        sales?: {
            title: string;
            subtitle: string;
            basis: string;
            cards: SellerSalesCard[];
            chart: SellerSalesChart;
        };
    };
    debug?: {
        totalMembers?: number;
        sourceReady?: boolean;
        actor?: {
            role?: string;
            scopeType?: string;
        };
    };
};

export type SellerSalesResponse = {
    ok: boolean;
    tenant: string;
    summary: {
        title: string;
        subtitle: string;
        basis: string;
        cards: SellerSalesCard[];
        totals: {
            salesAmount: number;
            salesAmountText: string;
            supplyAmount: number;
            supplyAmountText: string;
            profitAmount: number;
            profitAmountText: string;
            orderCount: number;
            orderCountText: string;
            qty: number;
            qtyText: string;
        };
        chart: SellerSalesChart;
    };
    filters: {
        range: SellerSalesRange;
        search: string;
        status: string;
        dateFrom: string;
        dateTo: string;
        page: number;
        pageSize: number;
    };
    details: {
        totalCount: number;
        totalPages: number;
        page: number;
        pageSize: number;
        items: SellerSalesDetailItem[];
    };
    actor?: {
        role?: string;
        scopeType?: string;
    };
};