// src/app/api/seller/[tenant]/settlement/request/route.ts
// 출금 신청(전액) 프록시.
import { NextRequest } from "next/server";
import { proxyLinkerProducts } from "@/lib/seller/linkerProductsProxy";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } },
) {
    const { tenant } = await Promise.resolve(context.params);
    return proxyLinkerProducts(request, String(tenant ?? ""), "/v1/seller/settlement/request", "정산");
}
