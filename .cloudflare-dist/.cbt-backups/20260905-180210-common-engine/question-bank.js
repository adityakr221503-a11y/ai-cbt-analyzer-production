const RB_QUESTION_BANK_KEY = "rankBoosterQuestionBankV1";

function loadRBQuestionBank() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(RB_QUESTION_BANK_KEY) || "[]"
        );
        return Array.isArray(saved) ? saved : [];
    } catch (e) {
        console.warn("Rank Booster: failed to load question bank.", e);
        return [];
    }
}

function saveRBQuestionBank(questions) {
    try {
        localStorage.setItem(
            RB_QUESTION_BANK_KEY,
            JSON.stringify(questions)
        );
        return true;
    } catch (e) {
        console.error("Rank Booster: failed to save question bank.", e);
        return false;
    }
}

/* =====================================================
   RANK BOOSTER — QUESTION BANK v1
   ===================================================== */

const RankBoosterQuestionBank = {
    // TEST180 source is kept as a project asset; runtime bank remains localStorage-backed.


    version: "1.0.0",

    questions: loadRBQuestionBank(),

    add(question) {

        if (!question || typeof question !== "object") {
            return false;
        }

        if (!question.id) {
            return false;
        }

        if (!question.subject) {
            return false;
        }

        if (!question.chapter) {
            return false;
        }

        this.questions.push(question);
        saveRBQuestionBank(this.questions);

        return true;
    },

    getAll() {
        return [...this.questions];
    },

    count() {
        return this.questions.length;
    }

};

window.RankBoosterQuestionBank =
    RankBoosterQuestionBank;
/* =====================================================
   RANK BOOSTER — QUESTION CREATOR
   ===================================================== */

function createRankBoosterQuestion(data) {

    return {

        id: data.id,

        subject: data.subject,
        chapter: data.chapter,
        topic: data.topic || "",
        subTopic: data.subTopic || "",
        concept: data.concept || "",

        question: data.question,

        options: data.options || [],

        answer: data.answer,

        explanation: data.explanation || "",

        optionExplanations:
            data.optionExplanations || [],

        difficulty:
            data.difficulty || "NEET",

        questionType:
            data.questionType || "MCQ",

        source:
            data.source || "Rank Booster",

        ncertReference:
            data.ncertReference || "",

        syllabusReference:
            data.syllabusReference || "",

        commonTrap:
            data.commonTrap || "",

        tags:
            data.tags || [],

        createdAt: Date.now()

    };

}

window.createRankBoosterQuestion =
    createRankBoosterQuestion;
/* =====================================================
   RANK BOOSTER — FINGERPRINT / ANTI-REPEAT v1
   ===================================================== */

function normalizeRBText(text) {

    return String(text || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^\w\s]/g, "")
        .trim();

}


function getQuestionFingerprint(question) {

    const base = [

        question.subject,
        question.chapter,
        question.topic,
        question.concept,
        question.question,

        ...(question.options || [])

    ]
        .map(normalizeRBText)
        .join("|");

    return base;

}


function isDuplicateRankBoosterQuestion(
    question,
    existingQuestions
) {

    const fingerprint =
        getQuestionFingerprint(question);

    return existingQuestions.some(
        existing =>

            getQuestionFingerprint(existing)
            === fingerprint
    );

}


/* =====================================================
   SAFE ADD
   ===================================================== */

function addRankBoosterQuestion(question) {

    const existing =
        RankBoosterQuestionBank.getAll();

    if (
        isDuplicateRankBoosterQuestion(
            question,
            existing
        )
    ) {

        console.warn(
            "Rank Booster: Duplicate question rejected."
        );

        return false;

    }

    return RankBoosterQuestionBank.add(
        question
    );

}


window.getQuestionFingerprint =
    getQuestionFingerprint;

window.isDuplicateRankBoosterQuestion =
    isDuplicateRankBoosterQuestion;

window.addRankBoosterQuestion =
    addRankBoosterQuestion;
/* =====================================================
   RANK BOOSTER — ATTEMPT HISTORY v1
   ===================================================== */

const RB_HISTORY_KEY =
    "rankBoosterAttemptHistory";


function getRBHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                RB_HISTORY_KEY
            )
        ) || [];

    } catch (error) {

        console.warn(
            "Rank Booster history could not be loaded."
        );

        return [];

    }

}


function saveRBHistory(history) {

    localStorage.setItem(
        RB_HISTORY_KEY,
        JSON.stringify(history)
    );

}


