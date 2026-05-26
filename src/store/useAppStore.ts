import { create } from 'zustand';

export type ScheduleView = 'week' | 'day' | 'list' | 'calendar';

type AppStore = {
  selectedGroupId: string;
  scheduleView: ScheduleView;
  sidebarOpen: boolean;
  setSelectedGroupId: (groupId: string) => void;
  setScheduleView: (view: ScheduleView) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  selectedGroupId: 'grp_100',
  scheduleView: 'week',
  sidebarOpen: false,
  setSelectedGroupId: (groupId) => set({ selectedGroupId: groupId }),
  setScheduleView: (scheduleView) => set({ scheduleView }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
}));
