// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    env: {
        LOCAL_BYPASS_AUTH: process.env.LOCAL_BYPASS_AUTH,
        AUTH_ORIGIN: process.env.AUTH_ORIGIN,
        SITE_ORIGIN: process.env.SITE_ORIGIN,
        SELLER_ORIGIN: process.env.SELLER_ORIGIN,
        SELECT_TENANT_ORIGIN: process.env.SELECT_TENANT_ORIGIN,
        TENANT_BY_SUBDOMAIN: process.env.TENANT_BY_SUBDOMAIN,
        TENANT_BASE_DOMAIN: process.env.TENANT_BASE_DOMAIN,
        COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
        API_BASE_URL: process.env.API_BASE_URL,
        NEXT_INTERNAL_ORIGIN: process.env.NEXT_INTERNAL_ORIGIN,
    },
};

export default nextConfig;