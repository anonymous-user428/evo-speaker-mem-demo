const state = {
  scenarioId: "clean",
  selectedTurnIndex: 0,
  policyId: "gated",
  counterfactualId: "original"
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
  accessNote: document.querySelector("#access-note"),
  authorizationCard: document.querySelector("#authorization-card"),
  authorizationState: document.querySelector("#authorization-state"),
  authorizationCopy: document.querySelector("#authorization-copy"),
  evidenceText: document.querySelector("#evidence-text"),
  answerText: document.querySelector("#answer-text"),
  counterfactualControl: document.querySelector("#counterfactual-control"),
  counterfactualOptions: document.querySelector("#counterfactual-options"),
  jumpQuery: document.querySelector("#jump-query")
};

let scenarios = {};

function icon(name) {
  return `<i data-lucide="${name}" aria-hidden="true"></i>`;
}

function getScenario() {
  return scenarios[state.scenarioId];
}

function getAccessView(scenario) {
  if (!scenario.counterfactuals) {
    return scenario.query;
  }

  const counterfactual = scenario.counterfactuals.find((item) => item.id === state.counterfactualId)
    || scenario.counterfactuals[0];
  return {
    ...scenario.query,
    ...counterfactual
  };
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
  dom.entityList.innerHTML = scenario.entities.map((entity) => `
    <article class="entity-item ${entity.id === activeTurn.entity ? "is-focused" : ""}" style="--entity-color:${entity.color}">
      <span class="entity-avatar">${entity.id}</span>
      <span>
        <strong>${entity.label}</strong>
        <small>${entity.summary}</small>
      </span>
    </article>`).join("");
}

function renderFocus(scenario) {
  const turn = scenario.turns[state.selectedTurnIndex];
  const writeAction = turn.action === "create"
    ? "The walkthrough annotation initializes a new local entity."
    : "The walkthrough annotation links the observation to an existing local entity.";
  dom.focusContent.innerHTML = `
    <span class="route-label ${turn.action}">${turn.action.toUpperCase()} → ${turn.entity}</span>
    <audio class="focus-audio" controls preload="metadata" src="${turn.audio}"></audio>
    <p class="focus-copy"><strong>${turn.id}:</strong> ${writeAction} ${turn.memory}</p>`;
}

function renderPolicy(scenario) {
  const visible = Array.isArray(scenario.policies);
  dom.policyPanel.hidden = !visible;
  if (!visible) {
    return;
  }

  const selected = scenario.policies.find((policy) => policy.id === state.policyId) || scenario.policies[0];
  state.policyId = selected.id;
  dom.policyControl.innerHTML = scenario.policies.map((policy) => `
    <button class="${policy.id === selected.id ? "is-active" : ""}" type="button" data-policy-id="${policy.id}">${policy.label}</button>`).join("");
  dom.policyResult.innerHTML = `
    <div class="policy-summary">
      <p class="card-label">${selected.label}</p>
      <p>${selected.summary}</p>
    </div>
    <div class="metric-cell"><p>Entity structure</p><p>${selected.b3}</p></div>
    <div class="metric-cell"><p>Private access</p><p>${selected.access}</p></div>
    <div class="metric-cell"><p>End-to-end utility</p><p>${selected.qa}</p></div>`;

  dom.policyControl.querySelectorAll("[data-policy-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.policyId = button.dataset.policyId;
      renderPolicy(scenario);
    });
  });
}

function renderAccess(scenario) {
  const view = getAccessView(scenario);
  const isRisk = view.status === "risk";
  dom.queryRequester.textContent = `Requester ${scenario.query.requester}`;
  dom.queryText.textContent = `“${scenario.query.text}”`;
  dom.queryAudio.src = scenario.query.audio;
  dom.accessNote.textContent = scenario.queryNote;
  dom.authorizationCard.classList.toggle("authorization-card--safe", !isRisk);
  dom.authorizationCard.classList.toggle("authorization-card--risk", isRisk);
  dom.authorizationState.innerHTML = `${icon(isRisk ? "shield-alert" : "shield-check")}<span>${view.state}</span>`;
  dom.authorizationCopy.textContent = view.copy;
  dom.evidenceText.textContent = view.evidence;
  dom.answerText.textContent = view.answer;

  const showCounterfactual = Array.isArray(scenario.counterfactuals);
  dom.counterfactualControl.hidden = !showCounterfactual;
  if (!showCounterfactual) {
    dom.counterfactualOptions.innerHTML = "";
    state.counterfactualId = "original";
    return;
  }

  dom.counterfactualOptions.innerHTML = scenario.counterfactuals.map((item) => `
    <button class="${item.id === state.counterfactualId ? "is-active" : ""}" type="button" data-counterfactual-id="${item.id}">${item.label}</button>`).join("");
  dom.counterfactualOptions.querySelectorAll("[data-counterfactual-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.counterfactualId = button.dataset.counterfactualId;
      renderAccess(scenario);
      if (window.lucide) window.lucide.createIcons();
    });
  });
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
  state.counterfactualId = "original";
  render();
}

async function initialize() {
  const response = await fetch("data/demo-data.json");
  if (!response.ok) {
    throw new Error(`Unable to load demo data (${response.status}).`);
  }
  scenarios = await response.json();

  Object.values(scenarios).forEach((scenario) => {
      scenario.turns = scenario.turns || [];
      scenario.entities = scenario.entities || [];
      scenario.policies = scenario.policies || [];
      scenario.query = scenario.query || {};
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
  document.querySelector(".page-shell").innerHTML = `<p class="error-state">${error.message}</p>`;
});
