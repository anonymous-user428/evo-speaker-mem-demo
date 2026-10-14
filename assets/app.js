const state = {
  scenarioId: "clean",
  selectedTurnIndex: 0,
  policyId: "gated"
};

const policyIds = [
  "fixed",
  "update",
  "gated",
  "knn",
  "parakeet-fixed",
  "parakeet-update",
  "parakeet-gated",
  "parakeet-knn"
];

const entityColors = ["#087e8b", "#2b5c91", "#d86f2b", "#2b7a57", "#8a5a44", "#7867a6"];

const dom = {
  tabs: document.querySelectorAll(".scenario-tab"),
  kicker: document.querySelector("#scenario-kicker"),
  title: document.querySelector("#scenario-title"),
  protocol: document.querySelector("#scenario-protocol"),
  scopeSelection: document.querySelector("#scope-selection"),
  scopeSource: document.querySelector("#scope-source"),
  scopeEvidence: document.querySelector("#scope-evidence"),
  turnCount: document.querySelector("#turn-count"),
  turnList: document.querySelector("#turn-list"),
  entityList: document.querySelector("#entity-list"),
  focusContent: document.querySelector("#focus-content"),
  policyControl: document.querySelector("#policy-control"),
  policyResult: document.querySelector("#policy-result"),
  queryLabel: document.querySelector("#query-label"),
  queryRequester: document.querySelector("#query-requester"),
  queryText: document.querySelector("#query-text"),
  queryAudio: document.querySelector("#query-audio"),
  accessNote: document.querySelector("#access-note"),
  authorizationCard: document.querySelector("#authorization-card"),
  authorizationState: document.querySelector("#authorization-state"),
  authorizationCopy: document.querySelector("#authorization-copy"),
  evidenceText: document.querySelector("#evidence-text"),
  answerText: document.querySelector("#answer-text"),
  jumpQuery: document.querySelector("#jump-query")
};

let scenarios = {};

