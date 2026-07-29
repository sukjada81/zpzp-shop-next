// src/app/api/seller/[tenant]/settlement/profile/route.ts
// 정산정보 저장 프록시. 민감정보가 지나가므로 본문을 로깅하지 않는다(프록시는 그대로 전달만).
import { NextRequest } from "next/server";
import { proxyLinkerProducts } from "@/lib/seller/linkerProductsProxy";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } },
) {
    const { tenant } = await Promise.resolve(context.params);
    return proxyLinkerProducts(request, String(tenant ?? ""), "/v1/seller/settlement/profile", "정산");
}
