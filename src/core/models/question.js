/**
 * CBT Analyzer Pro
 * Production Core — Question Model
 *
 * v9.1.1
 */

export function createQuestion({
  id,
  text,
  options = [],
  correctAnswer = null,
  subject = "",
  chapter = "",
  topic = "",
  concept = "",
  difficulty = "medium",
  marks = 4,
  negativeMarks = 1,
  explanation = "",
  source = "unknown",
} = {}) {
  if (!id) {
    throw new Error("Question requires a unique id.");
  }

  if (!text || !String(text).trim()) {
    throw new Error("Question requires text.");
  }

  return Object.freeze({
    id: String(id),
    text: String(text),
    options: Array.isArray(options) ? [...options] : [],
    correctAnswer,
    subject: String(subject),
    chapter: String(chapter),
    topic: String(topic),
    concept: String(concept),
    difficulty: String(difficulty),
    marks: Number(marks),
    negativeMarks: Number(negativeMarks),
    explanation: String(explanation),
    source: String(source),
  });
}
