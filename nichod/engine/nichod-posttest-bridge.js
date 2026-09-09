"use strict";

/*
=========================================================
 PCB NICHOD — POST TEST INTELLIGENCE BRIDGE v1
=========================================================
CBT Result
   ↓
NICHOD evidence
   ↓
Mistake record
   ↓
Concept / Trap tracking
   ↓
Mentor targeting
   ↓
Future Ranker test
=========================================================
*/

(function () {

  const HISTORY_KEY =
    "cbtHistory";

  const MISTAKE_KEY =
    "cbtMistakes";

  const MENTOR_KEY =
    "pcbNichodMentorEvidence";

  const SNAPSHOT_KEY =
    "pcbNichodCBTSnapshot";

  function read(key, fallback) {
    try {
      const x = JSON.parse(
        localStorage.getItem(key) || "null"
      );
      return x == null ? fallback : x;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }

  function clean(x) {
    return String(x ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function idOf(q) {
    return clean(
      q?.id ||
      q?.questionId ||
      q?.question
    ).toLowerCase();
  }

  function isNichod(q) {
    return !!(
      q &&
      (
        q.nichod === true ||
        q.source === "PCB NICHOD" ||
        (
          q.verified === true &&
          q.unseen === true
        )
      )
    );
  }

  function metadata(q) {

    const m =
      q?.nichodMetadata || {};

    return {
      source:
        clean(
          m.source ||
          q?.source ||
          "PCB NICHOD"
        ),

      concept:
        clean(
          m.concept ||
          q?.concept ||
          q?.conceptTag
        ),

      trap:
        clean(
          m.trap ||
          q?.trap ||
          q?.trapTag
        ),

      shortcut:
        clean(
          m.shortcut ||
          q?.shortcut ||
          q?.shortcutTag
        ),

      chapter:
        clean(
          m.chapter ||
          q?.chapter
        ),

      topic:
        clean(
          m.topic ||
          q?.topic
        ),

      subject:
        clean(
          m.subject ||
          q?.subject
        ),

      explanation:
        clean(
          m.explanation ||
          q?.explanation ||
          q?.solution
        )
    };

  }

  function answerOf(q) {
    return clean(
      q?.answer ||
      q?.correctAnswer
    ).toLowerCase();
  }

  function selectedOf(q) {
    return clean(
      q?.selectedAnswer ||
      q?.userAnswer ||
      q?.selected
    ).toLowerCase();
  }

  function wasWrong(q) {

    const selected =
      selectedOf(q);

    const correct =
      answerOf(q);

    if (!selected || !correct)
      return false;

    return selected !== correct;

  }

  function mistakeReason(q) {

    return clean(
      q?.mistakeReason ||
      q?.mistakeType ||
      (
        q?.timeTaken &&
        q?.timeLimit &&
        Number(q.timeTaken) >
        Number(q.timeLimit)
          ? "Time Pressure"
          : ""
      )
    );

  }

  function loadSnapshot() {

    const snapshot =
      read(
        SNAPSHOT_KEY,
        null
      );

    if (
      snapshot &&
      Array.isArray(
        snapshot.questions
      )
    )
      return snapshot.questions;

    return [];

  }

  function normalizeResultItem(item) {

    if (!item)
      return null;

    const id =
      idOf(item);

    const snapshot =
      loadSnapshot();

    let source =
      snapshot.find(
        q =>
          id &&
          idOf(q) === id
      );

    if (!source)
      source = item;

    if (!isNichod(source))
      return null;

    const m =
      metadata(source);

    const selected =
      selectedOf(item) ||
      selectedOf(source);

    const correct =
      answerOf(item) ||
      answerOf(source);

    const wrong =
      selected &&
      correct &&
      selected !== correct;

    return {

      id:
        id ||
        idOf(source),

      question:
        clean(
          source.question ||
          item.question
        ),

      subject:
        m.subject,

      chapter:
        m.chapter,

      topic:
        m.topic,

      concept:
        m.concept,

      trap:
        m.trap,

      shortcut:
        m.shortcut,

      source:
        m.source,

      explanation:
        m.explanation,

      selectedAnswer:
        selected,

      correctAnswer:
        correct,

      correct:
        !wrong,

      wrong:
        !!wrong,

      mistakeReason:
        mistakeReason(item) ||
        mistakeReason(source),

      timestamp:
        new Date().toISOString()

    };

  }

  function extractItems(result) {

    if (
      Array.isArray(result)
    )
      return result;

    if (
      result &&
      Array.isArray(
        result.questions
      )
    )
      return result.questions;

    if (
      result &&
      Array.isArray(
        result.results
      )
    )
      return result.results;

    if (
      result &&
      Array.isArray(
        result.answers
      )
    )
      return result.answers;

    return [];

  }

  function buildEvidence(result) {

    return extractItems(result)
      .map(
        normalizeResultItem
      )
      .filter(Boolean);

  }

  function saveMistakes(evidence) {

    const mistakes =
      read(
        MISTAKE_KEY,
        []
      );

    const bank =
      Array.isArray(mistakes)
        ? mistakes
        : [];

    evidence
      .filter(
        x => x.wrong
      )
      .forEach(
        function(x){

          bank.push({

            question:
              x.question,

            questionId:
              x.id,

            subject:
              x.subject,

            chapter:
              x.chapter,

            topic:
              x.topic,

            mistakeType:
              x.mistakeReason ||
              "NICHOD Concept Review",

            mistakeReason:
              x.mistakeReason ||
              "NICHOD Concept Review",

            selectedAnswer:
              x.selectedAnswer,

            correctAnswer:
              x.correctAnswer,

            solution:
              x.explanation,

            nichod:
              true,

            concept:
              x.concept,

            trap:
              x.trap,

            shortcut:
              x.shortcut,

            source:
              x.source,

            mastered:
              false,

            createdAt:
              x.timestamp

          });

        }
      );

    write(
      MISTAKE_KEY,
      bank
    );

  }

  function updateMentor(evidence) {

    const mentor =
      read(
        MENTOR_KEY,
        {
          attempts: 0,
          correct: 0,
          wrong: 0,
          concepts: {},
          traps: {},
          topics: {},
          chapters: {},
          subjects: {},
          lastUpdated: null
        }
      );

    mentor.attempts +=
      evidence.length;

    mentor.correct +=
      evidence.filter(
        x => x.correct
      ).length;

    mentor.wrong +=
      evidence.filter(
        x => x.wrong
      ).length;

    evidence.forEach(
      function(x){

        function bump(
          obj,
          key
        ){

          key =
            clean(key);

          if(!key)
            return;

          if(!obj[key])
            obj[key] = {
              attempts: 0,
              correct: 0,
              wrong: 0
            };

          obj[key].attempts++;

          if(x.correct)
            obj[key].correct++;

          if(x.wrong)
            obj[key].wrong++;

        }

        bump(
          mentor.concepts,
          x.concept
        );

        bump(
          mentor.traps,
          x.trap
        );

        bump(
          mentor.topics,
          x.topic
        );

        bump(
          mentor.chapters,
          x.chapter
        );

        bump(
          mentor.subjects,
          x.subject
        );

      }
    );

    mentor.lastUpdated =
      new Date()
        .toISOString();

    write(
      MENTOR_KEY,
      mentor
    );

    return mentor;

  }

  function process(result) {

    const evidence =
      buildEvidence(
        result
      );

    if (!evidence.length)
      return {
        processed: 0,
        mistakes: 0
      };

    saveMistakes(
      evidence
    );

    const mentor =
      updateMentor(
        evidence
      );

    return {

      processed:
        evidence.length,

      mistakes:
        evidence.filter(
          x => x.wrong
        ).length,

      correct:
        evidence.filter(
          x => x.correct
        ).length,

      mentor

    };

  }

  window.PCBNICHODPostTest = {

    process,
    buildEvidence,
    updateMentor,
    saveMistakes

  };

})();
