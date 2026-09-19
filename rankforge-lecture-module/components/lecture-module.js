(function () {
  "use strict";

<<<<<<< HEAD
  const DATA = window.RANKFORGE_LECTURE_DATA || {subjects:[]};

  function setCurrentLectureContext(lecture) {
    if (
      window.RankForgeLectureAI &&
      typeof window.RankForgeLectureAI.setLectureContext === "function"
    ) {
      window.RankForgeLectureAI.setLectureContext(lecture);
    }
  }
  const STORAGE = "rankforgeLectureProgressV1";

  let state = {
    subject: "all",
    query: "",
    progress: {}
  };

  try {
    state.progress = JSON.parse(localStorage.getItem(STORAGE) || "{}");
  } catch (_) {}

  const allSubjects = DATA.subjects || [];

  function allLectures() {
    return allSubjects.flatMap(s =>
      (s.chapters || []).flatMap(c =>
        (c.lectures || []).map(l => ({
          ...l,
          subjectId: s.id,
          subjectName: s.name,
          subjectIcon: s.icon,
          chapterId: c.id,
          chapterName: c.name
        }))
      )
    );
  }

  function save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state.progress));
    } catch (_) {}
  }

  function isDone(id) {
    return !!state.progress[id];
  }

  function toggleDone(id) {
    const lecture = allLectures().find(x => x.id === id);
    if (lecture) setCurrentLectureContext(lecture);
    if (isDone(id)) delete state.progress[id];
    else state.progress[id] = true;
    save();
    render();
  }

  function progressPercent() {
    const total = allLectures().length;
    if (!total) return 0;
    return Math.round(
      (allLectures().filter(x => isDone(x.id)).length / total) * 100
    );
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();

    return allLectures().filter(l => {
      const subjectOK =
        state.subject === "all" || l.subjectId === state.subject;

      const text =
        `${l.title} ${l.chapterName} ${l.subjectName}`.toLowerCase();

      return subjectOK && (!q || text.includes(q));
    });
  }

  function render() {
    const grid = document.getElementById("lectureGrid");
    const total = allLectures().length;
    const done = allLectures().filter(x => isDone(x.id)).length;

    document.getElementById("subjects").textContent = allSubjects.length;
    document.getElementById("chapters").textContent =
      allSubjects.reduce((n,s) => n + (s.chapters || []).length, 0);
    document.getElementById("lectures").textContent = total;
    document.getElementById("progress").textContent = progressPercent() + "%";

    const firstIncomplete = allLectures().find(x => !isDone(x.id));

    const continueBox = document.getElementById("continueBox");

    if (firstIncomplete) {
      continueBox.innerHTML = `
        <div class="continue-info">
          <small>CONTINUE LEARNING</small>
          <b>${firstIncomplete.title}</b>
          <span>${firstIncomplete.subjectName} • ${firstIncomplete.chapterName}</span>
        </div>
        <button data-continue="${firstIncomplete.id}">Continue →</button>
      `;
      continueBox.style.display = "flex";
    } else {
      continueBox.style.display = "none";
    }

    document.getElementById("subjectFilters").innerHTML =
      `<button class="${state.subject === "all" ? "active" : ""}" data-subject="all">All</button>` +
      allSubjects.map(s =>
        `<button class="${state.subject === s.id ? "active" : ""}" data-subject="${s.id}">
          ${s.icon} ${s.name}
        </button>`
      ).join("");

    const items = filtered();

    if (!items.length) {
      grid.innerHTML = `
        <article class="empty-card">
          <div class="empty-icon">🔎</div>
          <h3>No matching lectures</h3>
          <p>Try another subject or search term.</p>
        </article>`;
      return;
    }

    grid.innerHTML = items.map(l => `
      <article class="lecture-card ${isDone(l.id) ? "completed" : ""}">
        <div class="lecture-top">
          <span>${l.subjectIcon} ${l.subjectName}</span>
          <span>${isDone(l.id) ? "✓ Done" : "Ready"}</span>
        </div>
        <h3>${l.title}</h3>
        <p>${l.chapterName}</p>
        <div class="lecture-bottom">
          <span>Lecture • ${l.duration}</span>
          <button data-toggle="${l.id}">
            ${isDone(l.id) ? "Completed ✓" : "Mark Complete"}
          </button>
        </div>
      </article>
    `).join("");

    document.getElementById("status").textContent =
      `${done}/${total} completed`;
  }

  document.addEventListener("click", e => {
    const subject = e.target.closest("[data-subject]");
    if (subject) {
      state.subject = subject.dataset.subject;
      render();
      return;
    }

    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      toggleDone(toggle.dataset.toggle);
      return;
    }

    const cont = e.target.closest("[data-continue]");
    if (cont) {
      const lecture = allLectures().find(
        x => x.id === cont.dataset.continue
      );
      if (lecture) setCurrentLectureContext(lecture);
      const el = document.querySelector(
        `[data-toggle="${cont.dataset.continue}"]`
      );
      if (el) el.scrollIntoView({behavior:"smooth", block:"center"});
    }
  });

  document.addEventListener("input", e => {
    if (e.target.id === "lectureSearch") {
      state.query = e.target.value;
      render();
      const input = document.getElementById("lectureSearch");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  });

  render();
})();