function icon(name) {
  return `<i data-lucide="${name}" aria-hidden="true"></i>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getScenario() {
  return scenarios[state.scenarioId];
}

function getPolicy(scenario) {
  const policies = scenario.policyTraces || {};
  const selected = policies[state.policyId];
  if (selected) return selected;

  const [fallback] = Object.values(policies);
  state.policyId = fallback?.id || "";
  return fallback;
}

function formatScore(value) {
  return typeof value === "number" ? value.toFixed(3) : "—";
}

function stopActiveAudio() {
  document.querySelectorAll("audio").forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

function policyDescription(id) {
  const descriptions = {
    fixed: "The first accepted voiceprint remains the entity representation.",
    update: "Every accepted link updates the entity center.",
    gated: "An accepted link updates the center only when its confidence clears the update gate.",
    knn: "The entity retains accepted historical voiceprint exemplars for top-k matching.",
    "parakeet-fixed": "Session-local Parakeet groups are associated with a fixed global ECAPA representation.",
    "parakeet-update": "Session-local Parakeet groups are associated while each accepted link updates the global center.",
    "parakeet-gated": "Session-local Parakeet groups are associated with confidence-gated global center updates.",
    "parakeet-knn": "Session-local Parakeet groups are associated with global multi-exemplar ECAPA matching."
  };
  return descriptions[id] || "Precomputed routing, retrieval, and evaluation result.";
}

function renderScenarioHeader(scenario, policy) {
  dom.kicker.textContent = scenario.kicker;
  dom.title.textContent = scenario.title;
  dom.protocol.textContent = scenario.protocol;
  dom.turnCount.textContent = `${policy.turns.length} shown turns`;

  dom.tabs.forEach((tab) => {
    const active = tab.dataset.scenario === state.scenarioId;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
}

function renderScope(scenario) {
  dom.scopeSelection.textContent = scenario.selection;
  dom.scopeSource.textContent = scenario.source;
  dom.scopeEvidence.textContent = scenario.evidenceScope;
}

function renderPolicy(scenario, policy) {
  const policies = scenario.policyTraces || {};
  dom.policyControl.innerHTML = policyIds
    .filter((id) => policies[id])
    .map((id) => {
      const candidate = policies[id];
      const active = id === policy.id;
      return `<button class="policy-tab ${active ? "is-active" : ""}" type="button" role="tab" data-policy-id="${id}" aria-selected="${active}" tabindex="${active ? "0" : "-1"}">${escapeHtml(candidate.label)}</button>`;
    })
    .join("");

  dom.policyControl.querySelectorAll("[data-policy-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activatePolicy(button.dataset.policyId);
    });
  });

  dom.policyResult.innerHTML = `
    <div class="policy-summary">
      <p class="card-label">${escapeHtml(policy.label)}</p>
      <p>${escapeHtml(policyDescription(policy.id))}</p>
    </div>
    <div class="metric-cell"><p>Local entities</p><p>${escapeHtml(policy.entityCount)}</p></div>
    <div class="metric-cell"><p>Entity structure</p><p>${escapeHtml(policy.metrics.structure)}</p></div>
    <div class="metric-cell"><p>Private access</p><p>${escapeHtml(policy.metrics.access)}</p></div>
    <div class="metric-cell"><p>Gated QA</p><p>${escapeHtml(policy.metrics.qa)}</p></div>`;
}

function activatePolicy(policyId) {
  stopActiveAudio();
  state.policyId = policyId;
  state.selectedTurnIndex = 0;
  render();
}

function movePolicyFocus(button, key) {
  const buttons = Array.from(dom.policyControl.querySelectorAll("[data-policy-id]"));
  const currentIndex = buttons.indexOf(button);
  const nextIndex = key === "Home"
    ? 0
    : key === "End"
      ? buttons.length - 1
      : (currentIndex + (key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  const nextButton = buttons[nextIndex];
  activatePolicy(nextButton.dataset.policyId);
  dom.policyControl.querySelector(`[data-policy-id="${state.policyId}"]`)?.focus();
}

function renderTurns(policy) {
  dom.turnList.innerHTML = policy.turns.map((turn, index) => {
    const selected = index === state.selectedTurnIndex;
    const stream = turn.stream ? `<span class="stream-label">${escapeHtml(turn.stream)}</span>` : "";
    return `
      <button class="turn-row ${selected ? "is-selected" : ""}" type="button" data-turn-index="${index}" role="listitem">
        <span class="turn-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="turn-main">
          <span class="turn-meta">
            <span class="session-label">${escapeHtml(turn.session)}</span>
            ${stream}
            <span class="route-label ${escapeHtml(turn.action)}">${escapeHtml(turn.action.toUpperCase())}</span>
          </span>
          <span class="turn-text">${escapeHtml(turn.text)}</span>
        </span>
        <span class="turn-target">${escapeHtml(turn.entity)}</span>
      </button>`;
  }).join("");

  dom.turnList.querySelectorAll("[data-turn-index]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedTurnIndex = Number(row.dataset.turnIndex);
      render();
    });
  });
}

function renderEntities(policy) {
  const activeTurn = policy.turns[state.selectedTurnIndex];
  const occurrenceCounts = policy.turns.reduce((counts, turn) => {
    counts[turn.entity] = (counts[turn.entity] || 0) + 1;
    return counts;
  }, {});

  dom.entityList.innerHTML = policy.entities.map((entity, index) => {
    const count = occurrenceCounts[entity.label] || 0;
    const focused = entity.label === activeTurn.entity;
    return `
      <article class="entity-item ${focused ? "is-focused" : ""}" style="--entity-color:${entityColors[index % entityColors.length]}">
        <span class="entity-avatar">${escapeHtml(entity.label)}</span>
        <span>
          <strong>${escapeHtml(entity.label)}</strong>
          <small>${count} shown routed ${count === 1 ? "turn" : "turns"}</small>
        </span>
      </article>`;
  }).join("");
}

function renderFocus(policy) {
  const turn = policy.turns[state.selectedTurnIndex];
  const writeAction = turn.action === "create"
    ? "A new local entity is initialized for this observation."
    : "The observation is linked to an existing local entity.";
  const audio = turn.audio
    ? `<audio class="focus-audio" controls preload="metadata" src="${escapeHtml(turn.audio)}"></audio>`
    : "";
  dom.focusContent.innerHTML = `
    <span class="route-label ${escapeHtml(turn.action)}">${escapeHtml(turn.action.toUpperCase())} → ${escapeHtml(turn.entity)}</span>
    ${audio}
    <div class="route-detail-grid" aria-label="Routing detail">
      <span><b>Similarity</b>${formatScore(turn.similarity)}</span>
      <span><b>Margin</b>${formatScore(turn.margin)}</span>
      <span><b>State</b>${escapeHtml(turn.stateAction)}</span>
    </div>
    <p class="focus-copy"><strong>${escapeHtml(turn.id)}:</strong> ${writeAction}</p>`;
}

function renderAccess(scenario, policy) {
  const query = policy.query;
  const isAuthorized = query.assigned === true;
  const stateLabel = isAuthorized ? `Access authorized · ${query.entity}` : "Access withheld";
  const routeLabel = isAuthorized ? `Assigned ${query.entity}` : "No entity assigned";
  const authorizationCopy = isAuthorized
    ? `The query is routed to ${query.entity} with similarity ${formatScore(query.similarity)} and margin ${formatScore(query.margin)}. Retrieval is limited to that policy-local memory partition.`
    : `The highest routing similarity is ${formatScore(query.similarity)} with margin ${formatScore(query.margin)}, so this policy withholds personal-memory retrieval.`;
  const judge = query.judge === 1 ? "Judge: correct" : query.judge === 0 ? "Judge: incorrect" : "No answer judged";

  dom.queryLabel.innerHTML = `${icon(query.audio ? "mic" : "file-text")}<span>${query.audio ? "Spoken query" : "Query"}</span>`;
  dom.queryRequester.textContent = routeLabel;
  dom.queryText.textContent = `“${query.text}”`;
  dom.queryAudio.hidden = !query.audio;
  if (query.audio) {
    dom.queryAudio.src = query.audio;
  } else {
    dom.queryAudio.removeAttribute("src");
  }
  dom.accessNote.textContent = scenario.queryNote;
  dom.authorizationCard.classList.toggle("authorization-card--safe", isAuthorized);
  dom.authorizationCard.classList.toggle("authorization-card--withheld", !isAuthorized);
  dom.authorizationState.innerHTML = `${icon(isAuthorized ? "shield-check" : "shield-off")}<span>${escapeHtml(stateLabel)}</span>`;
  dom.authorizationCopy.textContent = authorizationCopy;
  dom.evidenceText.textContent = query.evidence;
  dom.answerText.innerHTML = `<span class="answer-judge ${query.judge === 0 ? "is-incorrect" : ""}">${escapeHtml(judge)}</span>${escapeHtml(query.answer)}`;
}

function render() {
  const scenario = getScenario();
  const policy = getPolicy(scenario);
  state.selectedTurnIndex = Math.min(state.selectedTurnIndex, policy.turns.length - 1);
  renderScenarioHeader(scenario, policy);
  renderScope(scenario);
  renderPolicy(scenario, policy);
  renderTurns(policy);
  renderEntities(policy);
  renderFocus(policy);
  renderAccess(scenario, policy);
  if (window.lucide) window.lucide.createIcons();
}

function activateScenario(scenarioId) {
  stopActiveAudio();
  state.scenarioId = scenarioId;
  state.selectedTurnIndex = 0;
  state.policyId = "gated";
  render();
}

async function initialize() {
  const response = await fetch("data/demo-data.json");
  if (!response.ok) {
    throw new Error(`Unable to load demo data (${response.status}).`);
  }
  scenarios = await response.json();
  dom.policyControl.addEventListener("keydown", (event) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    const button = event.target.closest("[data-policy-id]");
    if (!button || !keys.includes(event.key)) return;
    event.preventDefault();
    movePolicyFocus(button, event.key);
  });
  dom.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateScenario(tab.dataset.scenario);
    });
    tab.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const tabs = Array.from(dom.tabs);
      const currentIndex = tabs.indexOf(tab);
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      activateScenario(tabs[nextIndex].dataset.scenario);
    });
  });
  dom.jumpQuery.addEventListener("click", () => {
    document.querySelector("#query-access").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  render();
}

initialize().catch((error) => {
  document.querySelector(".page-shell").innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`;
});