function recordRBAttempt(data) {

    if (!data || !data.questionId) {
        return false;
    }

    const history =
        getRBHistory();

    history.push({

        questionId:
            data.questionId,

        subject:
            data.subject || "",

        chapter:
            data.chapter || "",

        topic:
            data.topic || "",

        concept:
            data.concept || "",

        selectedAnswer:
            data.selectedAnswer ?? null,

        correctAnswer:
            data.correctAnswer ?? null,

        correct:
            Boolean(data.correct),

        timestamp:
            Date.now()

    });

    saveRBHistory(history);

    return true;

}


/* =====================================================
   HISTORY HELPERS
   ===================================================== */

function hasRBQuestionBeenAttempted(
    questionId
) {

    return getRBHistory().some(
        item =>
            item.questionId === questionId
    );

}


function getRBQuestionAttempts(
    questionId
) {

    return getRBHistory().filter(
        item =>
            item.questionId === questionId
    );

}


function getRBWrongAttempts() {

    return getRBHistory().filter(
        item =>
            item.correct === false
    );

}


window.getRBHistory =
    getRBHistory;

window.recordRBAttempt =
    recordRBAttempt;

window.hasRBQuestionBeenAttempted =
    hasRBQuestionBeenAttempted;

window.getRBQuestionAttempts =
    getRBQuestionAttempts;

window.getRBWrongAttempts =
    getRBWrongAttempts;
/* =====================================================
   RANK BOOSTER — WEAK TOPIC ANALYZER v1
   ===================================================== */

function getRBWeakTopics() {

    const history = getRBHistory();
    const stats = {};

    history.forEach(item => {

        const key =
            [
                item.subject,
                item.chapter,
                item.topic,
                item.concept
            ]
            .map(normalizeRBText)
            .join("|");

        if (!stats[key]) {

            stats[key] = {

                subject: item.subject,
                chapter: item.chapter,
                topic: item.topic,
                concept: item.concept,

                attempts: 0,
                wrong: 0,
                correct: 0

            };

        }

        stats[key].attempts++;

        if (item.correct) {
            stats[key].correct++;
        } else {
            stats[key].wrong++;
        }

    });

    return Object.values(stats)
        .map(item => ({

            ...item,

            accuracy:
                item.attempts
                    ? Math.round(
                        (
                            item.correct /
                            item.attempts
                        ) * 100
                    )
                    : 0,

            weaknessScore:
                item.attempts
                    ? Math.round(
                        (
                            item.wrong /
                            item.attempts
                        ) * 100
                    )
                    : 0

        }))
        .sort(
            (a, b) =>
                b.weaknessScore -
                a.weaknessScore
        );

}


/* =====================================================
   GET STRONG / WEAK
   ===================================================== */

function getRBWeakTopicsOnly() {

    return getRBWeakTopics()
        .filter(
            item =>
                item.attempts >= 2 &&
                item.accuracy < 60
        );

}


function getRBStrongTopics() {

    return getRBWeakTopics()
        .filter(
            item =>
                item.attempts >= 2 &&
                item.accuracy >= 80
        );

}


window.getRBWeakTopics =
    getRBWeakTopics;

window.getRBWeakTopicsOnly =
    getRBWeakTopicsOnly;

window.getRBStrongTopics =
    getRBStrongTopics;
/* =====================================================
   RANK BOOSTER — SMART QUESTION SELECTION v1
   ===================================================== */

function selectRankBoosterQuestions(options = {}) {

    const {

        subject = null,

        chapters = [],

        difficulty = "Mixed",

        count = 20,

        mode = "balanced"

    } = options;


    let pool =
        RankBoosterQuestionBank.getAll();


    /* =================================================
       SUBJECT FILTER
       ================================================= */

    if (subject) {

        pool = pool.filter(
            q =>
                q.subject === subject
        );

    }


    /* =================================================
       CHAPTER FILTER
       Supports multiple chapters
       ================================================= */

    if (
        Array.isArray(chapters) &&
        chapters.length > 0
    ) {

        pool = pool.filter(
            q =>
                chapters.includes(
                    q.chapter
                )
        );

    }


    /* =================================================
       DIFFICULTY FILTER
       ================================================= */

    if (
        difficulty !== "Mixed"
    ) {

        pool = pool.filter(
            q =>
                q.difficulty === difficulty
        );

    }


    /* =================================================
       REMOVE PREVIOUSLY ATTEMPTED
       FOR UNSEEN MODE
       ================================================= */


  if (
        mode === "unseen"
    ) {

        pool = pool.filter(
            q =>
                !hasRBQuestionBeenAttempted(
                    q.id
                )
        );

    }


    /* =================================================
       WEAK TOPIC MODE
       ================================================= */

    if (
        mode === "weak"
    ) {

        const weakTopics =
            getRBWeakTopicsOnly();


        if (
            weakTopics.length > 0
        ) {

            pool = pool.filter(
                q =>

                    weakTopics.some(
                        weak =>

                            weak.subject ===
                                q.subject &&

                            weak.chapter ===
                                q.chapter &&

                            (
                                !weak.topic ||
                                weak.topic ===
                                    q.topic
                            )

                    )
            );

        }

    }


    /* =================================================
       RANDOMIZE
       ================================================= */

    pool.sort(
        () => Math.random() - 0.5
    );


    /* =================================================
       RETURN REQUESTED COUNT
       ================================================= */

    return pool.slice(
        0,
        Math.max(
            0,
            Number(count)
        )
    );

}
window.selectRankBoosterQuestions =
    selectRankBoosterQuestions;

