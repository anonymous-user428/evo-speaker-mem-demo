const state = {
  scenarioId: "clean",
  selectedTurnIndex: 0,
  policyId: "gated"
};

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
  policyPanel: document.querySelector("#policy-panel"),
  policyControl: document.querySelector("#policy-control"),
  policyResult: document.querySelector("#policy-result"),
  queryRequester: document.querySelector("#query-requester"),
  queryText: document.querySelector("#query-text"),
  queryAudio: document.querySelector("#query-audio"),
  queryAudioNote: document.querySelector("#query-audio-note"),
  accessNote: document.querySelector("#access-note"),
  authorizationCard: document.querySelector("#authorization-card"),
  authorizationState: document.querySelector("#authorization-state"),
  authorizationCopy: document.querySelector("#authorization-copy"),
  evidenceText: document.querySelector("#evidence-text"),
  answerText: document.querySelector("#answer-text"),
  counterfactualControl: document.querySelector("#counterfactual-control"),
  jumpQuery: document.querySelector("#jump-query")
};

let scenarios = {};

function icon(name) {
  return `<i data-lucide="${name}" aria-hidden="true"></i>`;
}

function getScenario() {
  const scenario = scenarios[state.scenarioId];
  const policies = Object.values(scenario.policyTraces);
  const policy = scenario.policyTraces[state.policyId] || policies[0];
  if (!policy) throw new Error("No routing policies are available for this scenario.");
  state.policyId = policy.id;
  state.selectedTurnIndex = Math.min(state.selectedTurnIndex, policy.turns.length - 1);
  return { ...scenario, ...policy, policies };
}

function formatScore(value) {
  return typeof value === "number" ? value.toFixed(3) : "Not recorded";
}

function stopActiveAudio() {
  document.querySelectorAll("audio").forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

function renderScenarioHeader(scenario) {
  dom.kicker.textContent = scenario.kicker;
  dom.title.textContent = scenario.title;
  dom.protocol.textContent = scenario.protocol;
  dom.turnCount.textContent = `${scenario.turns.length} shown turns`;

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

function renderTurns(scenario) {
  dom.turnList.innerHTML = scenario.turns.map((turn, index) => {
    const selected = index === state.selectedTurnIndex;
    const stream = turn.stream ? `<span class="stream-label">${turn.stream}</span>` : "";
    return `
      <button class="turn-row ${selected ? "is-selected" : ""}" type="button" data-turn-index="${index}" role="listitem">
        <span class="turn-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="turn-main">
          <span class="turn-meta">
            <span class="session-label">${turn.session}</span>
            ${stream}
            <span class="route-label ${turn.action}">${turn.action.toUpperCase()}</span>
          </span>
          <span class="turn-text">${turn.text}</span>
        </span>
        <span class="turn-target">${turn.entity}</span>
      </button>`;
  }).join("");

  dom.turnList.querySelectorAll("[data-turn-index]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedTurnIndex = Number(row.dataset.turnIndex);
      render();
    });
  });
}

function renderEntities(scenario) {
  const activeTurn = scenario.turns[state.selectedTurnIndex];
  const colors = ["#3158d7", "#15806c", "#a66c12", "#9754bd"];
  dom.entityList.innerHTML = scenario.entities.map((entity, index) => `
    <article class="entity-item ${entity.label === activeTurn.entity ? "is-focused" : ""}" style="--entity-color:${colors[index % colors.length]}">
      <span class="entity-avatar">${entity.label}</span>
      <span>
        <strong>${entity.label}</strong>
        <small>${entity.id}</small>
      </span>
    </article>`).join("");
}

function renderFocus(scenario) {
  const turn = scenario.turns[state.selectedTurnIndex];
  const writeAction = turn.action === "create"
    ? "The recorded route initializes a new local entity."
    : "The recorded route links the observation to an existing local entity.";
  const audio = turn.audio
    ? `<audio class="focus-audio" controls preload="metadata" src="${turn.audio}"></audio>`
    : '<p class="source-note">Audio is not included for this recorded turn.</p>';
  dom.focusContent.innerHTML = `
    <span class="route-label ${turn.action}">${turn.action.toUpperCase()} → ${turn.entity}</span>
    ${audio}
    <p class="focus-copy"><strong>${turn.id}:</strong> ${writeAction} ${turn.stateAction || ""}</p>
    <p class="source-note">Similarity: ${formatScore(turn.similarity)} · Margin: ${formatScore(turn.margin)}</p>`;
}

