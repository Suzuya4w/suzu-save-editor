import { createMemo, Show } from 'solid-js';
import wildTreesRaw from '../../../data/stardew/WildTrees.json';

export interface TreeSpriteProps {
  treeType: string;
  season: string;
  isStump?: boolean | string;
  isGreenRainTree?: boolean | string;
}

export const TreeSprite = (props: TreeSpriteProps) => {
  // 1. Deteksi Tipe & Status Green Rain yang Anti-Gagal
  const treeInfo = createMemo(() => {
    let type = String(props.treeType || '1');
    // Tangkap format boolean true maupun string "true"
    let isGreen = props.isGreenRainTree === true || String(props.isGreenRainTree).toLowerCase() === 'true';

    // Konversi otomatis pohon Mossy Seed (True Green Rain)
    if (type === '10') { type = '1'; isGreen = true; }
    if (type === '11') { type = '2'; isGreen = true; }
    if (type === '12') { type = '3'; isGreen = true; }

    const isTall = isGreen && ["1", "2", "3"].includes(type);
    return { type, isGreen, isTall };
  });

  // 2. Resolusi Path Gambar
  const spriteData = createMemo(() => {
    const seasonLower = (props.season || 'spring').toLowerCase();
    const { type, isTall } = treeInfo();

    if (type === '13') return { path: 'mystic_tree' };
    if (type === '7') return { path: 'mushroom_tree' };
    if (type === '6') return { path: 'tree_palm' };
    if (type === '9') return { path: 'tree_palm2' };

    if (isTall) {
      if (seasonLower === 'spring' || seasonLower === 'summer') {
        return { path: `tree${type}_greenRain` };
      } else {
        return { path: `tree${type}_greenRain_${seasonLower}` };
      }
    }

    const treeData = (wildTreesRaw as Record<string, any>)[type];
    if (!treeData) return { path: `tree${type}_${seasonLower}` };

    const textureObj = treeData.Textures?.find(
      (tex: any) => tex.Season?.toLowerCase() === seasonLower
    ) || treeData.Textures?.find((tex: any) => !tex.Season);

    const rawPath = textureObj?.Texture || `TerrainFeatures\\tree${type}_${seasonLower}`;
    return { path: rawPath.replace('TerrainFeatures\\', '').replace('TerrainFeatures/', '') };
  });

  const isStump = () => props.isStump === true || String(props.isStump).toLowerCase() === 'true';

  const handleError = (e: Event) => {
    const img = e.currentTarget as HTMLImageElement;
    const currentSrc = img.src;
    if (currentSrc.includes('greenRain')) {
       const fallbackType = ['10','11','12'].includes(props.treeType) 
         ? (parseInt(props.treeType) - 9).toString() 
         : props.treeType;
       img.src = `/stardew/terrainFeatures/tree${fallbackType}_${props.season}.png`;
    } else if (!currentSrc.includes('tree1_spring.png')) {
       img.src = '/stardew/terrainFeatures/tree1_spring.png';
    }
  };

  return (
    <div 
      class="absolute pointer-events-none drop-shadow-md"
      style={{ 
        width: `${isStump() ? 16 : 48}px`, 
        height: `${isStump() ? 32 : 96}px`, 
        left: `${isStump() ? 0 : -16}px`,
        bottom: isStump() ? '0px' : '-0px' 
      }}
    >
      <Show when={spriteData().path !== ''}>
        {/* Render Tunggul / Roots (Selalu dirender di paling bawah) */}
        <div 
          class="absolute overflow-hidden"
          style={{
            width: '16px',
            height: '32px',
            bottom: '0px',
            left: isStump() ? '0px' : '16px',
          }}
        >
          <img 
            src={`/stardew/terrainFeatures/${spriteData().path}.png`}
            onError={handleError}
            style={{
              position: 'absolute',
              top: '-96px',
              left: '-32px',
              "max-width": "none",
              "image-rendering": "pixelated"
            }}
          />
        </div>

        {/* Render Bagian Atas Pohon (Hanya jika BUKAN tunggul) */}
        <Show when={!isStump()}>
          <div 
            class="absolute overflow-hidden"
            style={{
              width: '48px',
              height: '96px',
              bottom: '0px',
              left: '0px',
            }}
          >
            <img 
              src={`/stardew/terrainFeatures/${spriteData().path}.png`}
              onError={handleError}
              style={{
                position: 'absolute',
                top: '0px',
                left: '0px',
                "max-width": "none",
                "image-rendering": "pixelated"
              }}
            />
          </div>
        </Show>
      </Show>
    </div>
  );
};