(function setupLectureAIUI() {
  const btn = document.getElementById("aiExplainBtn");
  const input = document.getElementById("aiConcept");
  const result = document.getElementById("aiResult");

  if (!btn || !input || !result) return;

  btn.addEventListener("click", async function () {
    const topic = input.value.trim();

    if (!topic) {
      result.innerHTML =
        '<div class="ai-result-title">AI explanation</div>' +
        '<p>Enter a concept first.</p>';
      return;
    }

    btn.disabled = true;
    btn.textContent = "🤖 Thinking...";

    result.innerHTML =
      '<div class="ai-result-title">AI explanation</div>' +
      '<p>Preparing lecture context...</p>';

    const answer = await window.RankForgeLectureAI.explain(topic);

    result.innerHTML =
      '<div class="ai-result-title">' +
      (answer.source === "ai" ? "🤖 AI Explanation" : "🤖 AI Ready") +
      '</div>' +
      '<p>' +
      String(answer.explanation || "").replace(/</g, "&lt;") +
      '</p>';

    btn.disabled = false;
    btn.textContent = "🤖 Explain with AI";
  });
})();


(function setupLearningLoop() {
  const result = document.getElementById("loopResult");
  if (!result) return;

  const content = {
    ncert: {
      title: "📖 NCERT Key Points",
      text: "AI will extract the most relevant NCERT concepts, definitions, examples and high-value facts from the authorized lecture context."
    },
    trap: {
      title: "⚠️ Common Traps",
      text: "AI will identify likely conceptual confusions, misleading options and common NEET-style traps related to this concept."
    },
    practice: {
      title: "✍️ Practice",
      text: "The next layer will generate concept-linked practice questions and connect them with the existing RankForge practice system."
    },
    revision: {
      title: "🔄 Quick Revision",
      text: "Important concepts can be saved for later revision and eventually connected with weak-area and mistake tracking."
    }
  };

  document.addEventListener("click", function (e) {
    const card = e.target.closest("[data-loop]");
    if (!card) return;

    const item = content[card.dataset.loop];
    if (!item) return;

    result.innerHTML =
      '<b>' + item.title + '</b>' +
      '<p>' + item.text + '</p>';
  });
=======
  const data = window.RANKFORGE_LECTURE_DATA || { subjects: [] };

  const subjects = data.subjects || [];
  const chapters = subjects.flatMap(s => s.chapters || []);
  const lectures = chapters.flatMap(c => c.lectures || []);

  document.getElementById("subjects").textContent = subjects.length;
  document.getElementById("chapters").textContent = chapters.length;
  document.getElementById("lectures").textContent = lectures.length;

  const completed = lectures.filter(x => x.completed).length;
  const progress = lectures.length
    ? Math.round((completed / lectures.length) * 100)
    : 0;

  document.getElementById("progress").textContent = progress + "%";

  const grid = document.getElementById("lectureGrid");

  if (!lectures.length) {
    grid.innerHTML = `
      <article class="empty-card">
        <div class="empty-icon">▶</div>
        <h3>Lecture Module Ready</h3>
        <p>
          Lecture content will appear here when the module is connected
          to the authorized content source.
        </p>
        <span>Coming soon</span>
      </article>
    `;
  }

  document.getElementById("status").textContent = "Module ready";
>>>>>>> 6e3efad (Add RankForge Lecture Module foundation)
})();