/* =====================================================
   RANK BOOSTER — TEST GENERATOR v1
   ===================================================== */

function generateRankBoosterTest(options = {}) {

    const {

        subjects = [],
        chapters = [],
        difficulty = "Mixed",
        mode = "balanced",
        count = 20

    } = options;


    let pool =
        RankBoosterQuestionBank.getAll();


    /* =================================================
       SUBJECTS
       ================================================= */

    if (
        Array.isArray(subjects) &&
        subjects.length > 0
    ) {

        pool = pool.filter(
            q =>
                subjects.includes(
                    q.subject
                )
        );

    }


    /* =================================================
       CHAPTERS
       ================================================= */

    if (
        Array.isArray(chapters) &&
        chapters.length > 0
    ) {

        pool = pool.filter(
            q =>
                chapters.includes(
                    q.chapter
                )
        );

    }


    /* =================================================
       DIFFICULTY
       ================================================= */

    if (
        difficulty !== "Mixed"
    ) {

        pool = pool.filter(
            q =>
                q.difficulty === difficulty
        );

    }


    /* =================================================
       UNSEEN MODE
       ================================================= */

    if (
        mode === "unseen"
    ) {

        pool = pool.filter(
            q =>
                !hasRBQuestionBeenAttempted(
                    q.id
                )
        );

    }


    /* =================================================
       WEAK MODE
       ================================================= */

    if (
        mode === "weak"
    ) {

        const weak =
            getRBWeakTopicsOnly();


        if (weak.length > 0) {

            pool = pool.filter(
                q =>

                    weak.some(
                        w =>

                            w.subject ===
                                q.subject &&

                            w.chapter ===
                                q.chapter &&

                            (
                                !w.topic ||
                                w.topic ===
                                    q.topic
                            )

                    )
            );

        }

    }


    /* =================================================
       RANDOMIZE
       ================================================= */

    pool.sort(
        () => Math.random() - 0.5
    );


    const selected =
        pool.slice(
            0,
            Math.max(
                0,
                Number(count)
            )
        );


    /* =================================================
       TEST OBJECT
       ================================================= */

    return {

        id:
            "RB-" +
            Date.now(),

        createdAt:
            Date.now(),

        settings: {

            subjects,
            chapters,
            difficulty,
            mode,
            count

        },

        questions:
            selected

    };

}


window.generateRankBoosterTest =
    generateRankBoosterTest;
/* =====================================================
   RANK BOOSTER — ADAPTIVE SELECTION v1
   ===================================================== */

function getRBQuestionPriority(question) {

    const weakTopics =
        getRBWeakTopics();

    const match =
        weakTopics.find(item =>

            item.subject === question.subject &&

            item.chapter === question.chapter &&

            (
                !item.topic ||
                item.topic === question.topic
            )

        );

    /* No previous weakness data */
    if (!match) {
        return 50;
    }

    /*
       Lower accuracy = higher priority
    */

    let priority =
        50 + match.weaknessScore;

    /*
       Previously attempted wrong questions
       increase concept priority.
    */

    const attempts =
        getRBQuestionAttempts(
            question.id
        );

    const wrongAttempts =
        attempts.filter(
            item =>
                item.correct === false
        ).length;

    priority +=
        wrongAttempts * 10;

    return Math.min(
        100,
        priority
    );

}


/* =====================================================
   ADAPTIVE TEST GENERATOR
   ===================================================== */

