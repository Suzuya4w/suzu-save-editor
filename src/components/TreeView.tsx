// @ts-nocheck
import { createSignal, createEffect, For, Index, Show } from 'solid-js';
import { useEditorStore, toggleExpand, updateValue, setSearchQuery, expandAll, collapseAll, addValue, duplicateValue, deleteValue, renameKey } from '../store/editorStore';
import { Search, FolderOpen, FolderClosed, Copy, Plus, CopyPlus, Trash2, Code, Edit2, Check, X } from 'lucide-solid';
import { addToast } from '../store/toastStore';
import { ViewJsonModal } from './ViewJsonModal';
import { Modal } from './Modal';

function Tooltip(props: { text: string, position?: 'top' | 'bottom', align?: 'center' | 'left' | 'right', class?: string, children: any }) {
  const [show, setShow] = createSignal(false);
 
  let alignmentClass = 'left-1/2 -translate-x-1/2';
  if (props.align === 'left') alignmentClass = 'left-0';
  if (props.align === 'right') alignmentClass = 'right-0';

  return (
    <div
      class="relative inline-flex items-center justify-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {props.children}
      <Show when={show()}>
        <div class={`absolute z-[100] whitespace-nowrap px-2 py-1 bg-black text-white text-[10px] font-black tracking-widest uppercase border-2 border-white pointer-events-none shadow-[4px_4px_0px_white] ${alignmentClass} ${props.position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} ${props.class || ''}`}>
          {props.text}
        </div>
      </Show>
    </div>
  );
}

import { createVirtualizer } from '@tanstack/solid-virtual';

const HighlightText = (props: { text: string, query: string }) => {
  return (
    <Show when={props.query && props.text.toLowerCase().includes(props.query.toLowerCase())} fallback={props.text}>
      {() => {
        const parts = props.text.split(new RegExp(`(${props.query})`, 'gi'));
        return (
          <>
            <For each={parts}>{(part) => (
              part.toLowerCase() === props.query.toLowerCase() 
                ? <span class="bg-[#FF7A00]/40 text-yellow-100 px-0.5 rounded-[1px]">{part}</span> 
                : <span class="whitespace-pre-wrap">{part}</span>
            )}</For>
          </>
        )
      }}
    </Show>
  );
};

