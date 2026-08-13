import {
  readCollection,
  getItem,
} from "../storage/storage.js";

export function getMistakeBook() {
  return readCollection("mistakes");
}

export function getMistake(mistakeId) {
  return getItem("mistakes", mistakeId);
}

export function getMistakesByReason(reason) {
  return getMistakeBook().filter(
    (mistake) => mistake.reason === reason
  );
}

export function getMistakesByStatus(status) {
  return getMistakeBook().filter(
    (mistake) => mistake.status === status
  );
}

export function getActiveMistakes() {
  return getMistakeBook().filter(
    (mistake) => mistake.status !== "mastered"
  );
}
