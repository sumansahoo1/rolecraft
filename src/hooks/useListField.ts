"use client";

import type { MasterResume } from "@/types";

// ─── Top-level list field CRUD ───────────────────────────────────

export interface ListFieldApi<T> {
  items: T[];
  updateItem: (idx: number, item: T) => void;
  addItem: () => void;
  removeItem: (idx: number) => void;
}

/**
 * Generic CRUD hook for an array field on MasterResume.
 *
 * @param resume - Current MasterResume state.
 * @param field - Key of the array field (e.g. "experience", "projects").
 * @param update - Parent setter: (field, value) => void.
 * @param empty - Factory producing a new empty item.
 * @param required - true for required arrays (no `?? []` guard). Default false.
 */
export function useListField<T>(
  resume: MasterResume,
  field: keyof MasterResume,
  update: (field: keyof MasterResume, value: unknown) => void,
  empty: () => T,
  required: boolean = false,
): ListFieldApi<T> {
  const current = required
    ? (resume[field] as T[])
    : ((resume[field] ?? []) as T[]);

  return {
    items: current,

    updateItem: (idx: number, item: T) => {
      const updated = [...current];
      updated[idx] = item;
      update(field, updated);
    },

    addItem: () => {
      update(field, [...current, empty()]);
    },

    removeItem: (idx: number) => {
      update(field, current.filter((_, i) => i !== idx));
    },
  };
}

// ─── Nested string array helpers (highlights) ────────────────────

export interface NestedStringHelpers {
  updateAt: (parentIdx: number, childIdx: number, value: string) => void;
  addAt: (parentIdx: number) => void;
  removeAt: (parentIdx: number, childIdx: number) => void;
}

/**
 * Create helpers for a nested string array within items of a list field.
 * Used for highlights (experience.highlights, projects.highlights, etc.).
 *
 * @param getParentItems - Function returning current parent items array.
 * @param nestedField - Key of the nested string array (e.g. "highlights").
 * @param parentField - Parent field key on MasterResume.
 * @param update - Parent setter.
 */
export function createNestedStringHelpers(
  getParentItems: () => unknown[],
  nestedField: string,
  parentField: keyof MasterResume,
  update: (field: keyof MasterResume, value: unknown) => void,
): NestedStringHelpers {
  return {
    updateAt(parentIdx: number, childIdx: number, value: string) {
      const items = [...getParentItems()] as Record<string, unknown>[];
      const arr = [...((items[parentIdx][nestedField] as unknown[] | undefined) ?? [])];
      arr[childIdx] = value;
      items[parentIdx] = { ...items[parentIdx], [nestedField]: arr };
      update(parentField, items);
    },

    addAt(parentIdx: number) {
      const items = [...getParentItems()] as Record<string, unknown>[];
      const arr = [...((items[parentIdx][nestedField] as unknown[] | undefined) ?? []), ""];
      items[parentIdx] = { ...items[parentIdx], [nestedField]: arr };
      update(parentField, items);
    },

    removeAt(parentIdx: number, childIdx: number) {
      const items = [...getParentItems()] as Record<string, unknown>[];
      const arr = ((items[parentIdx][nestedField] as unknown[] | undefined) ?? []).filter(
        (_, i) => i !== childIdx,
      );
      items[parentIdx] = { ...items[parentIdx], [nestedField]: arr };
      update(parentField, items);
    },
  };
}

// ─── Tag helpers (technologies) ──────────────────────────────────

export interface TagHelpers {
  add: (parentIdx: number, value: string) => void;
  remove: (parentIdx: number, value: string) => void;
}

/**
 * Create add/remove helpers for a technology-style string array.
 * `add` deduplicates and ignores empty strings.
 *
 * @param getParentItems - Function returning current parent items array.
 * @param parentField - Parent field key on MasterResume.
 * @param update - Parent setter.
 */
export function createTagHelpers(
  getParentItems: () => unknown[],
  parentField: keyof MasterResume,
  update: (field: keyof MasterResume, value: unknown) => void,
): TagHelpers {
  return {
    add(parentIdx: number, value: string) {
      if (!value) return;
      const items = [...getParentItems()] as Record<string, unknown>[];
      const current: string[] = (items[parentIdx].technologies as string[] | undefined) ?? [];
      if (current.includes(value)) return;
      items[parentIdx] = { ...items[parentIdx], technologies: [...current, value] };
      update(parentField, items);
    },

    remove(parentIdx: number, value: string) {
      const items = [...getParentItems()] as Record<string, unknown>[];
      const current: string[] = (items[parentIdx].technologies as string[] | undefined) ?? [];
      items[parentIdx] = {
        ...items[parentIdx],
        technologies: current.filter((t) => t !== value),
      };
      update(parentField, items);
    },
  };
}
