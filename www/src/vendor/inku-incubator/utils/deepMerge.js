export function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function deepMerge(base, override) {
  if (override === undefined) {
    return cloneMergeValue(base);
  }

  if (Array.isArray(base) && Array.isArray(override)) {
    return override.map(cloneMergeValue);
  }

  if (!isPlainObject(base) || !isPlainObject(override)) {
    return cloneMergeValue(override);
  }

  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override)]);

  for (const key of keys) {
    const baseValue = base[key];
    const overrideValue = override[key];

    if (overrideValue === undefined) {
      result[key] = cloneMergeValue(baseValue);
      continue;
    }

    if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
      result[key] = overrideValue.map(cloneMergeValue);
      continue;
    }

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue);
      continue;
    }

    result[key] = cloneMergeValue(overrideValue);
  }

  return result;
}

function cloneMergeValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneMergeValue);
  }

  if (isPlainObject(value)) {
    const result = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = cloneMergeValue(nestedValue);
    }

    return result;
  }

  return value;
}
