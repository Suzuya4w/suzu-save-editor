// src/utils/injector.ts

export interface InjectorResult {
  injectedData: Record<string, any>;
  unlockedCount: number;
}

/**
 * Injects flags based on a predefined game profile from the JSON database.
 */
export const applyProfileInjection = (
  parsedVariables: Record<string, any>,
  gameProfile: any
): InjectorResult => {
  const injectedData = structuredClone(parsedVariables);
  let unlockedCount = 0;

  // Initialize envPlayerSceneReaded for Kirikiri if it doesn't exist
  if (gameProfile.engine.toLowerCase() === 'kirikiri' && !injectedData.envPlayerSceneReaded) {
    injectedData.envPlayerSceneReaded = {};
  }

  gameProfile.rules.forEach((rule: any) => {
    if (rule.type === 'exact_match' && rule.keys) {
      rule.keys.forEach((key: string) => {
        // Special case for Kirikiri scene read flags
        if (key.includes('*start') || key.includes('*dummy')) {
          if (injectedData.envPlayerSceneReaded[key] !== rule.value) {
            injectedData.envPlayerSceneReaded[key] = rule.value;
            unlockedCount++;
          }
        } else {
          // Standard exact match
          if (injectedData[key] !== rule.value) {
            injectedData[key] = rule.value;
            unlockedCount++;
          }
        }
      });
    } else if (rule.type === 'prefix_match' && rule.prefixes) {
      // Loop through existing keys (Warning: this only works if the keys already exist in the save file)
      Object.keys(injectedData).forEach((key) => {
        const matchesPrefix = rule.prefixes.some((prefix: string) => key.startsWith(prefix));
        if (matchesPrefix && injectedData[key] !== rule.value) {
          injectedData[key] = rule.value;
          unlockedCount++;
        }
      });
    }
  });

  return { injectedData, unlockedCount };
};

/**
 * Injects flags directly from a list of filenames (Direct Folder Mode)
 */
export const applyDirectFolderInjection = (
  parsedVariables: Record<string, any>,
  cleanFileNames: string[],
  injectValue: any = 1,
  prefix: string = "",
  suffix: string = "",
  isUppercase: boolean = false
): InjectorResult => {
  const injectedData = structuredClone(parsedVariables);
  let unlockedCount = 0;

  cleanFileNames.forEach((name) => {
    const processedName = isUppercase ? name.toUpperCase() : name;
    const key = `${prefix}${processedName}${suffix}`;
    if (injectedData[key] !== injectValue) {
      injectedData[key] = injectValue;
      unlockedCount++;
    }
  });

  return { injectedData, unlockedCount };
};

/**
 * Generates a JSON profile string from an array of filenames (Generator Mode)
 */
export const generateProfileJson = (
  cleanFileNames: string[],
  prefix: string = "",
  suffix: string = "",
  isUppercase: boolean = false
): string => {
  const keys = cleanFileNames.map(name => {
    const processedName = isUppercase ? name.toUpperCase() : name;
    return `${prefix}${processedName}${suffix}`;
  });
  
  const finalJson = {
    type: "exact_match",
    value: 1, // Default to 1, user can edit this later
    keys: keys
  };

  return JSON.stringify(finalJson, null, 2);
};