function renderPolicy(scenario) {
  dom.policyPanel.hidden = scenario.policies.length === 0;
  const selected = scenario.policies.find((policy) => policy.id === state.policyId);
  dom.policyControl.innerHTML = scenario.policies.map((policy) => `
    <button class="${policy.id === selected.id ? "is-active" : ""}" type="button" aria-pressed="${policy.id === selected.id}" data-policy-id="${policy.id}">${policy.label}</button>`).join("");
  dom.policyResult.innerHTML = `
    <div class="policy-summary">
      <p class="card-label">${selected.label}</p>
      <p>${selected.entityCount} local entities in the recorded history.</p>
    </div>
    <div class="metric-cell"><p>Entity structure</p><p>${selected.metrics.structure}</p></div>
    <div class="metric-cell"><p>Private access</p><p>${selected.metrics.access}</p></div>
    <div class="metric-cell"><p>End-to-end utility</p><p>${selected.metrics.qa}</p></div>`;

  dom.policyControl.querySelectorAll("[data-policy-id]").forEach((button) => {
    button.addEventListener("click", () => {
      stopActiveAudio();
      state.policyId = button.dataset.policyId;
      render();
    });
  });
}

function renderAccess(scenario) {
  const query = scenario.query;
  dom.queryRequester.textContent = query.assigned ? `Linked to ${query.entity}` : "Unverified speaker";
  dom.queryText.textContent = `“${query.text}”`;
  if (query.audio) {
    if (dom.queryAudio.getAttribute("src") !== query.audio) dom.queryAudio.src = query.audio;
  } else {
    dom.queryAudio.removeAttribute("src");
  }
  dom.queryAudio.hidden = !query.audio;
  dom.queryAudioNote.hidden = Boolean(query.audio);
  dom.accessNote.textContent = scenario.queryNote;
  dom.authorizationCard.classList.toggle("authorization-card--safe", query.assigned);
  dom.authorizationCard.classList.remove("authorization-card--risk");
  dom.authorizationState.innerHTML = `${icon(query.assigned ? "fingerprint" : "shield-alert")}<span>${query.assigned ? `Linked → ${query.entity}` : "Access withheld"}</span>`;
  dom.authorizationCopy.textContent = `${query.assigned ? "The recorded query route permits retrieval from this local entity." : "The query speaker was not verified, so personal memory retrieval is withheld."} Similarity: ${formatScore(query.similarity)}; margin: ${formatScore(query.margin)}.`;
  dom.evidenceText.textContent = query.evidence;
  dom.answerText.textContent = query.answer;
  dom.counterfactualControl.hidden = true;
}

function render() {
  const scenario = getScenario();
  renderScenarioHeader(scenario);
  renderScope(scenario);
  renderTurns(scenario);
  renderEntities(scenario);
  renderFocus(scenario);
  renderPolicy(scenario);
  renderAccess(scenario);
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
  if (window.location.protocol === "file:") {
    throw new Error("Open this demo through its GitHub Pages URL, or run python3 -m http.server 8000 in the demo folder and visit http://localhost:8000. Browsers block local JSON loading when index.html is opened directly.");
  }
  const response = await fetch("data/demo-data.json");
  if (!response.ok) {
    throw new Error(`Unable to load demo data (${response.status}).`);
  }
  scenarios = await response.json();

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
  const message = document.createElement("p");
  message.className = "error-state";
  message.setAttribute("role", "alert");
  message.textContent = `Unable to start the demo. ${error.message}`;
  document.querySelector(".page-shell").replaceChildren(message);
});

// Icons are optional: data and interactions also work if the CDN is unavailable.
document.querySelector("#lucide-script").addEventListener("load", () => {
  if (window.lucide) window.lucide.createIcons();
});
