import { onMount, onCleanup } from 'solid-js';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { setPendingAiMutation } from '../store/editorStore';
import { addToast } from '../store/toastStore';

export function useMcpBridge() {
  let unlisten: UnlistenFn | undefined;

  onMount(async () => {
    unlisten = await listen<Record<string, any>>('ai-mutation-proposed', (event) => {
      console.log('AI MCP Mutation proposed:', event.payload);
      
      const payload = event.payload;
      const injectedKeys = Object.keys(payload).length;

      setPendingAiMutation(payload);

      addToast(`AI proposed ${injectedKeys} variable(s) for review.`, 'info');
    });
  });

  onCleanup(() => {
    if (unlisten) unlisten();
  });
}
