"use strict";

/*
=========================================================
 PCB NICHOD — UNSEEN REVIEW / VERIFICATION UI
=========================================================
*/

(function(){

  function read(key, fallback){

    try{
      const x =
        JSON.parse(
          localStorage.getItem(key) || "null"
        );

      return x == null ? fallback : x;

    }catch(_){
      return fallback;
    }
  }

  function write(key, value){

    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

  }

  function clean(v){

    return String(v ?? "")
      .replace(/\s+/g," ")
      .trim();

  }

  function esc(v){

    return String(v ?? "")
      .replace(/[&<>"']/g,function(m){

        return ({
          "&":"&amp;",
          "<":"&lt;",
          ">":"&gt;",
          '"':"&quot;",
          "'":"&#39;"

        })[m];

      });

  }

  function render(){

    const root =
      document.getElementById(
        "nichodReviewList"
      );

    if(!root)
      return;

    const list =
      read(
        "pcbNichodUnseenCandidates",
        []
      );

    if(!Array.isArray(list) || !list.length){

      root.innerHTML =
        '<p class="muted">No unseen candidates yet.</p>';

      return;

    }

    root.innerHTML =
      list.map(function(q,index){

        const generated =
          q.question ||
          "";

        const options =
          Array.isArray(q.options)
            ? q.options
            : [];

        return `
        <article
          style="
            border:1px solid #ddd;
            border-radius:12px;
            padding:14px;
            margin:12px 0;
          "
        >

          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:10px;
            "
          >

            <b>
              Candidate ${index + 1}
            </b>

            <span class="muted">
              ${esc(q.subject || "Unknown")}
              ·
              ${esc(
                q.variationStrategy ||
                "variation"
              )}
            </span>

          </div>

          <div
            style="margin-top:10px;"
          >

            <label>
              <b>Question</b>
            </label>

            <textarea
              data-field="question"
              data-index="${index}"
              rows="4"
              style="width:100%;margin-top:5px;"
            >${esc(generated)}</textarea>

          </div>

          <div
            style="
              display:grid;
              gap:7px;
              margin-top:10px;
            "
          >

            ${[0,1,2,3].map(function(i){

              return `
              <input
                data-field="option"
                data-option="${i}"
                data-index="${index}"
                value="${esc(options[i] || "")}"
                placeholder="Option ${String.fromCharCode(65+i)}"
              >
              `;

            }).join("")}

          </div>

          <div
            style="margin-top:10px;"
          >

            <label>
              <b>Correct Answer</b>
            </label>

            <select
              data-field="answer"
              data-index="${index}"
              style="width:100%;margin-top:5px;"
            >

              <option value="">Select</option>
              <option value="a">A</option>
              <option value="b">B</option>
              <option value="c">C</option>
              <option value="d">D</option>

            </select>

          </div>

          <div
            style="margin-top:10px;"
          >

            <label>
              <b>Explanation</b>
            </label>

            <textarea
              data-field="explanation"
              data-index="${index}"
              rows="4"
              style="width:100%;margin-top:5px;"
            >${esc(
              q.explanation || ""
            )}</textarea>

          </div>

          <div
            style="
              display:flex;
              gap:8px;
              margin-top:12px;
              flex-wrap:wrap;
            "
          >

            <button
              type="button"
              data-action="verify"
              data-index="${index}"
            >
              ✅ Verify & Promote
            </button>

            <button
              type="button"
              data-action="remove"
              data-index="${index}"
            >
              🗑 Remove
            </button>

          </div>

          <div
            class="muted"
            style="margin-top:8px;"
          >
            Source:
            ${esc(
              q.generatedFromFamily ||
              q.generatedFrom ||
              "NICHOD"
            )}
          </div>

        </article>
        `;

      }).join("");

    list.forEach(function(q,index){

      const select =
        root.querySelector(
          '[data-field="answer"][data-index="' +
          index +
          '"]'
        );

      if(select)
        select.value =
          clean(
            q.answer ||
            q.correctAnswer
          ).toLowerCase();

    });

  }

  function collect(index){

    const root =
      document.getElementById(
        "nichodReviewList"
      );

    const question =
      root.querySelector(
        '[data-field="question"][data-index="' +
        index +
        '"]'
      );

    const explanation =
      root.querySelector(
        '[data-field="explanation"][data-index="' +
        index +
        '"]'
      );

    const answer =
      root.querySelector(
        '[data-field="answer"][data-index="' +
        index +
        '"]'
      );

    const options =
      [0,1,2,3].map(function(i){

        const el =
          root.querySelector(
            '[data-field="option"][data-option="' +
            i +
            '"][data-index="' +
            index +
            '"]'
          );

        return clean(
          el ? el.value : ""
        );

      });

    return {

      question:
        clean(
          question
            ? question.value
            : ""
        ),

      options,

      answer:
        clean(
          answer
            ? answer.value
            : ""
        ),

      explanation:
        clean(
          explanation
            ? explanation.value
            : ""
        ),

      verified:
        true,

      unseen:
        true

    };

  }

  function verify(index){

    const list =
      read(
        "pcbNichodUnseenCandidates",
        []
      );

    if(!Array.isArray(list))
      return;

    const candidate =
      list[index];

    if(!candidate)
      return;

    const data =
      collect(index);

    if(!data.question){

      alert(
        "Question is required."
      );

      return;

    }

    if(
      data.options.length !== 4 ||
      data.options.some(
        x => !x
      )
    ){

      alert(
        "All 4 options are required."
      );

      return;

    }

    if(
      !["a","b","c","d"]
        .includes(
          data.answer
        )
    ){

      alert(
        "Select the correct answer."
      );

      return;

    }

    if(!data.explanation){

      alert(
        "Explanation is required."
      );

      return;

    }

    /*
     * Delegate strict validation to
     * generation bridge.
     */

    if(
      !window.PCBNICHODGeneration
    ){

      alert(
        "NICHOD generation bridge is not loaded."
      );

      return;

    }

    const result =
      window.PCBNICHODGeneration.promote(
        candidate.id,
        data
      );

    if(!result.ok){

      alert(
        "Not promoted:\n" +
        (
          result.errors ||
          [result.reason || "validation failed"]
        ).join("\n")
      );

      return;

    }

    render();

    if(
      window.PCBNICHODUnseen
    )
      window.PCBNICHODUnseen;

  }

  function remove(index){

    const list =
      read(
        "pcbNichodUnseenCandidates",
        []
      );

    if(!Array.isArray(list))
      return;

    list.splice(
      index,
      1
    );

    write(
      "pcbNichodUnseenCandidates",
      list
    );

    render();

  }

  function bind(){

    const root =
      document.getElementById(
        "nichodReviewList"
      );

    if(!root)
      return;

    root.addEventListener(
      "click",
      function(e){

        const btn =
          e.target.closest(
            "button[data-action]"
          );

        if(!btn)
          return;

        const index =
          Number(
            btn.dataset.index
          );

        if(
          btn.dataset.action ===
          "verify"
        )
          verify(index);

        if(
          btn.dataset.action ===
          "remove"
        )
          remove(index);

      }
    );

    render();

  }

  function boot(){

    bind();

  }

  if(
    document.readyState ===
    "loading"
  ){

    document.addEventListener(
      "DOMContentLoaded",
      boot
    );

  }else{

    boot();

  }

  window.PCBNICHODReview = {

    render,
    verify,
    remove

  };

})();
