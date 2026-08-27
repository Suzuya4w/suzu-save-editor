import { JSX, createSignal, Show } from 'solid-js';

interface TooltipProps {
  content: string;
  children: JSX.Element;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip(props: TooltipProps) {
  const [show, setShow] = createSignal(false);

  return (
    <div 
      class="relative flex items-center justify-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {props.children}
      <Show when={show()}>
        <div class="absolute bottom-full mb-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-50 animate-in fade-in zoom-in duration-200">
          {props.content}
          <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
        </div>
      </Show>
    </div>
  );
}
