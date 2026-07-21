import { NextRequest } from "next/server";
import { proxyLinkerProducts } from "@/lib/seller/linkerProductsProxy";

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } },
) {
    const { tenant } = await Promise.resolve(context.params);
    return proxyLinkerProducts(request, String(tenant ?? ""), "/v1/seller/linker-products/order");
}
