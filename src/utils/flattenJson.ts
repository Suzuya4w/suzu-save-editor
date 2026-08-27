export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface FlattenedNode {
  path: string;       // Dot-notation path (e.g., 'actors.0.hp')
  key: string;        // Last segment of the path (e.g., 'hp' or '0')
  value: any;         // Primitive value or string representation of object/array
  type: JsonNodeType;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isHidden: boolean;  // For search filtering
  pairedLabel?: string;
}

export function flattenJson(
  json: any,
  expandedPaths: Set<string>,
  searchQuery: string = '',
  collapsedSearchPaths: Set<string> = new Set()
): FlattenedNode[] {
  const result: FlattenedNode[] = [];
  const lowerQuery = searchQuery.toLowerCase();

  // Helper to determine type
  const getType = (val: any): JsonNodeType => {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val as JsonNodeType;
  };

// Returns a boolean (true if THIS node or ITS CHILDREN match the search)
  function recurse(
    currentVal: any, 
    currentPath: string, 
    currentDepth: number, 
    currentKey: string,
    pairedLabel?: string,
    labelsForChildren?: string[],
    shouldPushToResult: boolean = true
  ): boolean {
    const type = getType(currentVal);
    const hasChildren = type === 'object' || type === 'array';
    
    // 1. Check if this node itself matches the search
    let nodeMatches = false;
    if (!searchQuery) {
      nodeMatches = true;
    } else {
      if (currentKey.toLowerCase().includes(lowerQuery)) nodeMatches = true;
      else if (pairedLabel && pairedLabel.toLowerCase().includes(lowerQuery)) nodeMatches = true;
      else if (!hasChildren && String(currentVal).toLowerCase().includes(lowerQuery)) nodeMatches = true;
    }

    const isExpanded = searchQuery !== '' 
      ? !collapsedSearchPaths.has(currentPath) 
      : expandedPaths.has(currentPath);

    // Save current index position. If later it turns out this node and its children don't match, 
    // we will remove this node from the result array (very fast performance).
    const startIndex = result.length;

    if (shouldPushToResult) {
      result.push({
        path: currentPath,
        key: currentKey,
        value: hasChildren ? (type === 'array' ? `Array(${currentVal.length})` : 'Object') : currentVal,
        type,
        depth: currentDepth,
        hasChildren,
        isExpanded,
        isHidden: false,
        pairedLabel, // Paired label injected here
      });
    }

    let anyChildMatches = false;

    const shouldTraverseChildren = hasChildren && (searchQuery !== '' || isExpanded);

    if (shouldTraverseChildren) {
      const childKeys = type === 'array' ? currentVal.map((_: any, i: number) => String(i)) : Object.keys(currentVal);
      
      // UNITY DICTIONARY DETECTION: If this is an Object and has 'keys' & 'values' arrays
      const isUnityDict = type === 'object' && Array.isArray(currentVal.keys) && Array.isArray(currentVal.values);

      for (const k of childKeys) {
        const nextPath = currentPath ? `${currentPath}.${k}` : k;
        let nextPairedLabel = undefined;
        let nextLabelsForChildren = undefined;

        if (isUnityDict && k === 'values') {
           // If we enter the 'values' array, bring the 'keys' list as labels for the children
           nextLabelsForChildren = currentVal.keys.map(String);
        }

        if (type === 'array' && labelsForChildren && labelsForChildren[Number(k)]) {
           // If this node is an element in the 'values' array, pair it with the label
           nextPairedLabel = labelsForChildren[Number(k)];
        }

        const childShouldPush = shouldPushToResult && isExpanded;

        const childMatched = recurse(currentVal[k], nextPath, currentDepth + 1, k, nextPairedLabel, nextLabelsForChildren, childShouldPush);
        if (childMatched) anyChildMatches = true;
      }
    }

    // 2. Final Decision: Keep this node if it matches, OR if any of its children match
    const isKeep = !searchQuery || nodeMatches || anyChildMatches;
    
    if (!isKeep && shouldPushToResult) {
       result.length = startIndex; // Remove node from array instantly (Truncate)
       return false;
    }

    return isKeep;
  }

  if (json !== null && typeof json === 'object') {
    const keys = Array.isArray(json) ? json.map((_, i) => String(i)) : Object.keys(json);
    for (const k of keys) {
      recurse(json[k], k, 0, k);
    }
  }

  return result;
}