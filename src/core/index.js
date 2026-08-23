/**
 * CBT Analyzer Pro
 * Production Core — Public API
 *
 * v10.0.0 — Rank Booster / TOPPER
 *
 * Central export point for the entire core system.
 */


/* =====================================================
   MODELS
===================================================== */

export {
  createQuestion,
} from "./models/question.js";


export {
  createTest,
} from "./models/test.js";


export {
  createAttempt,
} from "./models/attempt.js";


export {
  createMistake,
  updateMistakeReason,
  recordPracticeResult,
  VALID_REASONS,
  VALID_STATUS,
} from "./models/mistake.js";


/* =====================================================
   STORAGE
===================================================== */

export {
  readCollection,
  writeCollection,
  addItem,
  getItem,
  removeItem,
  clearCollection,
  storageStats,
  getQuestion,
  saveQuestion,
  saveQuestions,
  hasItem,
  collectionCount,
  clearAllStorage,
} from "./storage/storage.js";


/* =====================================================
   SCORING
===================================================== */

export {
  scoreAttempt,
} from "./scoring/scoring.js";


/* =====================================================
   CBT ENGINE
===================================================== */

export {
  startAttempt,
  saveAnswer,
  submitAttempt,
} from "./cbt/engine.js";


/* =====================================================
   MISTAKE ENGINE
===================================================== */

export {
  createMistakesFromAttempt,
  calculateMistakePriority,
  updateMistakeReason,
  recordPracticeResult,
} from "./mistakes/mistakeEngine.js";


/* =====================================================
   MISTAKE BOOK
===================================================== */

export {
  getMistakeBook,
  getMistake,
  getMistakesByReason,
  getMistakesByStatus,
  getActiveMistakes,
} from "./mistakes/mistakeBook.js";


/* =====================================================
   PRACTICE ENGINE
===================================================== */

export {
  getMistakeForPractice,
  recordPractice,
  getPracticeProgress,
} from "./practice/practiceEngine.js";


/* =====================================================
   ANALYTICS
===================================================== */

export {
  calculateAttemptAnalytics,
  calculateMistakeAnalytics,
  calculateImprovement,
} from "./analytics/analytics.js";


/* =====================================================
   ADAPTIVE / DPP ENGINE
===================================================== */

export {
  calculateDPPPriority,
  getDPPStage,
  needsMoreDPP,
  isReadyForMasteryCheck,
  createDPPTarget,
  getDPPTargets,
  getNextDPPTarget,
  getDPPSummary,
} from "./adaptive/dppEngine.js";
