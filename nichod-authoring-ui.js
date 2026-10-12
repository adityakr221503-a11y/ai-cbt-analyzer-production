"use strict";

/*
=========================================================
 PCB NICHOD — AUTHORING EDITOR / APPROVAL UI v1
=========================================================
Candidate
   ↓
Authoring Draft
   ↓
Edit Question / Options / Answer / Explanation
   ↓
Quality Gate
   ↓
Manual Approve
   ↓
Verified Unseen Pool
=========================================================
*/

(function(){

  const DRAFT_KEY =
    "pcbNichodAuthoringDrafts";

  const VERIFIED_KEY =
    "pcbNichodVerifiedUnseenPool";

  function read(key, fallback){

    try{

      const value =
        JSON.parse(
          localStorage.getItem(key) || "null"
        );

      return value == null
        ? fallback
        : value;

    }catch(_){

      return fallback;

    }

  }

  function write(key,value){

    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

  }

  function clean(value){

    return String(value ?? "")
      .replace(/\s+/g," ")
      .trim();

  }

  function esc(value){

    return String(value ?? "")
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

  function getDrafts(){

    const drafts =
      read(DRAFT_KEY,[]);

    return Array.isArray(drafts)
      ? drafts
      : [];

  }

  function saveDrafts(drafts){

    write(
      DRAFT_KEY,
      drafts
    );

  }

  function render(){

    const root =
      document.getElementById(
        "nichodAuthoringEditor"
      );

    if(!root)
      return;

    const drafts =
      getDrafts()
        .filter(
          d =>
            d &&
            d.status !==
              "VERIFIED"
        );

    if(!drafts.length){

      root.innerHTML =
        `
        <div class="muted">
          No authoring drafts available.
        </div>
        `;

      return;

    }

    root.innerHTML =
      drafts.map(
        function(d,index){

          const options =
            Array.isArray(d.options)
              ? d.options
              : ["","","",""];

          return `
          <article
            data-draft="${index}"
            style="
              border:1px solid #ddd;
              border-radius:14px;
              padding:16px;
              margin:14px 0;
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:10px;
                flex-wrap:wrap;
              "
            >

              <strong>
                NICHOD Draft ${index+1}
              </strong>

              <span class="muted">
                ${esc(d.subject || "PCB")}
                ·
                ${esc(
                  d.authoringType ||
                  "MCQ"
                )}
              </span>

            </div>

            <div style="margin-top:12px">

              <label>
                <b>Question</b>
              </label>

              <textarea
                data-field="question"
                rows="5"
                style="
                  width:100%;
                  margin-top:6px;
                "
              >${esc(
                d.question || ""
              )}</textarea>

            </div>

            <div
              style="
                display:grid;
                gap:8px;
                margin-top:12px;
              "
            >

              ${options.map(
                function(option,i){

                  return `
                  <input
                    data-field="option"
                    data-option="${i}"
                    value="${esc(option)}"
                    placeholder="Option ${
                      String.fromCharCode(
                        65+i
                      )
                    }"
                  >
                  `;

                }
              ).join("")}

            </div>

            <div style="margin-top:12px">

              <label>
                <b>Correct Answer</b>
              </label>

              <select
                data-field="answer"
                style="
                  width:100%;
                  margin-top:6px;
                "
              >

                <option value="">
                  Select answer
                </option>

                <option value="a">A</option>
                <option value="b">B</option>
                <option value="c">C</option>
                <option value="d">D</option>

              </select>

            </div>

            <div style="margin-top:12px">

              <label>
                <b>Explanation</b>
              </label>

              <textarea
                data-field="explanation"
                rows="5"
                style="
                  width:100%;
                  margin-top:6px;
                "
              >${esc(
                d.explanation || ""
              )}</textarea>

            </div>

            <details
              style="margin-top:12px"
            >

              <summary>
                NICHOD Evidence
              </summary>

              <div
                class="muted"
                style="margin-top:8px"
              >

                <div>
                  Chapter:
                  ${esc(d.chapter)}
                </div>

                <div>
                  Topic:
                  ${esc(d.topic)}
                </div>

                <div>
                  Source:
                  ${esc(
                    d.sourceQuestion ||
                    "NICHOD"
                  )}
                </div>

                <div>
                  Variation:
                  ${esc(
                    d.variationStrategy
                  )}
                </div>

              </div>

            </details>

            <div
              data-role="message"
              class="muted"
              style="margin-top:10px"
            ></div>

            <div
              style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                margin-top:12px;
              "
            >

              <button
                type="button"
                data-action="save"
              >
                💾 Save Draft
              </button>

              <button
                type="button"
                data-action="approve"
              >
                ✅ Approve & Verify
              </button>

              <button
                type="button"
                data-action="reject"
              >
                ❌ Reject
              </button>

            </div>

          </article>
          `;

        }
      ).join("");

    drafts.forEach(
      function(d,index){

        const card =
          root.querySelector(
            '[data-draft="' +
            index +
            '"]'
          );

        if(!card)
          return;

        const answer =
          card.querySelector(
            '[data-field="answer"]'
          );

        if(answer){

          answer.value =
            clean(
              d.answer ||
              d.correctAnswer
            ).toLowerCase();

        }

      }
    );

  }

  function collect(card,draft){

    const question =
      card.querySelector(
        '[data-field="question"]'
      );

    const explanation =
      card.querySelector(
        '[data-field="explanation"]'
      );

    const answer =
      card.querySelector(
        '[data-field="answer"]'
      );

    const options =
      [0,1,2,3].map(
        function(i){

          const el =
            card.querySelector(
              '[data-field="option"][data-option="' +
              i +
              '"]'
            );

          return clean(
            el ? el.value : ""
          );

        }
      );

    return Object.assign(
      {},
      draft,
      {
        question:
          clean(
            question?.value
          ),

        options,

        answer:
          clean(
            answer?.value
          ).toLowerCase(),

        explanation:
          clean(
            explanation?.value
          )
      }
    );

  }

  function gate(draft){

    const errors = [];

    if(
      !clean(draft.question)
    )
      errors.push(
        "Question is empty."
      );

    if(
      !Array.isArray(
        draft.options
      ) ||
      draft.options.length !== 4
    )
      errors.push(
        "Exactly 4 options are required."
      );

    const options =
      Array.isArray(draft.options)
        ? draft.options.map(clean)
        : [];

    if(
      options.some(
        x => !x
      )
    )
      errors.push(
        "All 4 options are required."
      );

    if(
      new Set(
        options.map(
          x => x.toLowerCase()
        )
      ).size !== 4
    )
      errors.push(
        "Options must be distinct."
      );

    if(
      !["a","b","c","d"]
        .includes(
          draft.answer
        )
    )
      errors.push(
        "Select A, B, C or D."
      );

    if(
      !clean(
        draft.explanation
      )
    )
      errors.push(
        "Explanation is required."
      );

    return {
      valid:
        errors.length === 0,
      errors
    };

  }

  function save(index){

    const drafts =
      getDrafts();

    const draft =
      drafts[index];

    if(!draft)
      return;

    const card =
      document.querySelector(
        '[data-draft="' +
        index +
        '"]'
      );

    if(!card)
      return;

    drafts[index] =
      collect(
        card,
        draft
      );

    drafts[index].status =
      "DRAFT";

    saveDrafts(
      drafts
    );

    show(
      card,
      "Draft saved."
    );

  }

  function approve(index){

    const drafts =
      getDrafts();

    const draft =
      drafts[index];

    if(!draft)
      return;

    const card =
      document.querySelector(
        '[data-draft="' +
        index +
        '"]'
      );

    if(!card)
      return;

    const updated =
      collect(
        card,
        draft
      );

    const result =
      gate(updated);

    if(!result.valid){

      show(
        card,
        result.errors.join(
          " "
        )
      );

      return;

    }

    /*
     * Manual approval happens here.
     */

    const verified =
      Object.assign(
        {},
        updated,
        {
          verified:true,
          unseen:true,
          status:"VERIFIED",
          verifiedAt:
            new Date()
              .toISOString()
        }
      );

    const pool =
      read(
        VERIFIED_KEY,
        []
      );

    const verifiedPool =
      Array.isArray(pool)
        ? pool
        : [];

    verifiedPool.push(
      verified
    );

    write(
      VERIFIED_KEY,
      verifiedPool
    );

    drafts.splice(
      index,
      1
    );

    saveDrafts(
      drafts
    );

    render();

  }

  function reject(index){

    const drafts =
      getDrafts();

    if(!drafts[index])
      return;

    drafts[index].status =
      "REJECTED";

    drafts[index].rejectedAt =
      new Date()
        .toISOString();

    saveDrafts(
      drafts
    );

    render();

  }

  function show(card,message){

    const box =
      card.querySelector(
        '[data-role="message"]'
      );

    if(box)
      box.textContent =
        message;

  }

  function bind(){

    const root =
      document.getElementById(
        "nichodAuthoringEditor"
      );

    if(!root)
      return;

    root.addEventListener(
      "click",
      function(e){

        const button =
          e.target.closest(
            "button[data-action]"
          );

        if(!button)
          return;

        const card =
          button.closest(
            "[data-draft]"
          );

        if(!card)
          return;

        const index =
          Number(
            card.dataset.draft
          );

        const action =
          button.dataset.action;

        if(
          action === "save"
        )
          save(index);

        if(
          action === "approve"
        )
          approve(index);

        if(
          action === "reject"
        )
          reject(index);

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

  window.PCBNICHODAuthoringUI = {

    render,
    save,
    approve,
    reject

  };

})();
