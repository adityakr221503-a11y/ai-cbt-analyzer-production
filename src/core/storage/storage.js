/**
 * CBT Analyzer Pro
 * Production Core — Persistent Storage
 *
 * v10.0.0
 *
 * Collections:
 * questions
 * tests
 * attempts
 * mistakes
 * bookmarks
 */

const STORAGE_PREFIX = "cbt_pro_v9_";


/* =====================================================
   STORAGE KEY
===================================================== */

function storageKey(collection) {

  if (!collection) {
    throw new Error(
      "Storage collection is required."
    );
  }

  return `${STORAGE_PREFIX}${String(collection)}`;

}


/* =====================================================
   READ COLLECTION
===================================================== */

export function readCollection(
  collection
) {

  try {

    const raw =
      localStorage.getItem(
        storageKey(collection)
      );


    if (!raw) {
      return [];
    }


    const parsed =
      JSON.parse(raw);


    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {

    console.error(
      `Failed to read collection "${collection}"`,
      error
    );


    return [];

  }

}


/* =====================================================
   WRITE COLLECTION
===================================================== */

export function writeCollection(
  collection,
  items
) {

  if (!Array.isArray(items)) {

    throw new Error(
      "Storage collection must be an array."
    );

  }


  try {

    localStorage.setItem(
      storageKey(collection),
      JSON.stringify(items)
    );


    return items;

  } catch (error) {

    console.error(
      `Failed to write collection "${collection}"`,
      error
    );


    throw new Error(
      `Unable to save ${collection}.`
    );

  }

}


/* =====================================================
   ADD / UPDATE ITEM
===================================================== */

export function addItem(
  collection,
  item
) {

  if (
    !item ||
    item.id === undefined ||
    item.id === null
  ) {

    throw new Error(
      "Storage item requires a unique id."
    );

  }


  const items =
    readCollection(
      collection
    );


  const itemId =
    String(item.id);


  const index =
    items.findIndex(
      existing =>
        String(existing.id) ===
        itemId
    );


  if (index >= 0) {

    items[index] =
      item;

  } else {

    items.push(
      item
    );

  }


  writeCollection(
    collection,
    items
  );


  return item;

}


/* =====================================================
   GET ITEM
===================================================== */

export function getItem(
  collection,
  id
) {

  if (
    id === undefined ||
    id === null
  ) {

    return null;

  }


  const items =
    readCollection(
      collection
    );


  return (
    items.find(
      item =>
        String(item.id) ===
        String(id)
    )
    || null
  );

}


/* =====================================================
   GET QUESTION
===================================================== */

export function getQuestion(
  questionId
) {

  return getItem(
    "questions",
    questionId
  );

}


/* =====================================================
   SAVE QUESTION
===================================================== */

export function saveQuestion(
  question
) {

  if (
    !question ||
    !question.id
  ) {

    throw new Error(
      "Question requires a unique id."
    );

  }


  return addItem(
    "questions",
    question
  );

}


/* =====================================================
   SAVE QUESTIONS
===================================================== */

export function saveQuestions(
  questions = []
) {

  if (
    !Array.isArray(questions)
  ) {

    throw new Error(
      "Questions must be an array."
    );

  }


  const existing =
    readCollection(
      "questions"
    );


  const map =
    new Map(
      existing.map(
        question => [
          String(question.id),
          question
        ]
      )
    );


  for (
    const question
    of questions
  ) {

    if (
      !question ||
      question.id === undefined ||
      question.id === null
    ) {

      continue;

    }


    map.set(
      String(question.id),
      question
    );

  }


  const result =
    Array.from(
      map.values()
    );


  writeCollection(
    "questions",
    result
  );


  return result;

}


/* =====================================================
   REMOVE ITEM
===================================================== */

export function removeItem(
  collection,
  id
) {

  const items =
    readCollection(
      collection
    ).filter(
      item =>
        String(item.id) !==
        String(id)
    );


  writeCollection(
    collection,
    items
  );


  return items;

}


/* =====================================================
   CLEAR COLLECTION
===================================================== */

export function clearCollection(
  collection
) {

  localStorage.removeItem(
    storageKey(collection)
  );

}


/* =====================================================
   COLLECTION EXISTS
===================================================== */

export function hasItem(
  collection,
  id
) {

  return (
    getItem(
      collection,
      id
    ) !== null
  );

}


/* =====================================================
   COLLECTION COUNT
===================================================== */

export function collectionCount(
  collection
) {

  return readCollection(
    collection
  ).length;

}


/* =====================================================
   STORAGE STATS
===================================================== */

export function storageStats() {

  const collections = [

    "questions",

    "tests",

    "attempts",

    "mistakes",

    "bookmarks",

  ];


  return Object.fromEntries(

    collections.map(
      collection => [

        collection,

        readCollection(
          collection
        ).length,

      ]
    )

  );

}


/* =====================================================
   CLEAR ALL CBT DATA
===================================================== */

export function clearAllStorage() {

  const collections = [

    "questions",

    "tests",

    "attempts",

    "mistakes",

    "bookmarks",

  ];


  for (
    const collection
    of collections
  ) {

    clearCollection(
      collection
    );

  }

}
