import { useSettingsStore } from '../store/settingsStore';
import { Show, createSignal, onMount } from 'solid-js';

export function DedSecBackground(props: { isModalOpen?: boolean }) {
  const settings = useSettingsStore();

  const [appVersion, setAppVersion] = createSignal('');
  const [typedText, setTypedText] = createSignal('');
  const [isDoneTyping, setIsDoneTyping] = createSignal(false);
  const fullText = "Welcome";

  onMount(async () => {
    try {
      const { getVersion } = await import('@tauri-apps/plugin-app');
      setAppVersion(await getVersion());
    } catch(e) {}

    let index = 0;
    function type() {
      if (index < fullText.length) {
        setTypedText((prev) => prev + fullText.charAt(index));
        index++;
        setTimeout(type, 150);
      } else {
        setIsDoneTyping(true);
      }
    }
    type();
  });

  return (
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0 font-mono">
      <style>
        {`
          @keyframes terminal-blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
          
          .text-glass-shine {
            background: linear-gradient(
              120deg, 
              rgba(255,255,255, 0.02) 0%,
              rgba(255,255,255, 0.02) 40%, 
              rgba(255,255,255, 0.2) 50%, 
              rgba(255,255,255, 0.02) 60%,
              rgba(255,255,255, 0.02) 100%
            );
            background-size: 200% auto;
            background-position: 150% center;
            color: transparent;
            -webkit-background-clip: text;
            background-clip: text;
            animation: shine 4s linear forwards;
            animation-delay: 0.5s;
          }

          @keyframes shine {
            0% { background-position: 150% center; }
            100% { background-position: -50% center; }
          }
        `}
      </style>

      <Show when={settings.enableEffects}>
        {/* Giant Background Text with Glass Shine Effect */}
        <div class="fixed inset-0 flex items-center justify-center pointer-events-none select-none text-[15vw] font-black whitespace-nowrap overflow-hidden z-0">
          <span 
            class="text-glass-shine"
            style={{
              "animation-play-state": props.isModalOpen ? 'paused' : 'running'
            }}
          >
            SUZU_SAVE
          </span>
        </div>

        {/* Triangular / Hexagonal Grid Pattern */}
        <svg width="100%" height="100%" class="absolute inset-0 opacity-[0.07]">
        <defs>
          <pattern id="hexGrid" width="60" height="103.923" patternUnits="userSpaceOnUse" patternTransform="scale(1.5)">
            <path d="M30 0 L60 17.32 L60 51.96 L30 69.28 L0 51.96 L0 17.32 Z" fill="none" stroke="#ffffff" stroke-width="0.5"/>
            <path d="M30 69.28 L60 86.6 L60 121.24 L30 138.56 L0 121.24 L0 86.6 Z" fill="none" stroke="#ffffff" stroke-width="0.5"/>
            <path d="M0 51.96 L30 69.28 L30 103.92 L0 86.6" fill="none" stroke="#ffffff" stroke-width="0.5"/>
            <path d="M60 51.96 L30 69.28 L30 103.92 L60 86.6" fill="none" stroke="#ffffff" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexGrid)" />
      </svg>
      
      {/* Scattered Geometric Shapes (Triangles) */}
      <svg width="100%" height="100%" class="absolute inset-0 opacity-10">
        <polygon points="150,120 170,150 130,150" fill="#ffffff" />
        <polygon points="85%,25% 87%,28% 83%,28%" fill="#ffffff" />
        <polygon points="20%,70% 23%,75% 17%,75%" fill="#ffffff" />
        <polygon points="75%,80% 78%,85% 72%,85%" fill="#ffffff" />
      </svg>

      <div class="absolute inset-0 pt-safe pb-safe pl-safe pr-safe pointer-events-none">
        <div class="relative w-full h-full pointer-events-none">
          {/* Floating ASCII / Terminal Text */}
          <div class="absolute top-36 md:top-10 left-4 md:left-10 text-[10px] md:text-xs text-zinc-400 opacity-60 leading-relaxed uppercase tracking-wider">
            {">"} system boot up sequence_<br/>
            {">"} welcome to suzu save editor {appVersion() || '1.0.0'}<br/>
            {">"} you can unlock cg or changing stats<br/>
            {">"} note:it's only working with offline or single-player games<br/>
            {">"} this program is made just for fun<br/>
            {">"} thanks:]
          </div>

          <div class="absolute top-2 md:top-10 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-70">
            <div class="h-[2px] w-32 md:w-56 bg-zinc-400 mb-1"></div>
            <div class="px-2 md:px-4 py-1 bg-zinc-300 text-black font-bold text-[10px] md:text-sm tracking-widest uppercase">
              {'>'}SUZU_SAVE APP {appVersion() || '1.0.0'}
            </div>
            <div class="h-[1px] w-32 md:w-56 bg-zinc-400 mt-1"></div>
            <div class="h-[2px] w-32 md:w-56 bg-zinc-400 mt-1"></div>
          </div>

          <div class="absolute top-[36%] right-[15%] text-zinc-500 opacity-20 text-lg font-bold tracking-widest hidden md:block">
            {'>'}SUZU_SAVE:/<span>_</span>
          </div>
          
          <div class="absolute bottom-[36%] left-[15%] text-zinc-500 opacity-20 text-lg font-bold tracking-widest hidden md:block">
            {'>'}SUZU_SAVE:/<span>_</span>
          </div>
          
          <div class="absolute top-[1%] right-[1%] text-zinc-500 opacity-30 text-2xl font-bold tracking-widest hidden xl:block">
            {'>'}SUZU_SAVE:/<span>_</span>
          </div>

          <div class="absolute bottom-22 md:bottom-16 left-4 md:left-12 flex flex-col items-start opacity-70">
            <div class="text-xl md:text-4xl text-zinc-300 font-normal tracking-wide mb-1 md:mb-3 select-none flex items-center">
              <span>{'>'}{typedText()}</span>
              <span 
                class="inline-block w-[0.40em] h-[1em] bg-zinc-300 ml-[2px] translate-y-[-2px]"
                style={{
                  animation: (isDoneTyping() && !props.isModalOpen) ? 'terminal-blink 1s step-end infinite' : 'none',
                  opacity: (isDoneTyping() && props.isModalOpen) ? 1 : undefined
                }}
              ></span>
            </div>
            <div class="h-[2px] md:h-[4px] w-16 md:w-32 bg-zinc-400 mb-[2px] md:mb-[3px]"></div>
            <div class="h-[4px] md:h-[8px] w-20 md:w-40 bg-zinc-400 mb-[2px] md:mb-[3px]"></div>
            <div class="h-[3px] md:h-[6px] w-12 md:w-24 bg-zinc-400"></div>
          </div>
        </div>
      </div>
      </Show>
    </div>
  );
}