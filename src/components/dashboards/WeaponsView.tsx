import { createSignal, createMemo, For, Show } from 'solid-js';
import { useEditorStore, updateValue, deleteValue } from '../../store/editorStore';
import { addToast } from '../../store/toastStore';
import { Sword, Plus, Trash2, Check, X } from 'lucide-solid';
import { Modal } from '../Modal';
import { createVirtualizer } from '@tanstack/solid-virtual';

export const WeaponsView = () => {
  const store = useEditorStore();

  const [isAddModalOpen, setIsAddModalOpen] = createSignal(false);
  const [manualWeaponId, setManualWeaponId] = createSignal("");
  const [selectedWeaponIds, setSelectedWeaponIds] = createSignal<string[]>([]);
  const [newWeaponQty, setNewWeaponQty] = createSignal(1);
  const [weaponToDelete, setWeaponToDelete] = createSignal<{id: string, name?: string} | null>(null);
  
  const [isSelectionMode, setIsSelectionMode] = createSignal(false);
  const [selectedForBulkDelete, setSelectedForBulkDelete] = createSignal<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = createSignal(false);

  const [searchQuery, setSearchQuery] = createSignal("");
  
  const filteredDatabase = createMemo(() => {
    const db = store.gameDatabase?.weapons;
    if (!db) return [];
    const query = searchQuery().toLowerCase();
    const entries = Object.entries(db);
    if (!query) return entries.slice(0, 50);
    return entries.filter(([id, name]) => id.includes(query) || name.toLowerCase().includes(query)).slice(0, 50);
  });

  const hasDatabase = createMemo(() => {
    return store.gameDatabase?.weapons && Object.keys(store.gameDatabase.weapons).length > 0;
  });

  const weaponsList = createMemo(() => {
    const rawWeapons = store.saveData?.parsed_variables?.party?._weapons || {};
    
    return Object.entries(rawWeapons)
      .filter(([key]) => key !== '@c' && key !== '@')
      .map(([id, quantity]) => ({
        id,
        quantity: Number(quantity)
      }))
      .sort((a, b) => Number(a.id) - Number(b.id)); 
  });

  let scrollRef: HTMLDivElement | undefined;
  
  const virtualizer = createVirtualizer({
    get count() { return weaponsList().length; },
    getScrollElement: () => scrollRef || null,
    estimateSize: () => 73,
    overscan: 5,
  });

  const handleQuantityChange = (weaponId: string, newQuantity: string) => {
    const val = Number(newQuantity);
    if (!isNaN(val)) {
      updateValue(`party._weapons.${weaponId}`, val);
    }
  };

  const handleConfirmAdd = () => {
    const qty = Number(newWeaponQty());
    if (isNaN(qty)) {
      addToast('Invalid quantity', 'error');
      return;
    }

    try {
      let addedCount = 0;
      if (hasDatabase()) {
        const ids = selectedWeaponIds();
        ids.forEach(id => { updateValue(`party._weapons.${id}`, qty); addedCount++; });
      } else {
        const ids = manualWeaponId().split(',').map(s => s.trim()).filter(s => s && !isNaN(Number(s)));
        ids.forEach(id => { updateValue(`party._weapons.${id}`, qty); addedCount++; });
      }

      if (addedCount > 0) {
        addToast(`Successfully injected ${addedCount} weapon(s)`, 'success');
      } else {
        addToast('No weapons selected', 'warning');
      }

      setManualWeaponId("");
      setSelectedWeaponIds([]);
      setNewWeaponQty(1);
      setSearchQuery("");
      setIsAddModalOpen(false);
    } catch (err) {
      addToast('Failed to inject weapon(s)', 'error');
    }
  };

  const confirmDelete = () => {
    const weapon = weaponToDelete();
    if (weapon) {
      deleteValue(`party._weapons.${weapon.id}`);
      setSelectedForBulkDelete(prev => prev.filter(id => id !== weapon.id));
      addToast(`Purged weapon ID ${weapon.id} successfully`, 'success');
      setWeaponToDelete(null);
    }
  };

  const confirmBulkDelete = () => {
    const ids = selectedForBulkDelete();
    ids.forEach(id => deleteValue(`party._weapons.${id}`));
    addToast(`Purged ${ids.length} weapon(s) successfully`, 'success');
    setSelectedForBulkDelete([]);
    setIsBulkDeleteModalOpen(false);
    setIsSelectionMode(false);
  };

  return (
    <div class="flex flex-col gap-8 w-full max-w-5xl mx-auto relative h-full flex-1 min-h-0">
      
      {/* HEADER */}
      <div class="flex items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
        <div class="flex items-center gap-4">
          <div class="w-2 h-8 bg-[#00F0FF]"></div>
          <h2 class="text-4xl font-[Hacked] text-zinc-100 tracking-widest uppercase drop-shadow-[2px_2px_0px_#00F0FF]">
            WEAPONS DATABASE
          </h2>
        </div>
        
        <div class="flex items-center gap-2">
          <Show when={isSelectionMode()}>
            <Show when={selectedForBulkDelete().length > 0}>
              <button 
                onClick={() => setIsBulkDeleteModalOpen(true)}
                class="px-4 cursor-pointer py-2 bg-[#150505] border border-[#FF5252] hover:bg-[#FF5252] text-[#FF5252] hover:text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_#FF5252] hover:-translate-y-0.5 hover:-translate-x-0.5"
              >
                <Trash2 size={14} /> Delete ({selectedForBulkDelete().length})
              </button>
            </Show>
            <button 
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedForBulkDelete([]);
              }}
              class="px-4 cursor-pointer py-2 bg-zinc-950 border border-zinc-700 hover:border-white hover:text-white text-zinc-400 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:-translate-x-0.5"
            >
              <X size={14} /> Cancel
            </button>
          </Show>
          <Show when={!isSelectionMode() && weaponsList().length > 0}>
            <button 
              onClick={() => setIsSelectionMode(true)}
              class="px-4 cursor-pointer py-2 bg-zinc-950 border border-[#00F0FF] hover:border-[#00F0FF] hover:text-[#00F0FF] text-zinc-400 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_#00F0FF] hover:-translate-y-0.5 hover:-translate-x-0.5"
            >
              <Check size={14} /> Select
            </button>
          </Show>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            class="px-4 cursor-pointer py-2 bg-zinc-950 border border-[#00F0FF] hover:border-[#00F0FF] hover:text-[#00F0FF] text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_#00F0FF] hover:-translate-y-0.5 hover:-translate-x-0.5"
          >
            <Plus size={14} /> Add New
          </button>
        </div>
      </div>
      
      {/* TABLE CONTAINER */}
      <div class="bg-[#0a0a0a] border-2 border-zinc-800 shadow-[4px_4px_0px_rgba(0,240,255,0.2)] flex flex-col flex-1 min-h-0">

        <div class={`grid ${isSelectionMode() ? 'grid-cols-[60px_80px_100px_1fr_120px]' : 'grid-cols-[80px_100px_1fr_120px]'} gap-4 items-center p-4 border-b-2 border-zinc-800 bg-zinc-950 text-zinc-500 text-[10px] font-black uppercase tracking-widest shrink-0`}>
          <Show when={isSelectionMode()}>
            <div class="flex items-center justify-center">
              <div 
                onClick={() => {
                  if (weaponsList().length > 0 && selectedForBulkDelete().length === weaponsList().length) {
                    setSelectedForBulkDelete([]);
                  } else {
                    setSelectedForBulkDelete(weaponsList().map(w => w.id));
                  }
                }}
                class={`w-16 h-16 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                  weaponsList().length > 0 && selectedForBulkDelete().length === weaponsList().length
                    ? 'bg-[#FF5252] border-[#FF5252] opacity-100'
                    : 'border-zinc-400 opacity-50 hover:opacity-100'
                }`}
              >
                <Show when={weaponsList().length > 0 && selectedForBulkDelete().length === weaponsList().length}>
                  <Check size={16} class="text-white" />
                </Show>
              </div>
            </div>
          </Show>
          <div class="text-center">Icon</div>
          <div>Weapon ID</div>
          <div>Name / Reference</div>
          <div class="text-right">Value (Qty)</div>
        </div>

        {/* Table Body (Virtualized) */}
        <div class="flex flex-col font-brains flex-1 overflow-y-auto custom-scrollbar min-h-0" ref={scrollRef}>
          <Show 
            when={weaponsList().length > 0}
            fallback={
              <div class="p-16 flex items-center justify-center text-zinc-600 font-bold tracking-widest border-t border-dashed border-zinc-800 uppercase text-sm">
                {">>"} WEAPONS INVENTORY IS EMPTY_
              </div>
            }
          >
            <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              <For each={virtualizer.getVirtualItems()}>
                {(virtualRow) => {
                  const weapon = weaponsList()[virtualRow.index];
                  return (
                    <div 
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`
                      }}

                      class={`grid ${isSelectionMode() ? 'grid-cols-[60px_80px_100px_1fr_120px]' : 'grid-cols-[80px_100px_1fr_120px]'} gap-4 items-center p-4 border-b border-zinc-800/50 hover:bg-[#00F0FF]/5 transition-colors group box-border`}
                    >
                      <Show when={isSelectionMode()}>
                        <div class="flex items-center justify-center shrink-0">
                          <div 
                            onClick={() => {
                              if (selectedForBulkDelete().includes(weapon.id)) {
                                setSelectedForBulkDelete(prev => prev.filter(id => id !== weapon.id));
                              } else {
                                setSelectedForBulkDelete(prev => [...prev, weapon.id]);
                              }
                            }}
                            class={`w-19 h-19 rounded-full flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                              selectedForBulkDelete().includes(weapon.id) 
                                ? 'bg-[#FF5252] border-2 border-[#FF5252] opacity-100' 
                                : 'border-2 border-zinc-400 opacity-30 hover:opacity-100'
                            }`}
                          >
                            <Show when={selectedForBulkDelete().includes(weapon.id)}>
                              <Check size={20} class="text-white" />
                            </Show>
                          </div>
                        </div>
                      </Show>
                      <div class="flex justify-center text-zinc-600 group-hover:text-[#00F0FF] transition-colors shrink-0">
                        <Sword size={20} />
                      </div>
                      
                      <div class="text-zinc-500 text-sm font-bold shrink-0 font-sans tracking-widest">
                        ID: {weapon.id}
                      </div>
                      
                      <div class="flex flex-col overflow-hidden">
                        <span class="text-zinc-200 font-bold uppercase tracking-widest text-sm truncate">
                          {store.gameDatabase?.weapons?.[Number(weapon.id)] || `Weapon #${weapon.id}`}
                        </span>
                        <Show when={store.gameDatabase?.weapons?.[Number(weapon.id)]}>
                          <span class="text-[10px] text-[#00F0FF] font-sans tracking-widest uppercase mt-0.5">
                            RAW ID: {weapon.id}
                          </span>
                        </Show>
                      </div>
                      
                      <div class="flex justify-end items-center gap-3 shrink-0">
                        <input 
                          type="number" 
                          value={weapon.quantity}
                          onInput={(e) => handleQuantityChange(weapon.id, e.target.value)}
                          class="w-[110px] bg-[#050505] border border-zinc-800 px-3 py-1.5 text-[#00F0FF] font-bold text-right focus:outline-none focus:border-[#00F0FF] focus:shadow-[2px_2px_0px_#00F0FF] transition-all rounded-none"
                        />
                        <button
                          onClick={() => setWeaponToDelete({
                            id: weapon.id,
                            name: store.gameDatabase?.weapons?.[Number(weapon.id)] || `Weapon #${weapon.id}`
                          })}
                          class="p-1.5 cursor-pointer text-zinc-600 hover:text-[#FF5252] hover:bg-[#FF5252]/10 border border-transparent hover:border-[#FF5252]/30 transition-all"
                          title="Delete Weapon"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>
      </div>

      {/* ADD NEW WEAPON MODAL */}
      <Modal
        isOpen={isAddModalOpen()}
        onClose={() => setIsAddModalOpen(false)}
        title="INJECT NEW WEAPON"
        icon={<Sword size={18} class="text-[#00F0FF]" />}
        width="max-w-sm"
      >
        <div class="flex flex-col gap-6 font-brains">
          <div class="flex flex-col gap-4">
            
            {/* Input ID */}
            <Show when={hasDatabase()} fallback={
              <div class="flex flex-col gap-2">
                <label class="text-[10px] text-[#00F0FF] font-black tracking-widest uppercase">Weapon ID (Comma separated for multiple)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 5, 6, 8"
                  value={manualWeaponId()}
                  onInput={(e) => setManualWeaponId(e.target.value)}
                  class="w-full bg-[#050505] border border-zinc-700 px-4 py-3 text-zinc-200 focus:outline-none focus:border-[#00F0FF] focus:shadow-[2px_2px_0px_#00F0FF] transition-all rounded-none font-sans"
                />
              </div>
            }>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] text-[#00F0FF] font-black tracking-widest uppercase">Select Weapons ({selectedWeaponIds().length} selected)</label>
                <input 
                  type="text" 
                  placeholder="Search weapon name or ID..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.target.value)}
                  class="w-full bg-[#050505] border border-zinc-700 px-4 py-3 text-zinc-200 focus:outline-none focus:border-[#00F0FF] focus:shadow-[2px_2px_0px_#00F0FF] transition-all rounded-none mb-2"
                />
                <div class="max-h-[150px] overflow-y-auto border border-zinc-800 bg-[#0a0a0a] custom-scrollbar flex flex-col font-sans">
                  <For each={filteredDatabase()}>
                    {([id, name]) => {
                      const isSelected = () => selectedWeaponIds().includes(id);
                      return (
                        <button
                          onClick={() => {
                            if (isSelected()) setSelectedWeaponIds(prev => prev.filter(i => i !== id));
                            else setSelectedWeaponIds(prev => [...prev, id]);
                          }}
                          class={`text-left cursor-pointer px-3 py-2 text-sm transition-colors ${isSelected() ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-l-2 border-[#00F0FF]' : 'text-zinc-400 hover:bg-zinc-900 border-l-2 border-transparent'}`}
                        >
                          <span class="font-bold">[{id}]</span> {name}
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>

            {/* Input Quantity */}
            <div class="flex flex-col gap-2">
              <label class="text-[10px] text-[#00F0FF] font-black tracking-widest uppercase">Quantity</label>
              <input 
                type="number" 
                value={newWeaponQty()}
                onInput={(e) => setNewWeaponQty(Number(e.target.value))}
                class="w-full bg-[#050505] border border-zinc-700 px-4 py-3 text-zinc-200 focus:outline-none focus:border-[#00F0FF] focus:shadow-[2px_2px_0px_#00F0FF] transition-all rounded-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div class="flex gap-4 mt-2">
            <button 
              onClick={() => setIsAddModalOpen(false)} 
              class="flex-1 py-3 cursor-pointer bg-transparent border border-zinc-700 hover:text-white hover:bg-zinc-800 text-zinc-400 font-bold text-xs tracking-widest uppercase transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirmAdd} 
              disabled={hasDatabase() ? selectedWeaponIds().length === 0 : !manualWeaponId().trim()}
              class="flex-1 py-3 cursor-pointer bg-[#00F0FF]/10 border border-[#00F0FF] hover:bg-[#00F0FF] hover:text-black text-[#00F0FF] font-bold text-xs tracking-widest uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_#00F0FF]"
            >
              Inject
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!weaponToDelete()}
        onClose={() => setWeaponToDelete(null)}
        title="DELETE WEAPON"
        icon={<Trash2 size={18} class="text-[#FF5252]" />}
        width="max-w-sm"
      >
        <div class="flex flex-col gap-6 font-brains">
          <div class="flex flex-col gap-2">
            <p class="text-zinc-400 text-sm tracking-widest uppercase">
              Are you sure you want to completely erase this weapon from the inventory?
            </p>
            <div class="mt-2 p-3 bg-[#150505] border border-[#FF5252]/30 text-[#FF5252] font-bold tracking-widest text-sm flex items-center justify-between">
              <span>{weaponToDelete()?.name}</span>
              <span class="text-[10px] opacity-70">ID: {weaponToDelete()?.id}</span>
            </div>
            <p class="text-[10px] text-zinc-500 mt-2 uppercase tracking-widest font-sans">
              Warning: This action will set the quantity to 0 and remove the ID from the party database.
            </p>
          </div>

          <div class="flex gap-4 mt-2">
            <button 
              onClick={() => setWeaponToDelete(null)} 
              class="flex-1 py-3 cursor-pointer bg-transparent border border-zinc-700 hover:text-white hover:bg-zinc-800 text-zinc-400 font-bold text-xs tracking-widest uppercase transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={confirmDelete} 
              class="flex-1 py-3 cursor-pointer bg-[#FF5252]/10 border border-[#FF5252] hover:bg-[#FF5252] hover:text-black text-[#FF5252] font-bold text-xs tracking-widest uppercase transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_#FF5252]"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* BULK DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isBulkDeleteModalOpen()}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="BULK DELETE WEAPONS"
        icon={<Trash2 size={18} class="text-[#FF5252]" />}
        width="max-w-sm"
      >
        <div class="flex flex-col gap-6 font-brains">
          <div class="flex flex-col gap-2">
            <p class="text-zinc-400 text-sm tracking-widest uppercase">
              Are you sure you want to permanently delete {selectedForBulkDelete().length} weapon(s)?
            </p>
            <p class="text-[10px] text-[#FF5252] mt-2 uppercase tracking-widest font-sans font-bold">
              Warning: This action cannot be easily undone. All selected weapons will be removed from your inventory.
            </p>
          </div>

          <div class="flex gap-4 mt-2">
            <button 
              onClick={() => setIsBulkDeleteModalOpen(false)} 
              class="flex-1 py-3 cursor-pointer bg-transparent border border-zinc-700 hover:text-white hover:bg-zinc-800 text-zinc-400 font-bold text-xs tracking-widest uppercase transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={confirmBulkDelete} 
              class="flex-1 py-3 cursor-pointer bg-[#FF5252]/10 border border-[#FF5252] hover:bg-[#FF5252] hover:text-black text-[#FF5252] font-bold text-xs tracking-widest uppercase transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_#FF5252]"
            >
              Delete All
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};