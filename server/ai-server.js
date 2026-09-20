const http = require('http');

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const ENGINE_VERSION = 'RANKFORGE-EXAMINER-ORIGINAL-V1';
const API_KEY = process.env.OPENAI_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const schema = {
  questions: [{
    id: 'unique string',
    question: 'string',
    options: ['A','B','C','D'],
    correctAnswer: 'A',
    explanation: 'string',
    detailedSolution: 'string',
    subject: 'Physics|Chemistry|Biology',
    chapter: 'string',
    topic: 'string',
    concept: 'string',
    difficultyLevel: 'L1|L2|L3|L4|L5|L6',
    questionType: 'string',
    syllabusRelevant: true,
    source: 'AI-generated candidate',
    sourceBasis: 'approved source material / curriculum rules',
    sourceType: 'curriculum-grounded',
    generationMethod: 'secure-llm',
    noveltyScore: 0
  }]
};

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 200000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(new Error('Invalid JSON body')); } });
    req.on('error', reject);
  });
}

function extractText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const out = [];
  const walk = x => {
    if (!x) return;
    if (typeof x === 'string') return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === 'object') {
      if (typeof x.text === 'string') out.push(x.text);
      if (typeof x.output_text === 'string') out.push(x.output_text);
      Object.values(x).forEach(walk);
    }
  };
  walk(data.output);
  return out.join('\n');
}

function cleanJson(text) {
  const t = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI returned non-JSON output');
  return JSON.parse(t.slice(start, end + 1));
}

function validateQuestions(questions, requested) {
  if (!Array.isArray(questions) || questions.length === 0) throw new Error('AI returned no questions');
  if (questions.length > requested) questions = questions.slice(0, requested);
  const seen = new Set();
  for (const q of questions) {
    if (!q || typeof q.question !== 'string' || !Array.isArray(q.options) || q.options.length !== 4) throw new Error('AI returned an invalid question shape');
    if (!['A','B','C','D'].includes(q.correctAnswer)) throw new Error('AI returned an invalid correctAnswer');
    if (q.options.some(x => typeof x !== 'string' || !x.trim())) throw new Error('AI returned an empty option');
    if (new Set(q.options.map(x => x.trim().toLowerCase())).size !== 4) throw new Error('AI returned duplicate options');
    if (typeof q.explanation !== 'string' || !q.explanation.trim()) throw new Error('AI returned no explanation');
    if (typeof q.concept !== 'string' || !q.concept.trim()) throw new Error('AI returned no concept');
    if (typeof q.questionType !== 'string' || !q.questionType.trim()) throw new Error('AI returned no question type');
    if (typeof q.trapType !== 'string' || !q.trapType.trim()) throw new Error('AI returned no trap type');
    if (!Number.isFinite(Number(q.noveltyScore)) || Number(q.noveltyScore) < 0 || Number(q.noveltyScore) > 100) throw new Error('AI returned invalid novelty score');
    const key = q.question.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) throw new Error('AI returned duplicate questions');
    seen.add(key);
    if (!/^L[1-6]$/.test(q.difficultyLevel || '')) throw new Error('AI returned invalid difficulty');
    if (q.syllabusRelevant !== true) throw new Error('AI returned a non-NEET-relevant question');
  }
  return questions;
}