export const TreeView = () => {
  const editorState = useEditorStore();
  const [localValues, setLocalValues] = createSignal<Record<string, any>>({});

  const handleInputChange = (path: string, newValue: any) => {
    setLocalValues((prev) => ({ ...prev, [path]: newValue }));
  };

  const handleInputBlur = (path: string, type: string) => {
    let val = localValues()[path];
    if (val === undefined) return;

    if (type === 'number') {
      val = Number(val);
      if (isNaN(val)) return;
    }
    
    updateValue(path, val);

    setLocalValues((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const handleToggleBoolean = (path: string, currentVal: boolean) => {
    updateValue(path, !currentVal);
  };

  let parentRef: HTMLDivElement | undefined;

  const virtualizer = createVirtualizer({
    get count() { return editorState.flattenedNodes.length },
    getScrollElement: () => parentRef || null,
    estimateSize: () => 50,
  });

  const getRealValue = (path: string) => {
    if (!path) return editorState.saveData?.parsed_variables;
    let current = editorState.saveData?.parsed_variables;
    const parts = path.split('.');
    for (let i = 0; i < parts.length; i++) {
      if (current === undefined || current === null) return null;
      current = current[parts[i]];
    }
    return current;
  };

  const [jsonModalOpen, setJsonModalOpen] = createSignal(false);
  const [jsonModalData, setJsonModalData] = createSignal({ path: '', json: null });
  const [renamingPath, setRenamingPath] = createSignal<string | null>(null);
  const [renamingTemp, setRenamingTemp] = createSignal<string>("");
  
  const [confirmModalData, setConfirmModalData] = createSignal<{ isOpen: boolean, action: 'delete' | 'duplicate' | null, path: string }>({ isOpen: false, action: null, path: '' });

  const [addModalData, setAddModalData] = createSignal<{ isOpen: boolean, path: string }>({ isOpen: false, path: '' });
  const [addSelectedType, setAddSelectedType] = createSignal<'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'>('string');
  const [addCustomKey, setAddCustomKey] = createSignal<string>('');
  const [addCustomValue, setAddCustomValue] = createSignal<string>('');

  const requestAdd = (path: string) => {
    setAddModalData({ isOpen: true, path });
    setAddSelectedType('string');
    setAddCustomKey('');
    setAddCustomValue('');
  };

  const requestConfirm = (action: 'delete' | 'duplicate', path: string) => {
    setConfirmModalData({ isOpen: true, action, path });
  };

  const handleConfirm = () => {
    const data = confirmModalData();
    if (data.action === 'delete') {
      deleteValue(data.path);
    } else if (data.action === 'duplicate') {
      duplicateValue(data.path);
    }
    setConfirmModalData(prev => ({ ...prev, isOpen: false }));
  };

  const openJsonModal = (path: string, json: any) => {
    setJsonModalData({ path, json });
    setJsonModalOpen(true);
  };

  return (
    <div class="flex-1 w-full flex flex-col bg-black/40">
      {/* Search Toolbar */}
    <div class="p-4 border-b border-zinc-800 bg-[#050505] shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
      <div class="relative w-full max-w-xl flex items-center">
        <input 
          type="text" 
          placeholder="Search keys, values, or types..."
          value={editorState.searchQuery}
          onInput={(e) => setSearchQuery(e.target.value)}
          class="peer w-full bg-[#0a0a0a] border border-zinc-400 text-[#FF7A00] placeholder:text-[#FF7A00]/90 pl-[20px] pr-4 py-2 outline-none font-brains text-xs transition-colors shadow-inner focus:border-[#FF7A00] focus:text-[#FF7A00]"
        />

        <Search 
          size={14} 
          class="absolute left-3 pointer-events-none text-zinc-400 transition-colors peer-focus:text-[#FF7A00]" 
        />
      </div>
      <div class="flex items-center gap-2 ml-0 md:ml-4 shrink-0 w-full md:w-auto">
        <button onClick={() => collapseAll()} class="px-3 py-2 border border-zinc-400 cursor-pointer bg-[#0a0a0a] hover:bg-zinc-800 hover:text-white text-zinc-500 transition-colors flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
          <FolderClosed size={14} /> Collapse All
        </button>
        <button onClick={() => expandAll(3)} class="px-3 py-2 border border-zinc-400 cursor-pointer bg-[#0a0a0a] hover:bg-zinc-800 hover:text-white text-zinc-500 transition-colors flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
          <FolderOpen size={14} /> Expand All
        </button>
      </div>
    </div>

      <div class="flex-1 min-h-0 w-full relative">
        <div ref={parentRef} class="h-full custom-scrollbar overflow-y-auto overflow-x-hidden">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            <Index each={virtualizer.getVirtualItems()}>
              {(virtualRowAccessor) => {
                const node = () => editorState.flattenedNodes[virtualRowAccessor().index];
                
                return (
                  <Show when={node()}>
                    <div
                      ref={(el) => {
                        createEffect(() => {
                          const idx = virtualRowAccessor().index;
                          el.setAttribute('data-index', String(idx));
                          virtualizer.measureElement(el);
                        });
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRowAccessor().start}px)`,
                      }}
                    >
                      <div
                        style={{
                          "padding-left": `${Math.max(node().depth * 24 + 16, 16)}px`,
                        }}
                        class="flex items-start py-4 md:py-8 gap-4 md:gap-10 border-b border-zinc-800 hover:bg-[#FF7A00]/5 transition-colors pr-4 md:pr-16 group relative"
                      >
                        {/* Expander Icon */}
                        <div 
                          class={`w-8 h-8 mt-6 flex items-center justify-center shrink-0 cursor-pointer text-zinc-400 hover:text-[#FF7A00] transition-transform ${node().isExpanded ? 'rotate-90' : ''}`}
                          onClick={() => node().hasChildren && toggleExpand(node().path)}
                        >
                          {node().hasChildren ? '▶' : '•'}
                        </div>

                        {/* Key Name & Dictionary Badge */}
                        <Show when={renamingPath() === node().path} fallback={
                          <>
                            {/* Key Name & Dictionary Badge */}
                            <Tooltip text={node().key} position="bottom" align="left">
                              <div class="font-brains text-sm text-[#FF7A00] shrink-0 font-bold flex flex-col items-start max-w-[250px]">
                                <span class="truncate w-full"><HighlightText text={node().key} query={editorState.searchQuery} /></span>
                                {/* Displays Item Name Badge from 'keys' Array */}
                                <Show when={node().pairedLabel}>
                                  <Tooltip text={node().pairedLabel} position="bottom" align="left">
                                    <span class="text-[10px] mt-2 font-desc bg-[#FF7A00]/10 text-[#FF7A00] px-6 py-2 rounded-sm border border-[#FF7A00]/30 truncate w-full inline-block max-w-[250px]">
                                      🔑 <HighlightText text={node().pairedLabel!} query={editorState.searchQuery} />
                                    </span>
                                  </Tooltip>
                                </Show>
                              </div>
                            </Tooltip>

                            {/* Value Area */}
                            <div class="flex-1 flex items-center min-w-0">
                              {node().hasChildren ? (
                                <span class="text-zinc-400 italic text-xs mt-4 font-desc">{String(node().value)}</span>
                              ) : node().type === 'boolean' ? (
                                <button 
                                  onClick={() => handleToggleBoolean(node().path, node().value)}
                                  class={`px-8 py-2 mt-2 rounded-none text-[10px] uppercase font-bold tracking-widest transition-colors border ${node().value ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500 hover:bg-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500 hover:bg-red-500/30'}`}
                                >
                                  {node().value ? 'TRUE' : 'FALSE'}
                                </button>
                              ) : node().type === 'number' ? (
                                <input 
                                  type="number"
                                  value={localValues()[node().path] !== undefined ? localValues()[node().path] : node().value}
                                  onInput={(e) => handleInputChange(node().path, e.target.value)}
                                  onBlur={() => handleInputBlur(node().path, node().type)}
                                  class="w-full bg-zinc-950 border-2 border-zinc-800 focus:border-[#FF7A00] text-[#FF7A00] px-4 py-2 outline-none transition-all font-brains text-sm mt-2 shadow-inner"
                                />
                              ) : node().type === 'string' ? (
                                (typeof node().value === 'string' && node().value.length > 200 && (node().key.toLowerCase().includes('base64') || node().value.startsWith('/9j/') || node().value.startsWith('iVBORw0'))) ? (
                                  <div class="text-[12px] leading-[16px] text-zinc-500 font-desc italic bg-black/50 px-12 py-6 rounded-sm border border-zinc-800 mt-2 select-none flex items-center gap-8">
                                    <span>🖼️</span> [Base64 Image Data - Editing Disabled for UI Performance]
                                  </div>
                                ) : (
                                  <textarea 
                                    value={localValues()[node().path] !== undefined ? localValues()[node().path] : node().value}
                                    onInput={(e) => {
                                      handleInputChange(node().path, e.target.value);
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${e.target.scrollHeight}px`;
                                      virtualizer.measure();
                                    }}
                                    onBlur={() => handleInputBlur(node().path, node().type)}
                                    class="w-full min-h-[40px] max-h-[200px] overflow-y-auto custom-scrollbar whitespace-pre-wrap break-all resize-y bg-zinc-950 border-2 border-zinc-800 focus:border-[#00F0FF] text-[#00F0FF] px-4 py-2 outline-none transition-all font-brains text-sm mt-2 shadow-inner"
                                  />
                                )
                              ) : (
                                <span class="text-zinc-500 font-brains text-sm mt-4"><HighlightText text={String(node().value)} query={editorState.searchQuery} /></span>
                              )}
                            </div>
                            
                            {/* Hover Actions */}
                            <div class="static mt-4 md:mt-0 md:absolute right-4 top-1/2 md:-translate-y-1/2 flex flex-wrap items-center gap-3 md:gap-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity bg-black/90 px-4 md:px-3 py-3 md:py-2 border border-zinc-700 shadow-[4px_4px_0px_#FF7A00]">
                              <Tooltip text="Copy Path" position="bottom">
                                <button 
                                  onClick={() => { navigator.clipboard.writeText(node().path); addToast("Path copied to clipboard", "success"); }} 
                                  class="p-3 md:p-2 cursor-pointer hover:text-[#00F0FF] text-zinc-500 transition-colors"
                                >
                                  <Copy class="w-[24px] h-[24px] md:w-[16px] md:h-[16px]" />
                                </button>
                              </Tooltip>
                              <Tooltip text="Copy Value" position="bottom">
                                <button 
                                  onClick={() => { navigator.clipboard.writeText(node().hasChildren ? JSON.stringify(getRealValue(node().path)) : String(node().value)); addToast("Value copied to clipboard", "success"); }} 
                                  class="p-3 md:p-2 cursor-pointer hover:text-[#00F0FF] text-zinc-500 transition-colors"
                                >
                                  <Copy class="w-[24px] h-[24px] md:w-[16px] md:h-[16px]" />
                                </button>
                              </Tooltip>
                              <div class="w-[1px] h-4 bg-zinc-700 mx-1"></div>
                              <Tooltip text="Rename Key" position="bottom">
                                <button 
                                  onClick={() => { setRenamingPath(node().path); setRenamingTemp(node().key); }} 
                                  class="p-3 md:p-2 cursor-pointer hover:text-blue-500 text-zinc-500 transition-colors"
                                >
                                  <Edit2 class="w-[24px] h-[24px] md:w-[16px] md:h-[16px]" />
                                </button>
                              </Tooltip>
                              <Show when={node().hasChildren}>
                                <Tooltip text="Add Item" position="bottom">
                                  <button 
                                    onClick={() => requestAdd(node().path)} 
                                    class="p-3 md:p-2 cursor-pointer hover:text-emerald-500 text-zinc-500 transition-colors"
                                  >
                                    <Plus class="w-[24px] h-[24px] md:w-[16px] md:h-[16px]" />
                                  </button>
                                </Tooltip>
                                <Tooltip text="View RAW JSON" position="bottom">
                                  <button 
                                    onClick={() => openJsonModal(node().path, getRealValue(node().path))} 
                                    class="p-3 md:p-2 cursor-pointer hover:text-purple-500 text-zinc-500 transition-colors"
                                  >
                                    <Code class="w-[24px] h-[24px] md:w-[16px] md:h-[16px]" />
                                  </button>
                                </Tooltip>
                              </Show>
                              <Tooltip text="Duplicate Node" position="bottom" align="right">
                                <button 
                                  onClick={() => requestConfirm('duplicate', node().path)} 
                                  class="p-3 md:p-2 cursor-pointer hover:text-yellow-500 text-zinc-500 transition-colors"
                                >
                                  <CopyPlus class="w-[24px] h-[24px] md:w-[16px] md:h-[16px]" />
                                </button>
                              </Tooltip>
                              <Tooltip text="Delete Node" position="bottom" align="right">
                                <button 
                                  onClick={() => requestConfirm('delete', node().path)} 
                                  class="p-3 md:p-2 cursor-pointer hover:text-red-500 text-zinc-500 transition-colors"
                                >
                                  <Trash2 class="w-[24px] h-[24px] md:w-[16px] md:h-[16px]" />
                                </button>
                              </Tooltip>
                            </div>
                          </>
                        }>
                          <div class="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full pr-0 md:pr-4 py-1">
                            <input
                              value={renamingTemp()}
                              onInput={(e) => setRenamingTemp(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                   renameKey(node().path, renamingTemp());
                                   setRenamingPath(null);
                                } else if (e.key === 'Escape') {
                                   setRenamingPath(null);
                                }
                              }}
                              class="bg-zinc-950 border-2 border-[#FF7A00] focus:border-[#00F0FF] text-[#FF7A00] px-4 py-3 text-sm font-brains outline-none w-full shadow-inner transition-colors flex-1"
                              autoFocus
                            />
                            <div class="flex items-center gap-2 w-full md:w-auto shrink-0 mt-2 md:mt-0">
                              <button 
                                onMouseDown={(e) => { e.preventDefault(); renameKey(node().path, renamingTemp()); setRenamingPath(null); }} 
                                onTouchStart={(e) => { e.preventDefault(); renameKey(node().path, renamingTemp()); setRenamingPath(null); }} 
                                class="flex-1 md:flex-none px-6 py-3 flex items-center justify-center cursor-pointer text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/30 border border-emerald-500/50 transition-colors gap-2 font-bold uppercase text-xs tracking-widest"
                              >
                                <Check size={18} /> Save
                              </button>
                              <button 
                                onMouseDown={(e) => { e.preventDefault(); setRenamingPath(null); }} 
                                onTouchStart={(e) => { e.preventDefault(); setRenamingPath(null); }} 
                                class="flex-1 md:flex-none px-6 py-3 flex items-center justify-center cursor-pointer text-red-400 bg-red-500/10 hover:bg-red-500/30 border border-red-500/50 transition-colors gap-2 font-bold uppercase text-xs tracking-widest"
                              >
                                <X size={18} /> Cancel
                              </button>
                            </div>
                          </div>
                        </Show>
                        
                      </div>
                    </div>
                  </Show>
                );
              }}
            </Index>
          </div>
        </div>
      </div>
      <ViewJsonModal 
        isOpen={jsonModalOpen()} 
        onClose={() => setJsonModalOpen(false)} 
        path={jsonModalData().path} 
        json={jsonModalData().json} 
      />
      <Modal
        isOpen={addModalData().isOpen}
        onClose={() => setAddModalData({ isOpen: false, path: '' })}
        title="ADD NEW NODE"
        icon={<Plus size={18} class="text-emerald-500" />}
      >
        <div class="flex flex-col gap-6">
          <Show when={!Array.isArray(getRealValue(addModalData().path))}>
            <div class="flex flex-col gap-2">
              <label class="text-xs font-brains text-zinc-400 font-bold tracking-widest uppercase">Key Name</label>
              <input 
                value={addCustomKey()} 
                onInput={(e) => setAddCustomKey(e.target.value)} 
                class="bg-zinc-950 border border-zinc-700 focus:border-[#FF7A00] text-[#FF7A00] px-3 py-2 text-sm font-brains outline-none transition-colors"
                placeholder="new_key"
              />
            </div>
          </Show>

          <div class="flex flex-col gap-2">
            <label class="text-xs font-brains text-zinc-400 font-bold tracking-widest uppercase">Data Type</label>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['string', 'number', 'boolean', 'object', 'array', 'null'].map(type => (
                 <button 
                   onClick={() => setAddSelectedType(type as any)}
                   class={`py-2 px-3 border font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer ${addSelectedType() === type ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800'}`}
                 >
                   {type}
                 </button>
              ))}
            </div>
          </div>

          <Show when={addSelectedType() !== 'object' && addSelectedType() !== 'array' && addSelectedType() !== 'null'}>
            <div class="flex flex-col gap-2">
              <label class="text-xs font-brains text-zinc-400 font-bold tracking-widest uppercase">Initial Value <span class="text-zinc-600">(Optional)</span></label>
              <Show when={addSelectedType() === 'boolean'} fallback={
                <input 
                  type={addSelectedType() === 'number' ? 'number' : 'text'}
                  value={addCustomValue()} 
                  onInput={(e) => setAddCustomValue(e.target.value)} 
                  class="bg-zinc-950 border border-zinc-700 focus:border-[#00F0FF] text-[#00F0FF] px-3 py-2 text-sm font-brains outline-none transition-colors"
                  placeholder={addSelectedType() === 'number' ? '0' : 'Empty String'}
                />
              }>
                <select 
                  value={addCustomValue() || 'false'} 
                  onChange={(e) => setAddCustomValue(e.target.value)}
                  class="bg-zinc-950 border border-zinc-700 focus:border-[#00F0FF] text-[#00F0FF] px-3 py-2 text-sm font-brains outline-none transition-colors"
                >
                  <option value="false">FALSE</option>
                  <option value="true">TRUE</option>
                </select>
              </Show>
            </div>
          </Show>

          <div class="flex gap-4 mt-2">
            <button 
              onClick={() => setAddModalData({ isOpen: false, path: '' })}
              class="flex-1 py-3 bg-transparent border border-zinc-700 hover:text-white hover:bg-zinc-800 text-zinc-400 font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                 addValue(addModalData().path, addSelectedType(), addCustomKey(), addCustomValue());
                 setAddModalData({ isOpen: false, path: '' });
              }}
              class="flex-1 py-3 border border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-500 font-bold text-xs cursor-pointer tracking-widest uppercase transition-colors"
            >
              Create Node
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={confirmModalData().isOpen}
        onClose={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
        title={confirmModalData().action === 'delete' ? 'DELETE NODE' : 'DUPLICATE NODE'}
        icon={
          confirmModalData().action === 'delete' 
            ? <Trash2 size={18} class="text-red-500" /> 
            : <CopyPlus size={18} class="text-yellow-500" />
        }
      >
        <div class="flex flex-col gap-6">
          <p class="text-sm font-brains text-zinc-300">
            {confirmModalData().action === 'delete' 
              ? 'Are you sure you want to delete this node? This action can be undone via Undo history.' 
              : 'Are you sure you want to duplicate this node?'}
          </p>
          <div class="flex gap-4 mt-4">
            <button 
              onClick={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
              class="flex-1 py-3 bg-transparent border border-zinc-700 hover:text-white hover:bg-zinc-800 text-zinc-400 font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              class={`flex-1 py-3 border font-bold text-xs cursor-pointer tracking-widest uppercase transition-colors ${
                confirmModalData().action === 'delete' 
                  ? 'border-red-500 bg-red-500/10 hover:bg-red-500/30 text-red-500' 
                  : 'border-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/30 text-yellow-500'
              }`}
            >
              {confirmModalData().action === 'delete' ? 'Delete' : 'Duplicate'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
