// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "디스카운트 올데이",
    description: "지점별 공동구매 플랫폼",
    icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    // ✅ 브라우저 확장프로그램이 body attribute 넣어서 hydration 경고 나는 케이스 방지
    return (
        <html lang="ko" suppressHydrationWarning>
        <body className="antialiased" suppressHydrationWarning>
        {children}
        </body>
        </html>
    );
}