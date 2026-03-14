import { DataLayerToggles } from './DataLayerToggles.js';

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-gray-200/50 dark:border-gray-800/50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-4 gap-6">
      <DataLayerToggles />
    </aside>
  );
}
