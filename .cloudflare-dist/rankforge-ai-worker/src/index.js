const JSON_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "cache-control": "no-store"
};

function corsHeaders(origin, allowed) {
  return {
    "Access-Control-Allow-Origin": origin === allowed ? allowed : allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function response(data, status, origin, allowed) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(origin, allowed)
    }
  });
}

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(
    clean(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
  );
}

function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;

  let intersection = 0;
  for (const x of A) {
    if (B.has(x)) intersection++;
  }

  return intersection / (A.size + B.size - intersection);
}

function normalizeAnswer(answer, options) {
  const raw = clean(answer);
  const upper = raw.toUpperCase();

  const letters = ["A", "B", "C", "D"];
  const letterIndex = letters.indexOf(upper);

  if (letterIndex >= 0 && options[letterIndex]) {
    return {
      correctAnswer: options[letterIndex],
      correctIndex: letterIndex
    };
  }

  const idx = options.findIndex(
    x => clean(x).toLowerCase() === raw.toLowerCase()
  );

  if (idx >= 0) {
    return {
      correctAnswer: options[idx],
      correctIndex: idx
    };
  }

  return null;
}

function validateQuestion(q, index) {
  if (!q || typeof q !== "object") return null;

  const text = clean(q.question || q.text);
  const options = Array.isArray(q.options)
    ? q.options.map(clean).filter(Boolean)
    : [];

  if (!text || options.length !== 4) return null;

  const uniqueOptions = new Set(
    options.map(x => x.toLowerCase())
  );

  if (uniqueOptions.size !== 4) return null;

  const answer = normalizeAnswer(
    q.correctAnswer ?? q.answer ?? q.correct,
    options
  );

  if (!answer) return null;

  const explanation = clean(
    q.explanation ||
    q.solution ||
    q.detailedSolution
  );

  if (explanation.length < 20) return null;

  return {
    id: clean(q.id) ||
      `RF-AI-${Date.now()}-${index}-${crypto.randomUUID().slice(0, 8)}`,

    question: text,
    text,

    options,

    correctAnswer: answer.correctAnswer,
    correctIndex: answer.correctIndex,

    explanation,

    subject: clean(q.subject) || "Mixed NEET",
    chapter: clean(q.chapter) || "Mixed",
    topic: clean(q.topic) || "Mixed",
    difficulty: clean(q.difficulty) || "Rank Booster",

    concepts: Array.isArray(q.concepts)
      ? q.concepts.map(clean).filter(Boolean)
      : [],

    traps: Array.isArray(q.traps)
      ? q.traps.map(clean).filter(Boolean)
      : [],

    ncertAnchor: clean(
      q.ncertAnchor ||
      q.ncert ||
      q.ncertPoint
    ),

    questionFamily: clean(
      q.questionFamily
    ) || "AI Rank Booster",

    source: "AI Rank Booster",
    aiGenerated: true,
    qualityStatus: "AI_REVIEWED",
    createdAt: new Date().toISOString()
  };
}

const SYSTEM_PROMPT = `
You are RankForge AI Question Studio, an expert NEET rank-booster question designer.

Generate ORIGINAL, exam-quality MCQs.

Core rules:
1. NCERT-first, especially Biology.
2. NEET treatment must remain appropriate.
3. Physics and Chemistry may use limited JEE-Main-level thinking where useful.
4. Prefer concept traps, application, inference, comparison, calculation and close options.
5. Exactly FOUR unique options.
6. Exactly ONE defensible correct answer.
7. Never create ambiguous questions.
8. Never create two options that can both reasonably be correct.
9. Never copy or lightly reword known questions.
10. Avoid basic filler questions.
11. Every question needs a meaningful explanation.
12. For Biology include an NCERT anchor whenever applicable.
13. Include concept/trap metadata.
14. Return JSON only.

Output shape:
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": "A",
      "explanation": "...",
      "subject": "...",
      "chapter": "...",
      "topic": "...",
      "difficulty": "...",
      "concepts": ["..."],
      "traps": ["..."],
      "ncertAnchor": "...",
      "questionFamily": "..."
    }
  ]
}
`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN ||
      "https://adityakr221503-a11y.github.io";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, allowed)
      });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/api/ai/generate") {
      return response(
        {
          ok: true,
          service: "RankForge AI",
          endpoint: "/api/ai/generate"
        },
        200,
        origin,
        allowed
      );
    }

    if (request.method !== "POST") {
      return response(
        { ok: false, error: "POST required" },
        405,
        origin,
        allowed
      );
    }

    if (!env.OPENAI_API_KEY) {
      return response(
        { ok: false, error: "AI provider secret is not configured" },
        503,
        origin,
        allowed
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return response(
        { ok: false, error: "Invalid JSON request" },
        400,
        origin,
        allowed
      );
    }

    const count = Math.min(
      Math.max(Number(body.count) || 10, 1),
      90
    );

    const subject = clean(body.subject) || "Mixed NEET";
    const difficulty = clean(body.difficulty) || "Rank Booster";
    const chapter = clean(body.chapter) || "Mixed";
    const topic = clean(body.topic) || "Mixed";

    const userPrompt = `
Create ${count} original questions.

Subject: ${subject}
Difficulty: ${difficulty}
Chapter: ${chapter}
Topic: ${topic}

Requirements:
- NEET rank-booster quality.
- No reworded duplicates.
- Strong distractors.
- One clearly defensible answer.
- Detailed but concise reasoning.
- NCERT anchor wherever applicable.
- Avoid unsupported facts.
- Avoid trivial textbook recall unless it tests a subtle examiner trap.
`;

    const upstream = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          temperature: 0.75,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            {
              role: "user",
              content: userPrompt
            }
          ],
          response_format: {
            type: "json_object"
          }
        })
      }
    );

    if (!upstream.ok) {
      const errorText = await upstream.text();

      return response(
        {
          ok: false,
          error: "AI provider request failed",
          providerStatus: upstream.status,
          detail: errorText.slice(0, 1000)
        },
        502,
        origin,
        allowed
      );
    }

    const ai = await upstream.json();

    const rawText =
      ai?.choices?.[0]?.message?.content || "";

    let parsed;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      return response(
        {
          ok: false,
          error: "AI returned invalid JSON"
        },
        502,
        origin,
        allowed
      );
    }

    const rawQuestions =
      Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.questions)
          ? parsed.questions
          : [];

    const accepted = [];

    for (let i = 0; i < rawQuestions.length; i++) {
      const q = validateQuestion(rawQuestions[i], i);

      if (!q) continue;

      const exact = accepted.some(
        x =>
          clean(x.question).toLowerCase() ===
          clean(q.question).toLowerCase()
      );

      if (exact) continue;

      const near = accepted.some(
        x => similarity(x.question, q.question) >= 0.82
      );

      if (near) continue;

      accepted.push(q);

      if (accepted.length >= count) break;
    }

    return response(
      {
        ok: true,
        provider: "secure-worker",
        requested: count,
        accepted: accepted.length,
        rejected: rawQuestions.length - accepted.length,
        questions: accepted
      },
      200,
      origin,
      allowed
    );
  }
};
