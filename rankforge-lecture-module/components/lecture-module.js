(function () {
  "use strict";

  const DATA = window.RANKFORGE_LECTURE_DATA || {subjects:[]};
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