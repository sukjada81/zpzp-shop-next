// src/lib/admin/adminUiStore.ts
"use client";

import { create } from "zustand";

type AdminUiState = {
    sidebarOpen: boolean;
    openSidebar: () => void;
    closeSidebar: () => void;
    toggleSidebar: () => void;
};

export const useAdminUiStore = create<AdminUiState>((set) => ({
    sidebarOpen: false,
    openSidebar: () => set({ sidebarOpen: true }),
    closeSidebar: () => set({ sidebarOpen: false }),
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));