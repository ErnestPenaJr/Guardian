export const isFidelitySubjectFormName = (formName?: string | null): boolean => {
  if (!formName) return false;

  const normalized = formName.trim().toLowerCase();

  const isSubjectVariant = normalized.includes('subject') || normalized.includes('workup');
  const isSupportedPrefix = normalized.includes('fidelity') || normalized.includes('fiu');

  return isSupportedPrefix && isSubjectVariant;
};
