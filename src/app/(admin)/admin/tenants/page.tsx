// src/app/(admin)/admin/tenants/page.tsx
// [숨김 2026-07-31] 지점 관리 별칭 라우트 — 입구를 닫는다.
//
// 원래 이 페이지는 /tenant 로 리다이렉트했는데, 실제 경로는 /admin/tenant 라 404 로 빠지던
// 별칭이었다. 지점 관리 메뉴 자체를 숨기기로 했으므로(줍줍은 링커 승인이 지점 추가에 해당하고
// tenant CRUD 는 SQL 로 처리) 리다이렉트를 고치는 대신 진입 자체를 막는다.
// dad_tenants 데이터는 리졸버·매장 판별이 계속 읽으므로 건드리지 않는다.
//
// 되살릴 때: 아래 notFound() 를 지우고 주석 처리된 redirect 를 살리되, 경로를 /admin/tenant 로 고칠 것.
// import { redirect } from "next/navigation";
import { notFound } from "next/navigation";

export default function AdminTenantsAliasPage() {
    // redirect("/admin/tenant");
    notFound();
}
