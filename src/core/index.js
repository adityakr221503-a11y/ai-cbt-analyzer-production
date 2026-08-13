/**
 * CBT Analyzer Pro
 * Production Core — Public API
 *
 * v9.1.1
 */

export { createQuestion } from "./models/question.js";
export { createTest } from "./models/test.js";
export { createAttempt } from "./models/attempt.js";

export {
  createMistake,
  updateMistakeReason,
  recordPracticeResult,
  VALID_REASONS,
  VALID_STATUS,
} from "./models/mistake.js";

export {
  readCollection,
  writeCollection,
  addItem,
  getItem,
  removeItem,
  clearCollection,
  storageStats,
} from "./storage/storage.js";

export { scoreAttempt } from "./scoring/scoring.js";

export {
  createMistakesFromAttempt,
} from "./mistakes/mistakeEngine.js";

export {
  calculateAttemptAnalytics,
  calculateMistakeAnalytics,
  calculateImprovement,
} from "./analytics/analytics.js";
export {
  getMistakeForPractice,
  recordPractice,
  getPracticeProgress,
} from "./practice/practiceEngine.js";

export {
  getMistakeBook,
  getMistake,
  getMistakesByReason,
  getMistakesByStatus,
  getActiveMistakes,
} from "./mistakes/mistakeBook.js";
export {
  getMistakeForPractice,
  recordPractice,
  getPracticeProgress,
} from "./practice/practiceEngine.js";

export {
  getMistakeBook,
  getMistake,
  getMistakesByReason,
  getMistakesByStatus,
  getActiveMistakes,
} from "./mistake/mistakeBook.js";
