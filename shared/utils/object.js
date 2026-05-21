export const deepFreeze = (value) => {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  Object.values(value).forEach((child) => deepFreeze(child));
  return value;
};

export const pickDefined = (value = {}) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
