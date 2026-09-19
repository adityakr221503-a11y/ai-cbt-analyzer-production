(function () {
  "use strict";

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
})();
