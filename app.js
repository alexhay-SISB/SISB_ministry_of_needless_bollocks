(() => {
  "use strict";

  const STORAGE_KEY = "sisb-needless-bollocks-directives";
  const SETTINGS_KEY = "sisb-mnb-github-settings";
  const MEETING_OPTIONS = ["No", "Yes", "Of course it did"];
  const TICK_OPTIONS = ["No", "Yes", "The box is the task"];
  const SCORE_LABELS = {
    1: "Possibly useful if designed better.",
    2: "Bullshit.",
    3: "Elora made up some more stupid crap.",
    4: "No-one even knows why we’re doing this.",
    5: "Jesus, not Roneth again."
  };

  const state = { directives: [], syncing: false, editingId: null };
  const $ = (selector) => document.querySelector(selector);
  const elements = {
    form: $("#directiveForm"),
    list: $("#directiveList"),
    empty: $("#emptyState"),
    message: $("#formMessage"),
    submitText: $("#submitText"),
    submitButton: $("#directiveForm .primary-button"),
    cancelEdit: $("#cancelEdit"),
    syncNotice: $("#syncNotice"),
    dialog: $("#settingsDialog"),
    settingsForm: $("#settingsForm"),
    settingsMessage: $("#settingsMessage")
  };

  function getSettings() {
    const configured = window.NONSENSE_TRACKER_CONFIG || {};
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch (_) { saved = {}; }
    return {
      owner: saved.owner || configured.owner || "",
      repo: saved.repo || configured.repo || "",
      branch: saved.branch || configured.branch || "main",
      dataPath: configured.dataPath || "directives.json",
      token: saved.token || ""
    };
  }

  function hasRemoteConfig(settings = getSettings()) {
    return Boolean(settings.owner && settings.repo);
  }

  function hasWriteAccess(settings = getSettings()) {
    return hasRemoteConfig(settings) && Boolean(settings.token);
  }

  function canManage(settings = getSettings()) {
    return !hasRemoteConfig(settings) || hasWriteAccess(settings);
  }

  function setMessage(element, message = "", isError = false) {
    element.textContent = message;
    element.classList.toggle("error", isError);
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  function updateSyncNotice() {
    const settings = getSettings();
    if (hasWriteAccess(settings)) {
      elements.syncNotice.classList.add("synced");
      elements.syncNotice.innerHTML = `<span><b>CENTRAL BUREAUCRACY CONNECTED:</b> filing to ${escapeHtml(settings.owner)}/${escapeHtml(settings.repo)}.</span><button type="button" id="noticeSettings">System access</button>`;
    } else if (hasRemoteConfig(settings)) {
      elements.syncNotice.classList.remove("synced");
      elements.syncNotice.innerHTML = `<span><b>PUBLIC RECORD MODE:</b> reading the shared register from GitHub.</span><button type="button" id="noticeSettings">Enable filing access</button>`;
    } else {
      elements.syncNotice.classList.remove("synced");
      elements.syncNotice.innerHTML = `<span><b>LOCAL FILING CABINET:</b> records are only stored in this browser.</span><button type="button" id="noticeSettings">Connect central bureaucracy</button>`;
    }
    $("#noticeSettings").addEventListener("click", openSettings);
  }

  function normaliseDirectives(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && item.muppet && item.extraCrap)
      .map((item) => ({
        id: String(item.id || `${item.createdAt || Date.now()}-${Math.random()}`),
        muppet: String(item.muppet).slice(0, 80),
        extraCrap: String(item.extraCrap).slice(0, 800),
        meeting: MEETING_OPTIONS.includes(item.meeting) ? item.meeting : "No",
        tickBox: TICK_OPTIONS.includes(item.tickBox) ? item.tickBox : "No",
        score: Math.min(5, Math.max(1, Number(item.score) || 1)),
        createdAt: String(item.createdAt || new Date().toISOString()),
        updatedAt: item.updatedAt ? String(item.updatedAt) : undefined
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function readLocal() {
    try { return normaliseDirectives(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); }
    catch (_) { return []; }
  }

  function saveLocal(directives) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(directives));
  }

  function bytesToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToText(value) {
    const binary = atob(value.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function fetchRemote(settings = getSettings()) {
    const url = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${settings.dataPath}?ref=${encodeURIComponent(settings.branch)}&t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
    if (!response.ok) throw new Error(response.status === 404 ? "directives.json was not found in that repository." : `GitHub returned ${response.status}.`);
    const file = await response.json();
    return normaliseDirectives(JSON.parse(base64ToText(file.content)));
  }

  async function loadDirectives(showStatus = false) {
    const settings = getSettings();
    if (showStatus) setMessage(elements.message, "Requesting the latest paperwork…");
    try {
      if (hasRemoteConfig(settings)) {
        state.directives = await fetchRemote(settings);
      } else {
        const response = await fetch(`directives.json?t=${Date.now()}`, { cache: "no-store" });
        const seeded = response.ok ? normaliseDirectives(await response.json()) : [];
        const local = readLocal();
        state.directives = normaliseDirectives([...seeded, ...local.filter((item) => !seeded.some((seed) => seed.id === item.id))]);
      }
      render();
      if (showStatus) setMessage(elements.message, "Register refreshed. The nonsense remains current.");
    } catch (error) {
      const local = readLocal();
      state.directives = local;
      render();
      if (showStatus) setMessage(elements.message, error.message, true);
    }
  }

  function render() {
    elements.list.replaceChildren();
    const template = $("#directiveTemplate");

    state.directives.forEach((directive, index) => {
      const node = template.content.cloneNode(true);
      const date = new Date(directive.createdAt);
      node.querySelector(".directive-number").textContent = `DIRECTIVE MNB-${String(state.directives.length - index).padStart(3, "0")}`;
      node.querySelector(".directive-date").textContent = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      node.querySelector(".directive-muppet").textContent = directive.muppet;
      node.querySelector(".directive-crap").textContent = directive.extraCrap;
      node.querySelector(".meeting-tag").textContent = `Pointless meeting: ${directive.meeting}`;
      node.querySelector(".tick-tag").textContent = `Tick box: ${directive.tickBox}`;
      node.querySelector(".meter-value").textContent = directive.score;
      node.querySelector(".score-description").textContent = SCORE_LABELS[directive.score];
      node.querySelectorAll(".reading-bar i").forEach((bar, barIndex) => bar.classList.toggle("active", barIndex < directive.score));
      const actions = node.querySelector(".record-actions");
      actions.hidden = !canManage();
      actions.querySelectorAll("button").forEach((button) => { button.dataset.id = directive.id; });
      elements.list.appendChild(node);
    });

    elements.empty.hidden = state.directives.length > 0;
    $("#directiveCount").textContent = state.directives.length.toLocaleString("en-GB");
    $("#meetingCount").textContent = state.directives.filter((item) => item.meeting !== "No").length.toLocaleString("en-GB");
    const tickCount = state.directives.filter((item) => item.tickBox !== "No").length;
    $("#tickRate").textContent = state.directives.length ? Math.round((tickCount / state.directives.length) * 100) : 0;
    const average = state.directives.length ? state.directives.reduce((sum, item) => sum + item.score, 0) / state.directives.length : 0;
    $("#averageScore").textContent = average ? average.toFixed(1) : "—";
    updateSyncNotice();
  }

  async function mutateRemote(mutator, commitMessage, settings = getSettings()) {
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${settings.dataPath}`;
    const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${settings.token}`, "X-GitHub-Api-Version": "2022-11-28" };
    const currentResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(settings.branch)}`, { headers, cache: "no-store" });
    if (!currentResponse.ok) throw new Error(currentResponse.status === 401 ? "GitHub rejected the token." : "Could not read directives.json from GitHub.");
    const current = await currentResponse.json();
    const latest = normaliseDirectives(JSON.parse(base64ToText(current.content)));
    const updated = normaliseDirectives(mutator(latest));
    const updateResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message: commitMessage, content: bytesToBase64(`${JSON.stringify(updated, null, 2)}\n`), sha: current.sha, branch: settings.branch })
    });
    if (!updateResponse.ok) {
      const detail = await updateResponse.json().catch(() => ({}));
      throw new Error(detail.message || "GitHub could not update the register.");
    }
    return updated;
  }

  function validateInput(input) {
    const fields = {
      muppet: String(input.muppet || "").trim(),
      extraCrap: String(input.extraCrap || "").trim(),
      meeting: input.meeting,
      tickBox: input.tickBox,
      score: Number(input.score)
    };
    if (!fields.muppet || fields.muppet.length > 80) throw new Error("Name the responsible muppet (80 characters maximum).");
    if (!fields.extraCrap || fields.extraCrap.length > 800) throw new Error("Describe the extra work (800 characters maximum).");
    if (!MEETING_OPTIONS.includes(fields.meeting)) throw new Error("Choose whether a pointless meeting was involved.");
    if (!TICK_OPTIONS.includes(fields.tickBox)) throw new Error("Choose whether this is a tick-box exercise.");
    if (![1, 2, 3, 4, 5].includes(fields.score)) throw new Error("Choose a bullshit rating from 1 to 5.");
    return fields;
  }

  async function saveDirective(input, directiveId = null) {
    if (state.syncing) throw new Error("The filing clerk is already busy.");
    const fields = validateInput(input);
    const existing = directiveId ? state.directives.find((item) => item.id === directiveId) : null;
    if (directiveId && !existing) throw new Error("That directive is no longer available to amend.");
    const directive = existing
      ? { ...existing, ...fields, updatedAt: new Date().toISOString() }
      : { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...fields, createdAt: new Date().toISOString() };

    state.syncing = true;
    elements.submitButton.disabled = true;
    elements.cancelEdit.disabled = true;
    elements.submitText.textContent = directiveId ? "Amending official history…" : "Filing with the ministry…";
    setMessage(elements.message, "");
    try {
      const settings = getSettings();
      if (hasWriteAccess(settings)) {
        state.directives = await mutateRemote((latest) => {
          if (directiveId) {
            if (!latest.some((item) => item.id === directiveId)) throw new Error("That directive was already shredded.");
            return latest.map((item) => item.id === directiveId ? { ...item, ...fields, updatedAt: directive.updatedAt } : item);
          }
          return [directive, ...latest.filter((item) => item.id !== directive.id)];
        }, directiveId ? `Amend needless directive: ${directive.muppet}` : `Register needless directive: ${directive.muppet}`, settings);
        saveLocal(state.directives);
        setMessage(elements.message, directiveId ? "Official history amended. Nobody will admit the first version existed." : "Directive registered. Productivity has been notified.");
      } else {
        state.directives = normaliseDirectives(directiveId ? state.directives.map((item) => item.id === directiveId ? directive : item) : [directive, ...state.directives]);
        saveLocal(state.directives);
        setMessage(elements.message, directiveId ? "Amended on this browser." : "Saved locally. Connect GitHub to share the suffering.");
      }
      resetForm();
      render();
      return directive;
    } catch (error) {
      setMessage(elements.message, error.message, true);
      throw error;
    } finally {
      state.syncing = false;
      elements.submitButton.disabled = false;
      elements.cancelEdit.disabled = false;
      elements.submitText.textContent = state.editingId ? "Approve amendment" : "Register this nonsense";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(elements.form);
    try {
      await saveDirective({
        muppet: data.get("muppet"),
        extraCrap: data.get("extraCrap"),
        meeting: data.get("meeting"),
        tickBox: data.get("tickBox"),
        score: Number(data.get("score"))
      }, state.editingId);
    } catch (_) {
      // saveDirective reports errors in the form.
    }
  }

  function resetForm() {
    state.editingId = null;
    elements.form.reset();
    elements.cancelEdit.hidden = true;
    elements.submitText.textContent = "Register this nonsense";
  }

  function startEdit(directiveId) {
    const directive = state.directives.find((item) => item.id === directiveId);
    if (!directive) { setMessage(elements.message, "That directive is no longer available.", true); return; }
    state.editingId = directive.id;
    $("#muppet").value = directive.muppet;
    $("#extraCrap").value = directive.extraCrap;
    const meetingOption = elements.form.querySelector(`input[name="meeting"][value="${CSS.escape(directive.meeting)}"]`);
    const tickOption = elements.form.querySelector(`input[name="tickBox"][value="${CSS.escape(directive.tickBox)}"]`);
    const scoreOption = elements.form.querySelector(`input[name="score"][value="${directive.score}"]`);
    if (meetingOption) meetingOption.checked = true;
    if (tickOption) tickOption.checked = true;
    if (scoreOption) scoreOption.checked = true;
    elements.cancelEdit.hidden = false;
    elements.submitText.textContent = "Approve amendment";
    setMessage(elements.message, `Amending the directive issued by ${directive.muppet}. Alter the paperwork, then approve the amendment.`);
    elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteDirective(directiveId, requireConfirmation = true) {
    if (state.syncing) throw new Error("Another filing operation is still underway.");
    const directive = state.directives.find((item) => item.id === directiveId);
    if (!directive) throw new Error("That directive is no longer available.");
    const settings = getSettings();
    if (hasRemoteConfig(settings) && !hasWriteAccess(settings)) throw new Error("Connect central filing access before shredding shared records.");
    if (requireConfirmation && !window.confirm(`Shred the directive issued by ${directive.muppet}?\n\nThis permanently removes it from the register.`)) return false;

    state.syncing = true;
    elements.submitButton.disabled = true;
    setMessage(elements.message, "Authorising document destruction…");
    try {
      if (hasWriteAccess(settings)) {
        state.directives = await mutateRemote((latest) => {
          if (!latest.some((item) => item.id === directiveId)) throw new Error("That directive was already shredded.");
          return latest.filter((item) => item.id !== directiveId);
        }, `Shred needless directive: ${directive.muppet}`, settings);
      } else {
        state.directives = state.directives.filter((item) => item.id !== directiveId);
      }
      saveLocal(state.directives);
      if (state.editingId === directiveId) resetForm();
      render();
      setMessage(elements.message, "Evidence shredded. Management will deny this ever happened.");
      return true;
    } catch (error) {
      setMessage(elements.message, error.message, true);
      throw error;
    } finally {
      state.syncing = false;
      elements.submitButton.disabled = false;
    }
  }

  async function handleRecordAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    try {
      if (button.dataset.action === "edit") startEdit(button.dataset.id);
      if (button.dataset.action === "delete") await deleteDirective(button.dataset.id, true);
    } catch (_) {
      // Actions report errors in the form.
    }
  }

  function openSettings() {
    const settings = getSettings();
    $("#githubOwner").value = settings.owner;
    $("#githubRepo").value = settings.repo;
    $("#githubBranch").value = settings.branch;
    $("#githubToken").value = settings.token;
    setMessage(elements.settingsMessage, "");
    elements.dialog.showModal();
  }

  async function saveSettings(event) {
    event.preventDefault();
    const settings = {
      owner: $("#githubOwner").value.trim(),
      repo: $("#githubRepo").value.trim(),
      branch: $("#githubBranch").value.trim() || "main",
      token: $("#githubToken").value.trim()
    };
    setMessage(elements.settingsMessage, "Testing central filing access…");
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${settings.token}`, "X-GitHub-Api-Version": "2022-11-28" };
      const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/directives.json?ref=${encodeURIComponent(settings.branch)}`, { headers, cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Token rejected. Check it and try again." : "Could not find directives.json in that repository.");
      setMessage(elements.settingsMessage, "Access granted. Future nonsense will be centrally archived.");
      await loadDirectives(false);
      setTimeout(() => elements.dialog.close(), 750);
    } catch (error) {
      setMessage(elements.settingsMessage, error.message, true);
    }
  }

  function disconnectSync() {
    localStorage.removeItem(SETTINGS_KEY);
    $("#githubToken").value = "";
    setMessage(elements.settingsMessage, "Local access revoked. Public record mode restored.");
    render();
  }

  function registerWebMcpTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const properties = {
      muppet: { type: "string", minLength: 1, maxLength: 80 },
      extraCrap: { type: "string", minLength: 1, maxLength: 800 },
      meeting: { type: "string", enum: MEETING_OPTIONS },
      tickBox: { type: "string", enum: TICK_OPTIONS },
      score: { type: "integer", minimum: 1, maximum: 5 }
    };

    void Promise.resolve(context.registerTool({
      name: "list_needless_directives",
      title: "List needless directives",
      description: "Return the directives currently shown in the Ministry of Needless Bollocks register.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ({ count: state.directives.length, directives: state.directives })
    })).catch(() => {});

    void Promise.resolve(context.registerTool({
      name: "log_needless_directive",
      title: "Log a needless directive",
      description: "Add one management directive to the register.",
      inputSchema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const directive = await saveDirective(input, null);
        return { saved: true, id: directive.id, storage: hasWriteAccess() ? "github" : "this browser" };
      }
    })).catch(() => {});

    void Promise.resolve(context.registerTool({
      name: "edit_needless_directive",
      title: "Edit a needless directive",
      description: "Replace one existing directive using its id.",
      inputSchema: { type: "object", properties: { id: { type: "string", minLength: 1 }, ...properties }, required: ["id", ...Object.keys(properties)], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const directive = await saveDirective(input, input.id);
        return { saved: true, id: directive.id };
      }
    })).catch(() => {});

    void Promise.resolve(context.registerTool({
      name: "delete_needless_directive",
      title: "Delete a needless directive",
      description: "Permanently remove one directive using its id.",
      inputSchema: { type: "object", properties: { id: { type: "string", minLength: 1 } }, required: ["id"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const deleted = await deleteDirective(input.id, false);
        return { deleted, id: input.id };
      }
    })).catch(() => {});
  }

  elements.form.addEventListener("submit", handleSubmit);
  elements.cancelEdit.addEventListener("click", () => {
    resetForm();
    setMessage(elements.message, "Amendment withdrawn. The original nonsense stands.");
  });
  elements.list.addEventListener("click", handleRecordAction);
  elements.settingsForm.addEventListener("submit", saveSettings);
  $("#openSettings").addEventListener("click", openSettings);
  $("#closeSettings").addEventListener("click", () => elements.dialog.close());
  $("#noticeSettings").addEventListener("click", openSettings);
  $("#disconnectSync").addEventListener("click", disconnectSync);
  $("#refreshData").addEventListener("click", () => loadDirectives(true));
  loadDirectives(false);
  registerWebMcpTools();
})();
