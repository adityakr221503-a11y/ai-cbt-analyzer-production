const RANKER_REVISION = {
  biology: typeof RANKER_BIOLOGY_REVISION !== "undefined"
    ? RANKER_BIOLOGY_REVISION : [],

  physics: typeof RANKER_PHYSICS_REVISION !== "undefined"
    ? RANKER_PHYSICS_REVISION : [],

  chemistry: typeof RANKER_CHEMISTRY_REVISION !== "undefined"
    ? RANKER_CHEMISTRY_REVISION : []
};

function openSubject(subject) {
  window.location.href = `./${subject}/index.html`;
}

function updateRevisionCounts() {
  const counts = {
    biology: RANKER_REVISION.biology.length,
    physics: RANKER_REVISION.physics.length,
    chemistry: RANKER_REVISION.chemistry.length
  };

  document.getElementById("biologyCount").textContent =
    `${counts.biology} revision cards`;

  document.getElementById("physicsCount").textContent =
    `${counts.physics} revision cards`;

  document.getElementById("chemistryCount").textContent =
    `${counts.chemistry} revision cards`;
}

if (typeof window !== "undefined") {
  window.RANKER_REVISION = RANKER_REVISION;
  window.openSubject = openSubject;
}

if (typeof document !== "undefined") {
  updateRevisionCounts();
}
