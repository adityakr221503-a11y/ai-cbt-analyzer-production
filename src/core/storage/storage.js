/**
 * CBT Analyzer Pro
 * Production Core — Persistent Storage
 *
 * v9.1.1
 */

const STORAGE_PREFIX = "cbt_pro_v9_";

function storageKey(collection) {
  return `${STORAGE_PREFIX}${collection}`;
}

export function readCollection(collection) {
  try {
    const raw = localStorage.getItem(storageKey(collection));

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(
      `Failed to read collection "${collection}"`,
      error
    );

    return [];
  }
}

export function writeCollection(collection, items) {
  if (!Array.isArray(items)) {
    throw new Error("Storage collection must be an array.");
  }

  localStorage.setItem(
    storageKey(collection),
    JSON.stringify(items)
  );

  return items;
}

export function addItem(collection, item) {
  const items = readCollection(collection);

  const index = items.findIndex(
    (existing) => existing.id === item.id
  );

  if (index >= 0) {
    items[index] = item;
  } else {
    items.push(item);
  }

  writeCollection(collection, items);

  return item;
}

export function getItem(collection, id) {
  const items = readCollection(collection);

  return (
    items.find(
      (item) => String(item.id) === String(id)
    ) || null
  );
}

export function removeItem(collection, id) {
  const items = readCollection(collection).filter(
    (item) => String(item.id) !== String(id)
  );

  writeCollection(collection, items);

  return items;
}

export function clearCollection(collection) {
  localStorage.removeItem(storageKey(collection));
}

export function storageStats() {
  const collections = [
    "questions",
    "tests",
    "attempts",
    "mistakes",
    "bookmarks",
  ];

  return Object.fromEntries(
    collections.map((collection) => [
      collection,
      readCollection(collection).length,
    ])
  );
}