async function generate(job) {
  if (!API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server');
  const count = Math.max(1, Math.min(20, Number(job.count) || 5));
  const focus = String(job.focus || 'the current high-impact weakness').slice(0, 200);
  const sourceBasis = String(job.sourceBasis || "approved curriculum source material and the app's reference/calibration rules").slice(0, 600);
  const subject = ['Physics','Chemistry','Biology'].includes(job.subject) ? job.subject : 'Biology';
  const difficulty = String(job.difficulty || 'Adaptive L1–L6');
  const prompt = `You are the RankForge NEET Original Examiner Question Engine.

Your job is NOT to rewrite, paraphrase, remix, or imitate questions from books, coaching modules, websites, previous tests, or reference material.

Create ${count} genuinely fresh NEET-style multiple-choice candidate questions for ${subject}.

TARGET:
- Subject: ${subject}
- Difficulty: ${difficulty}
- Focus: ${focus}
- Strictly NEET syllabus and scientifically correct.
- Biology: NCERT-first.
- Physics/Chemistry: NEET-relevant conceptual, application, numerical, graph/data and condition-change reasoning where appropriate.

EXAMINER-THINKING FRAMEWORK:
For every question internally follow:

1. Select one precise syllabus concept.
2. Identify the underlying principle/fact being tested.
3. Change the presentation or situation.
4. Create an unfamiliar but fair scenario.
5. Require the student to infer, compare, predict, calculate, interpret, or eliminate.
6. Construct four plausible options.
7. Make distractors correspond to realistic conceptual mistakes.
8. Verify that exactly one option is correct.
9. Check NCERT/syllabus correctness.
10. Check that the question is not merely a reworded textbook/coaching question.
11. Check that the same reasoning pattern is not repeated unnecessarily within this batch.
12. Prefer information transformation over information recall when appropriate.

ALLOWED QUESTION PATTERNS:
- unfamiliar application of a familiar concept
- condition-change / what-if reasoning
- statement and inference
- assertion-style reasoning
- experimental observation
- graph/data/table interpretation
- diagram interpretation
- comparison and elimination
- multi-concept NEET reasoning
- numerical reasoning where appropriate
- NCERT precision with a genuinely new framing
- misconception/trap-based but fair questions

BIOLOGY SPECIAL RULES:
- Treat NCERT as the factual authority.
- Do not invent biological facts.
- You may combine separate NCERT facts only when the resulting inference is scientifically valid.
- Prefer hidden relationships, diagrams, exceptions, sequences, experimental observations and statement combinations.
- Do not turn a simple NCERT line into a cosmetic synonym-replacement question.

PHYSICS SPECIAL RULES:
- Prefer physical interpretation before calculation.
- Use condition changes, graphs, limiting cases, dimensions, proportionality and multi-step reasoning where appropriate.
- Do not create unnecessarily difficult JEE-Advanced mathematics.
- Every numerical answer must be independently checked.

CHEMISTRY SPECIAL RULES:
- Respect NCERT inorganic facts and exceptions.
- Use reaction conditions, trends, structures, equilibrium reasoning and numerical interpretation where appropriate.
- Do not invent reactions or properties.

ORIGINALITY RULES:
- Do not reproduce a known question.
- Do not copy wording from any reference.
- Do not make a superficial synonym rewrite.
- Do not use the same numerical values and relationship merely rearranged.
- Do not reuse an obvious question template with only names/numbers changed.
- Reference material may calibrate syllabus, factual correctness and difficulty only.
- Each candidate should have a distinct reasoning path.
- If you cannot create a sufficiently original question, omit it rather than filling the quota with a weak paraphrase.

QUALITY RULES:
- Exactly four distinct options.
- Exactly one correct answer.
- No ambiguous wording.
- No trick based purely on grammar.
- No out-of-syllabus dependency.
- No unsupported real-world assumptions.
- No multiple correct answers.
- No "all of the above" or "none of the above".
- Explanation must explain WHY the correct answer follows.
- Include the specific concept/chapter/topic.
- Include the examiner-style question type.
- Include the trap type.
- Include a self-estimated novelty score from 0-100. This score is only a candidate estimate; the application's originality gate remains authoritative.

INTERNAL SELF-CHECK BEFORE OUTPUT:
Reject your own candidate if:
- it is a paraphrase;
- it is too close to a common textbook/coaching question;
- its answer is ambiguous;
- its options do not represent plausible misconceptions;
- it depends on an out-of-syllabus fact;
- the question is difficult only because the language is confusing;
- the calculation has not been verified.

SOURCE POLICY:
${sourceBasis}

Return ONLY JSON in exactly this structure:
{
  "questions": [
    {
      "id": "unique string",
      "question": "original question",
      "options": ["option A","option B","option C","option D"],
      "correctAnswer": "A",
      "explanation": "clear reason why the answer is correct",
      "detailedSolution": "stepwise reasoning where applicable",
      "subject": "${subject}",
      "chapter": "chapter",
      "topic": "topic",
      "concept": "specific concept",
      "difficultyLevel": "L1|L2|L3|L4|L5|L6",
      "questionType": "application|inference|statement|experimental|graph-data|diagram|comparison|numerical|multi-concept|NCERT-precision",
      "trapType": "concept|calculation|NCERT-precision|statement|comparison|application|unit|graph|exception|multi-concept",
      "syllabusRelevant": true,
      "source": "RankForge AI Original",
      "sourceBasis": "curriculum-grounded",
      "sourceType": "curriculum-grounded",
      "generationMethod": "examiner-thinking-engine",
      "noveltyScore": 0
    }
  ]
}

Do not include markdown or any text outside the JSON.`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {'Content-Type':'application/json','Authorization':`Bearer ${API_KEY}`},
    body: JSON.stringify({model: MODEL, input: prompt})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
  const parsed = cleanJson(extractText(data));
  return validateQuestions(parsed.questions, count);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, {ok:true, service:'ranker-pro-ai', model:MODEL});
  if (req.method !== 'POST' || req.url !== '/api/ai/generate') return send(res, 404, {error:'Not found'});
  try {
    const job = await readBody(req);
    const questions = await generate(job);
    send(res, 200, {questions, model:MODEL, engineVersion:ENGINE_VERSION, validatedByServer:true, examinerThinking:true, generatedAt:new Date().toISOString()});
  } catch (e) {
    send(res, 400, {error:e.message || 'AI generation failed'});
  }
});

server.listen(PORT, () => console.log(`Ranker Pro AI server listening on :${PORT}`));
