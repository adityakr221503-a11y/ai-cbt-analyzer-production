/**
 * CBT Analyzer Pro
 * Production Core — Module Entry
 *
 * v9.1.1
 */


/* =====================================================
   QUESTION
===================================================== */

export {
  createQuestion
} from "./question.js";


/* =====================================================
   TEST
===================================================== */

export {
  createTest
} from "./test.js";


/* =====================================================
   ATTEMPT
===================================================== */

export {
  startAttempt,
  saveAnswer,
  getSavedAnswer,
  submitAttempt,
  getAttempt
} from "./attempt.js";


/* =====================================================
   DPP / PRACTICE / MISTAKES / STORAGE
===================================================== */

export {
  getNextDPPTarget,
  getDPPStage,
  getDPPSummary,
  getDPPTargets,
  createDPPTarget,
  calculateDPPPriority,
  isReadyForMasteryCheck,
  needsMoreDPP,
} from "./dppEngine.js";

export {
  getMistakeForPractice,
  recordPractice,
  getPracticeProgress,
  getNextPracticeType,
} from "./practice/practiceEngine.js";

export {
  createMistake,
  getMistakeBook,
  getMistake,
  getMistakesByReason,
  getMistakesByStatus,
  getActiveMistakes,
} from "./mistakes/mistakeBook.js";

export {
  createMistakesFromAttempt,
  updateMistakeReason,
  recordPracticeResult,
} from "./mistakes/mistakeEngine.js";

export {
  getItem,
  addItem,
  hasItem,
  removeItem,
  readCollection,
  writeCollection,
  clearCollection,
  collectionCount,
  getQuestion,
  saveQuestion,
  saveQuestions,
  storageStats,
} from "./storage/storage.js";

export { scoreAttempt } from "./scoring/scoring.js";

export {
  calculateAttemptAnalytics,
  calculateImprovement,
  calculateMistakeAnalytics,
} from "./analytics/analytics.js";
