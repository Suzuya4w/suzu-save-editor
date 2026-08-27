// @ts-nocheck
import { Show, Switch, Match } from 'solid-js';
import { useEditorStore } from '../store/editorStore';
import { StardewDashboard } from './dashboards/StardewDashboard';
import { RPGMakerDashboard } from './dashboards/RPGMakerDashboard';

export const EasyMode = () => {
  const store = useEditorStore();

  return (
    <div class="flex-1 w-full h-full overflow-hidden flex flex-col bg-[#0B0E14] text-gray-200">
      <Switch>
        <Match when={store.saveData?.engine_type === 'StardewValley' || store.saveData?.engine_type === 'CSharpXml'}>
          <StardewDashboard />
        </Match>
        <Match when={store.saveData?.engine_type === 'RpgMakerMv'}>
          <RPGMakerDashboard />
        </Match>
      </Switch>
    </div>
  );
};
