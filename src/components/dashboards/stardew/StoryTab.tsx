import { createSignal, Show, For } from 'solid-js';
import { TransitionGroup } from 'solid-transition-group';
import { useEditorStore, updateValue } from '../../../store/editorStore';
import { addToast } from '../../../store/toastStore';
import { Sprout, Train, Bus, Hammer, Ship, Building2, Warehouse, Check, AlertTriangle, Info, Trash2 } from 'lucide-solid';
import storyData from '../../../data/stardew/storyData.json';
import { Modal } from '../../Modal';
import { Tooltip } from '../../Header';

const toArray = (obj: any): any[] => {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return [obj];
};

const getText = (val: any): string => {
  if (val === undefined || val === null) return '';
  if (Array.isArray(val)) return getText(val[0]);
  if (typeof val === 'object') {
    if (val['$text']) return String(val['$text']);
    if (val['$value']) return String(val['$value']);
    if (val['#text']) return String(val['#text']);
    if (val['text']) return String(val['text']);
    return '';
  }
  return String(val);
};

const mailDescMap: Record<string, string> = Object.fromEntries(storyData.mails.map(m => [m.id, m.desc]));
const eventDescMap: Record<string, string> = Object.fromEntries(storyData.events.map(e => [e.id, e.desc]));

export const StoryTab = () => {
  const store = useEditorStore();
  const pv = () => store.saveData?.parsed_variables;
  const player = () => pv()?.player || pv()?.SaveGame?.player || pv();

  const [mailInput, setMailInput] = createSignal('');
  const [eventInput, setEventInput] = createSignal('');
  
  // State untuk Modal Konfirmasi
  const [modalOpen, setModalOpen] = createSignal(false);
  const [pendingUnlock, setPendingUnlock] = createSignal<any>(null);
  
  const [deleteModalOpen, setDeleteModalOpen] = createSignal(false);
  const [itemToDelete, setItemToDelete] = createSignal<{id: string, type: 'event' | 'mail'} | null>(null);
  
  const [newlyAdded, setNewlyAdded] = createSignal<Set<string>>(new Set());

  const eventsSeen = () => toArray(player()?.eventsSeen?.int).map(getText).filter(Boolean);
  const mailReceived = () => toArray(player()?.mailReceived?.string).map(getText).filter(Boolean);

  const addEvent = (id: string) => {
    if (!id.trim()) return;
    const events = toArray(player()?.eventsSeen?.int);
    const exists = eventsSeen().includes(id);

    if (exists) {
      addToast(`Event ID ${id} already exists.`, 'info');
      return;
    }

    const newEvents = [...events];
    const template = events.length > 0 ? (typeof events[0] === 'object' ? { '#text': id } : id) : id;
    newEvents.push(template);
    
    const p = pv()?.SaveGame ? 'SaveGame.player.eventsSeen.int' : 'player.eventsSeen.int';
    updateValue(p, newEvents);
    setNewlyAdded(prev => new Set(prev).add(`event-${id}`));
    setTimeout(() => {
      setNewlyAdded(prev => {
        const next = new Set(prev);
        next.delete(`event-${id}`);
        return next;
      });
    }, 600);
    addToast(`Event ID ${id} added.`, 'success');
    setEventInput('');
  };

  const removeEvent = (id: string) => {
    const events = toArray(player()?.eventsSeen?.int);
    const newEvents = events.filter(e => getText(e) !== id);
    
    const p = pv()?.SaveGame ? 'SaveGame.player.eventsSeen.int' : 'player.eventsSeen.int';
    updateValue(p, newEvents);
    addToast(`Event ID ${id} removed.`, 'warning');
  };

  // Fungsi Toggle Mail Tunggal
  const addMail = (id: string) => {
    if (!id.trim()) return;
    const mails = toArray(player()?.mailReceived?.string);
    const exists = mailReceived().includes(id);

    if (exists) {
      addToast(`Mail ID ${id} already exists.`, 'info');
      return;
    }

    const newMails = [...mails];
    const template = mails.length > 0 ? (typeof mails[0] === 'object' ? { '#text': id } : id) : id;
    newMails.push(template);
    
    const p = pv()?.SaveGame ? 'SaveGame.player.mailReceived.string' : 'player.mailReceived.string';
    updateValue(p, newMails);
    setNewlyAdded(prev => new Set(prev).add(`mail-${id}`));
    setTimeout(() => {
      setNewlyAdded(prev => {
        const next = new Set(prev);
        next.delete(`mail-${id}`);
        return next;
      });
    }, 600);
    addToast(`Mail ID ${id} added.`, 'success');
    setMailInput('');
  };

  const removeMail = (id: string) => {
    const mails = toArray(player()?.mailReceived?.string);
    const newMails = mails.filter(m => getText(m) !== id);
    
    const p = pv()?.SaveGame ? 'SaveGame.player.mailReceived.string' : 'player.mailReceived.string';
    updateValue(p, newMails);
    addToast(`Mail ID ${id} removed.`, 'warning');
  };

  const hasMail = (id: string) => mailReceived().includes(id);
  const hasEvent = (id: string) => eventsSeen().includes(id);
  const hasAllFlags = (mails: string[], events: string[]) => {
    return mails.every(m => hasMail(m)) && events.every(e => hasEvent(e));
  };

  const executeMajorUnlock = () => {
    const unlock = pendingUnlock();
    if (!unlock) return;

    const isUnlocked = hasAllFlags(unlock.mails, unlock.events);
    let currentMails = [...toArray(player()?.mailReceived?.string)];
    let currentEvents = [...toArray(player()?.eventsSeen?.int)];

    unlock.mails.forEach((m: string) => {
      if (isUnlocked) {
        currentMails = currentMails.filter(cm => getText(cm) !== m);
      } else {
        if (!hasMail(m)) {
           const template = currentMails.length > 0 ? (typeof currentMails[0] === 'object' ? { '#text': m } : m) : m;
           currentMails.push(template);
        }
      }
    });

    unlock.events.forEach((e: string) => {
      if (isUnlocked) {
        currentEvents = currentEvents.filter(ce => getText(ce) !== e);
      } else {
        if (!hasEvent(e)) {
           const template = currentEvents.length > 0 ? (typeof currentEvents[0] === 'object' ? { '#text': e } : e) : e;
           currentEvents.push(template);
        }
      }
    });

    const mPath = pv()?.SaveGame ? 'SaveGame.player.mailReceived.string' : 'player.mailReceived.string';
    const ePath = pv()?.SaveGame ? 'SaveGame.player.eventsSeen.int' : 'player.eventsSeen.int';
    
    updateValue(mPath, currentMails);
    updateValue(ePath, currentEvents);

    addToast(`${unlock.label} has been ${isUnlocked ? 'Locked' : 'Unlocked'} successfully!`, isUnlocked ? 'warning' : 'success');

    setModalOpen(false);
    setPendingUnlock(null);
  };

  const handleUnlockClick = (unlock: any) => {
    setPendingUnlock(unlock);
    setModalOpen(true);
  };

  const majorUnlocks = [
    { id: 'greenhouse', label: 'Unlock Greenhouse', icon: Sprout, mails: ['ccPantry'], events: [] },
    { id: 'minecarts', label: 'Fix Minecarts', icon: Train, mails: ['ccBoilerRoom'], events: [] },
    { id: 'bus', label: 'Fix Desert Bus', icon: Bus, mails: ['ccVault'], events: [] },
    { id: 'bridge', label: 'Repair Quarry Bridge', icon: Hammer, mails: ['ccCraftsRoom'], events: [] },
    { id: 'boat', label: 'Unlock Island Boat', icon: Ship, mails: ['willyBoatFixed', 'willyBackRoomInvitation'], events: [] },
    { id: 'cc', label: 'Complete CC', icon: Building2, mails: ['ccPantry', 'ccBoilerRoom', 'ccVault', 'ccCraftsRoom', 'ccFishTank', 'ccBulletin'], events: ['191393'] },
    { id: 'joja', label: 'Complete Joja', icon: Warehouse, mails: ['jojaPantry', 'jojaBoilerRoom', 'jojaVault', 'jojaCraftsRoom', 'jojaFishTank', 'JojaMember'], events: ['502261'] }
  ];

  return (
    <div class="flex flex-col gap-24">
      <style>{`
        @keyframes highlightAdd {
          0% { background-color: rgba(76, 175, 80, 0.4); transform: scale(0.98); border-color: #4caf50; }
          100% { background-color: rgba(255, 255, 255, 0.5); transform: scale(1); border-color: rgba(255, 255, 255, 0.4); }
        }
        .animate-highlight {
          animation: highlightAdd 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .list-anim-enter-active,
        .list-anim-exit-active {
          transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
          overflow: hidden;
        }
        .list-anim-enter {
          opacity: 0;
          transform: translateY(-20px);
          max-height: 0;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
          border-width: 0 !important;
        }
        .list-anim-enter-to {
          opacity: 1;
          transform: translateY(0);
          max-height: 120px;
          padding-top: 1rem !important;
          padding-bottom: 1rem !important;
          margin-bottom: 1rem !important;
          border-width: 1px !important;
        }
        .list-anim-exit {
          opacity: 1;
          transform: translateX(0);
          max-height: 120px;
          padding-top: 1rem !important;
          padding-bottom: 1rem !important;
          margin-bottom: 1rem !important;
          border-width: 1px !important;
        }
        .list-anim-exit-to {
          opacity: 0;
          transform: translateX(60px);
          max-height: 0;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
          border-width: 0 !important;
        }
      `}</style>

      <Modal 
        isOpen={deleteModalOpen()} 
        onClose={() => setDeleteModalOpen(false)} 
        title="Confirm Deletion"
        icon={<AlertTriangle size={20} class="text-red-500" />}
      >
        <Show when={itemToDelete()}>
          {(item) => (
            <div class="flex flex-col gap-16 text-zinc-300 font-serif">
              <p>
                Are you sure you want to delete this <strong class="text-red-400">{item().type}</strong> ID <strong>{item().id}</strong>?
              </p>
              <div class="flex gap-12 mt-8">
                <button 
                  onClick={() => setDeleteModalOpen(false)} 
                  class="flex-1 py-12 rounded cursor-pointer bg-[#e6b167] hover:bg-[#d98b48] text-[#4d2503] font-bold transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const i = itemToDelete();
                    if (i) {
                      if (i.type === 'event') removeEvent(i.id);
                      else removeMail(i.id);
                    }
                    setDeleteModalOpen(false);
                    setItemToDelete(null);
                  }} 
                  class="flex-1 py-12 rounded cursor-pointer bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </Show>
      </Modal>

      <Modal 
        isOpen={modalOpen()} 
        onClose={() => setModalOpen(false)} 
        title="Confirm Modification"
        icon={<AlertTriangle size={20} class="text-[#c0733a]" />}
      >
        <Show when={pendingUnlock()}>
          {(unlock) => {
            const willUnlock = !hasAllFlags(unlock().mails, unlock().events);
            return (
              <div class="flex flex-col gap-16 text-zinc-300 font-serif">
                <p>
                  Are you sure you want to <strong class={willUnlock ? 'text-green-400' : 'text-red-400'}>{willUnlock ? 'UNLOCK' : 'LOCK'}</strong> the <strong>{unlock().label}</strong> feature?
                </p>
                <div class="bg-black/50 p-12 border-l-4 border-[#c0733a] text-sm text-zinc-200">
                  <p class="mb-4 font-bold text-[#e6b167] flex items-center gap-8"><Info size={16}/> This will modify the following flags:</p>
                  <ul class="list-disc list-inside ml-8">
                    <li>{unlock().mails.length} Mail Flags</li>
                    <li>{unlock().events.length} Event Flags</li>
                  </ul>
                </div>
                <div class="flex gap-12 mt-8">
                  <button 
                    onClick={() => setModalOpen(false)} 
                    class="flex-1 py-12 rounded cursor-pointer bg-[#e6b167] hover:bg-[#d98b48] text-[#4d2503] font-bold transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={executeMajorUnlock} 
                    class={`flex-1 py-12 rounded cursor-pointer text-white font-bold transition-colors shadow-sm ${willUnlock ? 'bg-[#4caf50] hover:bg-[#43a047]' : 'bg-red-500 hover:bg-red-600'}`}
                  >
                    Confirm {willUnlock ? 'Unlock' : 'Lock'}
                  </button>
                </div>
              </div>
            );
          }}
        </Show>
      </Modal>

      <div class="bg-[#f4d499] border-[6px] border-[#c0733a] p-16 rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)] font-desc text-black">
        <h2 class="text-[28px] leading-[32px] font-desc border-b-2 border-black pb-4 mb-8">Major Unlocks</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
          <For each={majorUnlocks}>
            {(unlock) => {
              const active = () => hasAllFlags(unlock.mails, unlock.events);
              const Icon = unlock.icon;
              return (
                <Tooltip text={active() ? `Click to lock ${unlock.label}` : `Click to unlock ${unlock.label}`} position="top">
                  <div 
                    onClick={() => handleUnlockClick(unlock)}
                    class={`relative flex flex-col items-center justify-center p-12 rounded-8 border-4 cursor-pointer transition-all hover:-translate-y-1 group overflow-hidden w-full ${
                      active() 
                        ? 'bg-white border-[#4caf50] shadow-[0_4px_12px_rgba(76,175,80,0.3)]' 
                        : 'bg-[#fce8b8] border-[#c0733a] opacity-80 hover:opacity-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]'
                    }`}
                  >
                    <Show when={active()}>
                      <div class="absolute top-4 right-4 text-[#4caf50]">
                        <Check size={20} strokeWidth={3} />
                      </div>
                    </Show>
                    <Icon size={40} class={`mb-4 transition-colors ${active() ? 'text-[#4caf50]' : 'text-[#c0733a] group-hover:text-[#a05a28]'}`} />
                    <span class="font-desc font-bold text-center text-[14px] leading-tight select-none">
                      {unlock.label}
                    </span>
                  </div>
                </Tooltip>
              );
            }}
          </For>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-24">
        {/* Events Seen */}
        <div class="bg-[#f4d499] border-[6px] border-[#c0733a] p-16 rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)] font-desc text-black flex flex-col max-h-[500px]">
          <h2 class="text-[28px] leading-[32px] font-desc border-b-2 border-black pb-4 mb-8">Events Seen</h2>
          <div class="flex gap-8 mb-12">
            <input 
              type="text" 
              value={eventInput()}
              onChange={(e) => setEventInput(e.target.value)}
              placeholder="Search or Enter Event ID..."
              list="eventsList"
              class="flex-1 bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-4 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] focus:outline-none focus:border-[#8c4614]"
              onKeyDown={(e) => e.key === 'Enter' && addEvent(eventInput())}
            />
            <datalist id="eventsList">
              <For each={storyData.events}>
                {(ev) => <option value={ev.id}>{ev.desc || ev.id}</option>}
              </For>
            </datalist>
            <button 
              onClick={() => addEvent(eventInput())}
              class="bg-[#4caf50] cursor-pointer hover:bg-[#45a049] text-white px-12 py-4 rounded font-bold transition-colors shadow-sm border border-black/20"
            >
              Add
            </button>
          </div>
          <div class="flex-1 overflow-y-auto stardew-scrollbar pr-4 flex flex-col">
            <TransitionGroup name="list-anim">
              <For each={eventsSeen().slice().reverse()}>
                {(id) => (
                  <div class={`flex items-center justify-between p-4 px-6 rounded border hover:bg-white/80 transition-colors shadow-sm gap-4 mb-4 ${newlyAdded().has(`event-${id}`) ? 'animate-highlight' : 'bg-white/50 border-white/40'}`}>
                    <div class="flex flex-col min-w-0 flex-1">
                      <span class="font-brains font-bold text-[14px]">{id}</span>
                      <Show when={eventDescMap[id]}>
                        <span class="text-[12px] opacity-75 font-sans truncate" title={eventDescMap[id]}>
                          {eventDescMap[id]}
                        </span>
                      </Show>
                    </div>
                    <Tooltip text="Remove Event" position="bottom" align="right">
                      <button onClick={() => {
                        setItemToDelete({ id, type: 'event' });
                        setDeleteModalOpen(true);
                      }} class="text-red-500 cursor-pointer hover:text-white font-bold p-2 hover:bg-red-500 rounded-md shrink-0 transition-colors shadow-sm border border-transparent hover:border-red-600">
                        <Trash2 size={16} />
                      </button>
                    </Tooltip>
                  </div>
                )}
              </For>
            </TransitionGroup>
            <Show when={eventsSeen().length === 0}>
              <div class="text-black/50 text-center italic py-8">No events seen</div>
            </Show>
          </div>
        </div>

        {/* Mail Received */}
        <div class="bg-[#f4d499] border-[6px] border-[#c0733a] p-16 rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)] font-desc text-black flex flex-col max-h-[500px]">
          <h2 class="text-[28px] leading-[32px] font-desc border-b-2 border-black pb-4 mb-8">Mail Received</h2>
          <div class="flex gap-8 mb-12">
            <input 
              type="text" 
              value={mailInput()}
              onChange={(e) => setMailInput(e.target.value)}
              placeholder="Search or Enter Mail ID..."
              list="mailsList"
              class="flex-1 bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-4 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] focus:outline-none focus:border-[#8c4614]"
              onKeyDown={(e) => e.key === 'Enter' && addMail(mailInput())}
            />
            <datalist id="mailsList">
              <For each={storyData.mails}>
                {(m) => <option value={m.id}>{m.desc || m.id}</option>}
              </For>
            </datalist>
            <button 
              onClick={() => addMail(mailInput())}
              class="bg-[#4caf50] cursor-pointer hover:bg-[#45a049] text-white px-12 py-4 rounded font-bold transition-colors shadow-sm border border-black/20"
            >
              Add
            </button>
          </div>
          <div class="flex-1 overflow-y-auto stardew-scrollbar pr-4 flex flex-col">
            <TransitionGroup name="list-anim">
              <For each={mailReceived().slice().reverse()}>
                {(id) => (
                  <div class={`flex items-center justify-between p-4 px-6 rounded border hover:bg-white/80 transition-colors shadow-sm gap-4 mb-4 ${newlyAdded().has(`mail-${id}`) ? 'animate-highlight' : 'bg-white/50 border-white/40'}`}>
                    <div class="flex flex-col min-w-0 flex-1">
                      <span class="font-desc font-bold text-[14px]">{id}</span>
                      <Show when={mailDescMap[id]}>
                        <span class="text-[12px] opacity-75 font-sans truncate" title={mailDescMap[id]}>
                          {mailDescMap[id]}
                        </span>
                      </Show>
                    </div>
                    <Tooltip text="Remove Mail" position="bottom" align="right">
                      <button onClick={() => {
                        setItemToDelete({ id, type: 'mail' });
                        setDeleteModalOpen(true);
                      }} class="text-red-500 cursor-pointer hover:text-white font-bold p-2 hover:bg-red-500 rounded-md shrink-0 transition-colors shadow-sm border border-transparent hover:border-red-600">
                        <Trash2 size={16} />
                      </button>
                    </Tooltip>
                  </div>
                )}
              </For>
            </TransitionGroup>
            <Show when={mailReceived().length === 0}>
              <div class="text-black/50 text-center italic py-8">No mail received</div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};