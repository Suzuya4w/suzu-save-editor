// @ts-nocheck
import { Show, Switch, Match } from 'solid-js';
import { useEditorStore } from '../store/editorStore';
import { lazy, Suspense } from 'solid-js';
const StardewDashboard = lazy(() => import('./dashboards/StardewDashboard').then(m => ({ default: m.StardewDashboard })));
const RPGMakerDashboard = lazy(() => import('./dashboards/RPGMakerDashboard').then(m => ({ default: m.RPGMakerDashboard })));

export const EasyMode = () => {
  const store = useEditorStore();

  return (
    <div class="flex-1 w-full h-full overflow-hidden flex flex-col bg-[#0B0E14] text-gray-200">
      <Suspense fallback={<div class="flex items-center justify-center h-full text-zinc-500 font-bold">LOADING DASHBOARD...</div>}>
        <Switch>
          <Match when={store.saveData?.engine_type === 'StardewValley' || store.saveData?.engine_type === 'CSharpXml'}>
            <StardewDashboard />
          </Match>
          <Match when={store.saveData?.engine_type === 'RpgMakerMv'}>
            <RPGMakerDashboard />
          </Match>
        </Switch>
      </Suspense>
    </div>
  );
};
