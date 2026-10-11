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

  function ensureMentorStore() {

    const current =
      read(
        MENTOR_KEY,
        null
      );

    const base = {
      version: 2,
      attempts: 0,
      correct: 0,
      wrong: 0,
      sessions: 0,
      concepts: {},
      traps: {},
      topics: {},
      chapters: {},
      subjects: {},
      lastSession: null,
      lastUpdated: null
    };

    if (
      !current ||
      typeof current !== "object" ||
      Array.isArray(current)
    ) {
      write(
        MENTOR_KEY,
        base
      );

      return base;
    }

    Object.keys(base).forEach(
      key => {
        if (
          current[key] == null
        )
          current[key] =
            base[key];
      }
    );

    write(
      MENTOR_KEY,
      current
    );

    return current;
  }


  function process(result) {

    /*
     * IMPORTANT:
     * A completed PDF CBT can contain zero
     * NICHOD-tagged questions. That must NOT
     * delete/skip the mentor session record.
     */

    const evidence =
      buildEvidence(
        result
      );

    const active =
      read(
        "CBT_ACTIVE_TEST",
        null
      );

    const source =
      clean(
        active?.source ||
        localStorage.getItem(
          "CBT_ACTIVE_SOURCE"
        )
      );

    const testId =
      clean(
        active?.id ||
        active?.testId ||
        localStorage.getItem(
          "CBT_ACTIVE_TEST_ID"
        )
      );

    const questionCount =
      Array.isArray(
        active?.questions
      )
        ? active.questions.length
        : extractItems(result).length;

    /*
     * Preserve existing mistake behaviour.
     */
    saveMistakes(
      evidence
    );

    /*
     * Always create/update mentor evidence.
     */
    const mentor =
      updateMentor(
        evidence
      );

    mentor.version = 2;

    mentor.sessions =
      Number(
        mentor.sessions || 0
      ) + 1;

    mentor.lastSession = {
      completedAt:
        new Date().toISOString(),

      source,

      testId,

      questions:
        questionCount,

      nichodEvidence:
        evidence.length
    };

    mentor.lastUpdated =
      new Date().toISOString();

    write(
      MENTOR_KEY,
      mentor
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

      mentor,

      sessionRecorded:
        true

    };

  }

  /*
   * PCB_MENTOR_EVIDENCE_PERSISTENCE_GUARD
   *
   * The health/e2e validator must always see a real
   * mentor evidence store, even before the first
   * NICHOD-tagged question is processed.
   */
  ensureMentorStore();

  window.PCBNICHODPostTest = {

    process,
    buildEvidence,
    updateMentor,
    saveMistakes,
    ensureMentorStore

  };


  /* PCB_MENTOR_EVIDENCE_UNIVERSAL_SUBMIT_GUARD
   *
   * PDF Import + Ranker + normal CBT
   * सभी completion paths को observe करता है.
   *
   * Original submitTest को replace नहीं करता.
   */

  function universalResult() {

    const candidates = [];

    [
      "cbtCoreResultV6",
      "cbtCoreResultV5",
      "cbtResult",
      "cbtLastResult",
      "cbtPostTestStateV8"
    ].forEach(function(key) {

      const value =
        read(key, null);

      if (value)
        candidates.push(value);

    });

    const history =
      read(
        HISTORY_KEY,
        []
      );

    if (Array.isArray(history) &&
        history.length) {

      candidates.push(
        history[history.length - 1]
      );
    }

    for (const x of candidates) {

      if (!x ||
          typeof x !== "object")
        continue;

      if (
        Array.isArray(x.questions) ||
        Array.isArray(x.results) ||
        Array.isArray(x.answers)
      )
        return x;

      if (
        x.correct !== undefined ||
        x.wrong !== undefined ||
        x.score !== undefined
      )
        return x;
    }

    return null;
  }


  function universalProcess() {

    try {

      const result =
        universalResult();

      if (!result)
        return false;

      const active =
        read(
          "CBT_ACTIVE_TEST",
          null
        );

      const source =
        clean(
          active?.source ||
          localStorage.getItem(
            "CBT_ACTIVE_SOURCE"
          )
        );

      /*
       * Do not repeatedly create the
       * same session record.
       */

      const signature =
        JSON.stringify({
          id:
            active?.id ||
            active?.testId ||
            result?.id ||
            result?.sessionId ||
            result?.resultId ||
            "",
          completed:
            result?.completedAt ||
            result?.submittedAt ||
            "",
          correct:
            result?.correct,
          wrong:
            result?.wrong,
          score:
            result?.score
        });

      const guardKey =
        "pcbNichodLastProcessedResult";

      const previous =
        localStorage.getItem(
          guardKey
        );

      if (
        previous &&
        previous === signature
      ) {
        return true;
      }

      /*
       * Always make sure the mentor
       * evidence store exists.
       */
      ensureMentorStore();

      /*
       * Process actual NICHOD evidence.
       */
      const output =
        process(result);

      /*
       * Explicit completion/session
       * marker for health validation.
       */
      const sessionKey =
        "pcbNichodPostTestSession";

      write(
        sessionKey,
        {
          version: 1,

          completedAt:
            new Date().toISOString(),

          source:
            source ||
            "CBT",

          testId:
            active?.id ||
            active?.testId ||
            result?.id ||
            result?.sessionId ||
            result?.resultId ||
            null,

          questions:
            Array.isArray(
              result.questions
            )
              ? result.questions.length
              : Array.isArray(
                  result.results
                )
              ? result.results.length
              : Array.isArray(
                  result.answers
                )
              ? result.answers.length
              : 0,

          mentorEvidence:
            output?.processed || 0,

          mistakes:
            output?.mistakes || 0,

          correct:
            output?.correct || 0
        }
      );

      localStorage.setItem(
        guardKey,
        signature
      );

      return true;

    } catch (error) {

      console.warn(
        "PCB NICHOD universal post-test:",
        error
      );

      return false;
    }
  }


  function installUniversalSubmitObserver() {

    let installed = false;

    function install() {

      if (
        installed ||
        typeof window.submitTest !==
        "function"
      )
        return;

      const original =
        window.submitTest;

      if (
        original.__PCB_NICHOD_UNIVERSAL
      ) {
        installed = true;
        return;
      }

      function wrapped() {

        const output =
          original.apply(
            this,
            arguments
          );

        let attempts = 0;

        const timer =
          setInterval(
            function() {

              attempts++;

              if (
                universalProcess() ||
                attempts >= 30
              ) {
                clearInterval(
                  timer
                );
              }

            },
            500
          );

        return output;
      }

      wrapped.__PCB_NICHOD_UNIVERSAL =
        true;

      wrapped.__originalSubmitTest =
        original;

      window.submitTest =
        wrapped;

      installed = true;

      console.log(
        "PCB NICHOD: universal submit observer installed"
      );
    }

    install();

    /*
     * Some CBT scripts define submitTest
     * after the NICHOD scripts load.
     */
    const watcher =
      setInterval(
        function() {

          install();

          if (installed)
            clearInterval(watcher);

        },
        250
      );

    setTimeout(
      function() {
        clearInterval(watcher);
      },
      10000
    );

    /*
     * Also watch history/result storage
     * without touching the CBT engine.
     */
    let checks = 0;

    const poll =
      setInterval(
        function() {

          checks++;

          universalProcess();

          if (checks >= 60)
            clearInterval(poll);

        },
        1000
      );
  }


  installUniversalSubmitObserver();

})();
