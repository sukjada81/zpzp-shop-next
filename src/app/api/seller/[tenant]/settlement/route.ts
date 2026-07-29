// src/app/api/seller/[tenant]/settlement/route.ts
// 링커 콘솔 정산 요약 프록시. 실제 조회는 Fastify → shop-php 브리지.
import { NextRequest } from "next/server";
import { proxyLinkerProducts } from "@/lib/seller/linkerProductsProxy";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } },
) {
    const { tenant } = await Promise.resolve(context.params);
    return proxyLinkerProducts(request, String(tenant ?? ""), "/v1/seller/settlement", "정산");
}
