import { NextRequest } from "next/server";
import { proxyLinkerProducts } from "@/lib/seller/linkerProductsProxy";

type Context = { params: Promise<{ tenant: string }> | { tenant: string } };

async function run(request: NextRequest, context: Context) {
    const { tenant } = await Promise.resolve(context.params);
    return proxyLinkerProducts(request, String(tenant ?? ""), "/v1/seller/linker-products/select");
}

export const POST = run;
export const DELETE = run;
