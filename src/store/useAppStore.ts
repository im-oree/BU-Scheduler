import { create } from 'zustand';

export type ScheduleView = 'week' | 'day' | 'list' | 'calendar';

type AppStore = {
  selectedGroupId: string;
  scheduleView: ScheduleView;
  sidebarOpen: boolean;
  authModalOpen: boolean;
  authModalIntent?: string | null;
  setSelectedGroupId: (groupId: string) => void;
  setScheduleView: (view: ScheduleView) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openAuthModal: (intent?: string) => void;
  closeAuthModal: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  selectedGroupId: 'grp_100',
  scheduleView: 'week',
  sidebarOpen: false,
  authModalOpen: false,
  authModalIntent: null,
  setSelectedGroupId: (groupId) => set({ selectedGroupId: groupId }),
  setScheduleView: (scheduleView) => set({ scheduleView }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  openAuthModal: (intent) => set({ authModalOpen: true, authModalIntent: intent ?? null }),
  closeAuthModal: () => set({ authModalOpen: false, authModalIntent: null }),
}));
