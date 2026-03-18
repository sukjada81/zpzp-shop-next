"use client";

import { useEffect, useState } from "react";

export default function Footer() {
    const [showTopButton, setShowTopButton] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setShowTopButton(window.scrollY > 80);
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    const handleScrollTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    return (
        <>
            <footer className="mt-8 border-t border-[#d9d9d9] bg-[#f5f5f7]">
                <div className="mx-auto w-full max-w-[520px] px-6 py-8">
                    <div className="mb-6">
                        <div className="mb-4">
                            <div className="inline-flex items-center rounded-md bg-black px-2 py-[2px] text-[12px] font-bold tracking-[0.08em] text-white">
                                다스카운트 올데이
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 text-[12px] leading-[1.8] text-[#5f6470]">
                        <p className="font-semibold text-[#4b4f58]">주식회사 클로버브릿지</p>
                        <p>대표자: 김재철</p>
                        <p>사업자 등록번호: 230-88-03533</p>
                        <p>email: discountallday0@gmail.com</p>
                        <p>사업자주소: 서울시 송파구 양재대로62길 8, 618호(가락동)</p>
                    </div>

                    <div className="mt-6 flex items-center gap-4 text-[12px] text-[#4b4f58]">
                        <a href="/privacy" className="underline underline-offset-2">
                            개인정보처리방침
                        </a>
                        <span className="text-[#b8bcc6]">|</span>
                        <a href="/terms" className="underline underline-offset-2">
                            서비스 이용약관
                        </a>
                    </div>

                    <div className="mt-8 border-t border-[#d9d9d9] pt-4 text-[12px] text-[#9aa0ad]">
                        © 2025 Cloverbridge Inc. All rights reserved.
                    </div>
                </div>
            </footer>

            <button
                type="button"
                onClick={handleScrollTop}
                aria-label="맨 위로 이동"
                className={`fixed bottom-24 right-5 z-[999] flex h-11 w-11 items-center justify-center rounded-full border border-[#d8d8dd] bg-white shadow-md transition-all duration-300 ${showTopButton
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-2 opacity-0"
                    }`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7b7f8a"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 19V5" />
                    <path d="m5 12 7-7 7 7" />
                </svg>
            </button>
        </>
    );
}