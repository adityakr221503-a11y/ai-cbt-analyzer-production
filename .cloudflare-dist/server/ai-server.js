const http = require('http');

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
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
  const prompt = `You are the Ranker Pro NEET question-authoring engine. Create ${count} ORIGINAL multiple-choice candidate questions for ${subject}. Focus: ${focus}. Difficulty target: ${difficulty}. Strictly NEET syllabus and fair exam style. Biology must be NCERT-first; Physics/Chemistry should emphasize conceptual/application/numerical reasoning where appropriate. No ambiguous wording, no duplicate questions, no invented facts, no out-of-syllabus content. Source basis: ${sourceBasis}. Reference material may calibrate style/difficulty, but do not copy wording or reproduce source questions. Each question must have exactly four distinct options and one correct option. Return ONLY valid JSON matching this shape: ${JSON.stringify(schema)}. Do not include markdown.`;

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
    send(res, 200, {questions, model:MODEL, validatedByServer:true, generatedAt:new Date().toISOString()});
  } catch (e) {
    send(res, 400, {error:e.message || 'AI generation failed'});
  }
});

server.listen(PORT, () => console.log(`Ranker Pro AI server listening on :${PORT}`));