function generateAdaptiveRankBoosterTest(
    options = {}
) {

    const {

        subjects = [],
        chapters = [],
        difficulty = "Mixed",
        count = 20

    } = options;


    let pool =
        RankBoosterQuestionBank.getAll();


    /* SUBJECT FILTER */

    if (
        subjects.length > 0
    ) {

        pool = pool.filter(
            q =>
                subjects.includes(
                    q.subject
                )
        );

    }


    /* CHAPTER FILTER */

    if (
        chapters.length > 0
    ) {

          pool = pool.filter(
              q => chapters.includes(q.chapter)
          );

    }


    /* DIFFICULTY FILTER */

    if (
        difficulty !== "Mixed"
    ) {

        pool = pool.filter(
            q =>
                q.difficulty ===
                difficulty
        );

    }


    /* REMOVE EXACT DUPLICATES */

    const unique = [];

    const fingerprints =
        new Set();


    pool.forEach(q => {

        const fingerprint =
            getQuestionFingerprint(q);

        if (
            !fingerprints.has(
                fingerprint
            )
        ) {

            fingerprints.add(
                fingerprint
            );

            unique.push(q);

        }

    });


    /* =================================================
       SCORE QUESTIONS
       ================================================= */

    const scored =
        unique.map(q => ({

            question: q,

            priority:
                getRBQuestionPriority(q) +

                Math.random() * 15

        }));


    /* =================================================
       HIGHEST PRIORITY FIRST
       ================================================= */

    scored.sort(
        (a, b) =>
            b.priority -
            a.priority
    );


    /* =================================================
       CREATE TEST
       ================================================= */

    const selected =
        scored
            .slice(
                0,
                Math.max(
                    0,
                    Number(count)
                )
            )
            .map(
                item =>
                    item.question
            );


    return {

        id:
            "RB-ADAPTIVE-" +
            Date.now(),

        type:
            "Adaptive Rank Booster",

        createdAt:
            Date.now(),

        settings: {

            subjects,
            chapters,
            difficulty,
            count

        },

        questions:
            selected

    };

}


window.getRBQuestionPriority =
    getRBQuestionPriority;

window.generateAdaptiveRankBoosterTest =
    generateAdaptiveRankBoosterTest;

          /* =====================================================
   RANK BOOSTER — SYLLABUS BALANCER v1
   ===================================================== */

function balanceRankBoosterQuestions(
    questions,
    count
) {

    if (!Array.isArray(questions)) {
        return [];
    }

    if (questions.length <= count) {
        return [...questions];
    }


    /* =================================================
       GROUP QUESTIONS BY SUBJECT
       ================================================= */

    const groups = {};

    questions.forEach(question => {

        const subject =
            question.subject || "Other";

        if (!groups[subject]) {
            groups[subject] = [];
        }

        groups[subject].push(question);

    });


    const subjects =
        Object.keys(groups);

    const result = [];


    /* =================================================
       ROUND-ROBIN SELECTION
       Prevents one subject from dominating
       ================================================= */

    let index = 0;

    while (
        result.length < count &&
        subjects.length > 0
    ) {

        const subject =
            subjects[
                index % subjects.length
            ];

        const group =
            groups[subject];

        if (group.length > 0) {

            result.push(
                group.shift()
            );

        }

        index++;

        if (
            subjects.every(
                subject =>
                    groups[subject].length === 0
            )
        ) {
            break;
        }

    }


    return result;

}


/* =====================================================
   FULL SYLLABUS TEST
   ===================================================== */

function generateFullSyllabusRankBoosterTest(
    options = {}
) {

    const {

        difficulty = "Mixed",

        count = 180

    } = options;


    let pool =
        RankBoosterQuestionBank.getAll();


    /* =================================================
       DIFFICULTY
       ================================================= */

    if (
        difficulty !== "Mixed"
    ) {

        pool = pool.filter(
            q =>
                q.difficulty ===
                difficulty
        );

    }


    /* =================================================
       REMOVE EXACT DUPLICATES
       ================================================= */

    const fingerprints =
        new Set();

    pool =
        pool.filter(q => {

            const fingerprint =
                getQuestionFingerprint(q);

            if (
                fingerprints.has(
                    fingerprint
                )
            ) {
                return false;
            }

            fingerprints.add(
                fingerprint
            );

            return true;

        });


    /* =================================================
       SHUFFLE
       ================================================= */

    pool.sort(
        () => Math.random() - 0.5
    );


    /* =================================================
       BALANCE SUBJECTS
       ================================================= */

    const selected =
        balanceRankBoosterQuestions(
            pool,
            Number(count)
        );


    return {

        id:
            "RB-FULL-" +
            Date.now(),

        type:
            "Full Syllabus Rank Booster",

        createdAt:
            Date.now(),

        settings: {

            difficulty,
            count

        },

        questions:
            selected

    };

}


window.balanceRankBoosterQuestions =
    balanceRankBoosterQuestions;

window.generateFullSyllabusRankBoosterTest =
    generateFullSyllabusRankBoosterTest;


