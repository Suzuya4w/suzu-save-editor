import { createSignal, onCleanup, onMount, Show, JSX } from 'solid-js';
import { Portal } from 'solid-js/web';

interface CyberHoldButtonProps {
  onProgress?: (progress: number) => void;
  onComplete: () => void;
  holdTime?: number;
  children: JSX.Element;
  class?: string;
}

export function CyberHoldButton(props: CyberHoldButtonProps) {
  const [progress, setProgress] = createSignal(0);
  const [isHolding, setIsHolding] = createSignal(false);
  const [mousePos, setMousePos] = createSignal({ x: 0, y: 0 });
  const [showCursorCircle, setShowCursorCircle] = createSignal(false);

  const holdTime = props.holdTime || 1000; 
  let animationFrameId: number;
  let startTime = 0;

  let audioCtx: AudioContext | null = null;
  let humOsc: OscillatorNode | null = null;
  let humGain: GainNode | null = null;

  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  const startHumSound = () => {
    if (!audioCtx) return;

    humOsc = audioCtx.createOscillator();
    humGain = audioCtx.createGain();

    humOsc.type = 'sawtooth';
    humOsc.frequency.setValueAtTime(60, audioCtx.currentTime);
    humOsc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + (holdTime / 1000));

    humGain.gain.setValueAtTime(0, audioCtx.currentTime);
    humGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.05);

    humOsc.connect(humGain);
    humGain.connect(audioCtx.destination);

    humOsc.start();
  };

  const stopHumSound = () => {
    if (humGain && audioCtx) {
      humGain.gain.cancelScheduledValues(audioCtx.currentTime);
      humGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
    }
    if (humOsc && audioCtx) {
      try {
        humOsc.stop(audioCtx.currentTime + 0.05);
      } catch (e) {}
      humOsc = null;
    }
  };

  const playSuccessSound = () => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(350, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  };

  const updateProgress = (timestamp: number) => {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const currentProgress = Math.min((elapsed / holdTime) * 100, 100);

    setProgress(currentProgress);
    if (props.onProgress) props.onProgress(currentProgress);

    if (currentProgress >= 100) {
      stopHold(true);
      props.onComplete();
    } else if (isHolding()) {
      animationFrameId = requestAnimationFrame(updateProgress);
    }
  };

  const startHold = (e: MouseEvent | TouchEvent) => {
    if (e.type === 'mousedown' && (e as MouseEvent).button !== 0) return; 

    initAudio();
    startHumSound();

    setIsHolding(true);
    setShowCursorCircle(true);
    startTime = 0;
    setProgress(0);
    if (props.onProgress) props.onProgress(0);

    if (e.type === 'mousedown') {
      setMousePos({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY });
    } else if (e.type === 'touchstart') {
      const touch = (e as TouchEvent).touches[0];
      setMousePos({ x: touch.clientX, y: touch.clientY });
    }

    animationFrameId = requestAnimationFrame(updateProgress);
  };

  const stopHold = (completed = false) => {
    if (!isHolding()) return;
    setIsHolding(false);
    setShowCursorCircle(false);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    stopHumSound();

    if (completed) {
      playSuccessSound();
    } else {
      setProgress(0);
      if (props.onProgress) props.onProgress(0);
    }
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (showCursorCircle()) {
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleGlobalMouseUp = () => stopHold(false);

  onMount(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    stopHumSound();
  });

  return (
    <>
      <button
        onMouseDown={startHold}
        onTouchStart={startHold}
        onTouchEnd={() => stopHold(false)}
        onMouseLeave={() => stopHold(false)}
        class={`relative overflow-hidden cursor-pointer select-none bg-black border border-[#FF7A00] transition-colors duration-200 ${props.class || ''}`}
        style={{ "background-color": "rgba(0,0,0,1)" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Background Fill */}
        <div 
          class="absolute inset-y-0 left-0 bg-[#FF7A00] pointer-events-none"
          style={{ width: `${progress()}%` }}
        />

        <div class="relative z-10 w-full h-full flex items-center justify-center pointer-events-none text-white mix-blend-exclusion uppercase font-mono tracking-wider">
          {props.children}
        </div>
      </button>

      {/* Global Cursor Circle */}
      <Show when={showCursorCircle()}>
        <Portal>
          <div class="fixed inset-0 pointer-events-none z-[99999]">
            <svg 
              style={{
                position: 'absolute',
                left: `${mousePos().x - 50}px`,
                top: `${mousePos().y - 50}px`,
                width: '100px',
                height: '100px',
                transform: 'rotate(-90deg)',
                filter: 'drop-shadow(0px 0px 8px rgba(0,0,0,0.8))'
              }}
            >
              {/* White Outline Background Track */}
              <circle 
                cx="50" 
                cy="50" 
                r="32" 
                fill="none" 
                stroke="rgba(255, 255, 255, 0.15)" 
                stroke-width="6" 
              />
              
              {/* Inner Track */}
              <circle 
                cx="50" 
                cy="50" 
                r="32" 
                fill="none" 
                stroke="rgba(255, 122, 0, 0.2)" 
                stroke-width="3" 
              />

              <circle 
                cx="50" 
                cy="50" 
                r="32" 
                fill="none" 
                stroke="#FFFFFF"
                stroke-width="7"
                pathLength="100"
                stroke-dasharray="100"
                stroke-dashoffset={100 - progress()} 
                style={{
                  "transition": "stroke-dashoffset 0.03s linear"
                }}
              />

              {/* Animated Progress */}
              <circle 
                cx="50" 
                cy="50" 
                r="32" 
                fill="none" 
                stroke="#FF7A00" 
                stroke-width="4"
                pathLength="100"
                stroke-dasharray="100"
                stroke-dashoffset={100 - progress()} 
                style={{
                  "transition": "stroke-dashoffset 0.03s linear"
                }}
              />
            </svg>
          </div>
        </Portal>
      </Show>
    </>
  );
}