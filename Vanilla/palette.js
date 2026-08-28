// Command palette — vanilla ES module.
// Self-contained: builds its own DOM, opens on right-click (except on links/inputs,
// where the native menu is preserved) or Ctrl/Cmd+K. Search, arrow navigation,
// Enter to run, Esc to close, focus-trapped, reduced-motion aware.
// First open plays a staged expand (width, then height); later opens are quick
// fades. Filtering collapses hidden items with a height/opacity animation.
// Deliberately decoupled from evolution.js so it can be ported to a framework later.

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

const SECTION_TARGETS = [
  { id: "origin", label: "Origin" },
  { id: "lineage", label: "Lineage" },
  { id: "systems", label: "Systems" },
  { id: "worlds", label: "Worlds" },
  { id: "architecture", label: "Scale" },
  { id: "gallery", label: "Gallery" },
  { id: "current", label: "Now" },
];

function jumpTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReduced.matches ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

// Generic placeholders so the structure is ready for real commands later.
const COMMANDS = [
  ...SECTION_TARGETS.map((section) => ({
    id: section.id,
    group: "Navigate",
    label: section.label,
    hint: "Jump to section",
    keywords: ["jump", "go", "section", section.label.toLowerCase()],
    run: () => jumpTo(section.id),
  })),
  {
    id: "copy-page-link",
    group: "Actions",
    label: "Copy page link",
    hint: "Clipboard",
    keywords: ["copy", "link", "url", "share", "permalink"],
    run: () => navigator.clipboard?.writeText(location.href).catch(() => {}),
  },
  {
    id: "placeholder-action",
    group: "Actions",
    label: "Placeholder action",
    hint: "TODO",
    keywords: ["placeholder", "example", "action"],
    run: () => console.info("Palette placeholder action"),
  },
  {
    id: "placeholder-copy",
    group: "Clipboard",
    label: "Copy current heading",
    hint: "TODO",
    keywords: ["copy", "heading", "title"],
    run: () => console.info("Palette clipboard placeholder"),
  },
];

function buildDOM() {
  const root = document.createElement("div");
  root.className = "palette-root";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Command palette");
  root.innerHTML = `
    <div class="palette-overlay" data-palette-dismiss></div>
    <section class="palette-panel" aria-label="Commands">
      <div class="palette-head">
        <span class="palette-micro">COMMAND</span>
        <input class="palette-input" type="text" role="combobox"
               aria-expanded="false" aria-controls="palette-list"
               aria-activedescendant="" autocomplete="off" spellcheck="false"
               placeholder="Search commands or sections…">
      </div>
      <ul id="palette-list" class="palette-list" role="listbox" aria-label="Results"></ul>
    </section>`;
  return root;
}

const root = buildDOM();
const overlay = root.querySelector(".palette-overlay");
const panel = root.querySelector(".palette-panel");
const input = root.querySelector(".palette-input");
const list = root.querySelector(".palette-list");

const optionEls = new Map(); // command id -> <li>
const groupEls = new Map(); // group name -> <li>
let emptyEl = null;

let visibleCommands = COMMANDS;
let highlightedId = null;
let isOpen = false;
let lastFocused = null;
let hasOpened = false;
let introTimer = null;

function currentSectionId() {
  const scenes = [...document.querySelectorAll("[data-scene]")];
  const mid = window.innerHeight * 0.5;
  let current = scenes[0]?.id;
  for (const scene of scenes) {
    const rect = scene.getBoundingClientRect();
    if (rect.top <= mid) current = scene.id;
  }
  return current;
}

// Build the full list once; filtering toggles a "hidden" class so items
// can animate height->0 instead of being torn down and rebuilt.
function buildList() {
  list.textContent = "";
  optionEls.clear();
  groupEls.clear();

  let currentGroup = null;
  for (const cmd of COMMANDS) {
    if (cmd.group !== currentGroup) {
      const separator = document.createElement("li");
      separator.className = "palette-group";
      separator.setAttribute("role", "presentation");
      separator.textContent = cmd.group;
      separator.dataset.group = cmd.group;
      list.appendChild(separator);
      groupEls.set(cmd.group, separator);
      currentGroup = cmd.group;
    }

    const option = document.createElement("li");
    option.className = "palette-opt";
    option.setAttribute("role", "option");
    option.tabIndex = -1;
    option.id = `palette-opt-${cmd.id}`;
    option.dataset.commandId = cmd.id;

    const label = document.createElement("span");
    label.className = "opt-label";
    label.textContent = cmd.label;

    const hint = document.createElement("span");
    hint.className = "opt-hint";
    hint.textContent = cmd.hint;

    const kbd = document.createElement("kbd");
    kbd.textContent = "↵";

    option.append(label, hint, kbd);
    list.appendChild(option);
    optionEls.set(cmd.id, option);
  }

  emptyEl = document.createElement("li");
  emptyEl.className = "palette-empty";
  emptyEl.setAttribute("role", "status");
  emptyEl.textContent = "No commands match";
  emptyEl.hidden = true;
  list.appendChild(emptyEl);
}

function matchesQuery(cmd, query) {
  return [cmd.label, cmd.hint, ...(cmd.keywords ?? [])].join(" ").toLowerCase().includes(query);
}

function applyFilter() {
  const query = input.value.trim().toLowerCase();
  visibleCommands = query ? COMMANDS.filter((cmd) => matchesQuery(cmd, query)) : COMMANDS;

  const visibleIds = new Set(visibleCommands.map((cmd) => cmd.id));
  const groupCounts = new Map();
  for (const cmd of visibleCommands) {
    groupCounts.set(cmd.group, (groupCounts.get(cmd.group) ?? 0) + 1);
  }

  for (const [id, el] of optionEls) el.classList.toggle("palette-hidden", !visibleIds.has(id));
  for (const [group, el] of groupEls) {
    el.classList.toggle("palette-hidden", (groupCounts.get(group) ?? 0) === 0);
  }
  emptyEl.hidden = visibleCommands.length > 0;

  const first = visibleCommands[0];
  if (first) highlightCommand(first.id);
  else {
    highlightedId = null;
    input.setAttribute("aria-activedescendant", "");
  }
}

function highlightCommand(id) {
  highlightedId = id;
  for (const [optionId, el] of optionEls) {
    el.classList.toggle("is-highlighted", optionId === id);
  }
  const el = optionEls.get(id);
  if (el) {
    input.setAttribute("aria-activedescendant", el.id);
    el.scrollIntoView({ block: "nearest" });
  }
}

function highlightedIndex() {
  return visibleCommands.findIndex((cmd) => cmd.id === highlightedId);
}

function highlightAt(index) {
  if (!visibleCommands.length) return;
  const size = visibleCommands.length;
  const target = ((index % size) + size) % size;
  highlightCommand(visibleCommands[target].id);
}

function runCommand(id) {
  const command = COMMANDS.find((cmd) => cmd.id === id);
  if (!command) return;
  command.run();
  close();
}

function open() {
  if (isOpen) return;
  isOpen = true;
  lastFocused = document.activeElement;
  input.value = "";
  applyFilter();

  clearTimeout(introTimer);
  panel.classList.remove("palette-closing", "palette-reopen");

  if (prefersReduced.matches) {
    hasOpened = true;
    root.classList.add("is-open");
    panel.classList.add("palette-expanded");
  } else if (!hasOpened) {
    // First open: expand width while showing only the header row, then let the
    // height grow to its natural size. The head height is measured at width 0
    // so the second stage starts exactly at the search bar's bottom edge.
    hasOpened = true;
    const head = panel.querySelector(".palette-head");
    panel.style.setProperty("--palette-head-h", `${head.offsetHeight}px`);
    root.classList.add("is-open");
    // Start stage 2 (height) only after stage 1 (width) has finished. The wait
    // reads --stage-x from CSS so the two stay in sync when the timing is tuned.
    const stageX = parseFloat(getComputedStyle(panel).getPropertyValue("--stage-x")) * 1000;
    introTimer = setTimeout(() => panel.classList.add("palette-expanded"), stageX + 30);
  } else {
    root.classList.add("is-open");
    panel.classList.add("palette-reopen");
  }

  const current = visibleCommands.find((cmd) => cmd.id === currentSectionId());
  if (current) highlightCommand(current.id);

  input.setAttribute("aria-expanded", "true");
  input.focus();
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  clearTimeout(introTimer);
  panel.classList.remove("palette-expanded", "palette-reopen");
  panel.classList.add("palette-closing");
  root.classList.remove("is-open");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-activedescendant", "");
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
}

function focusables() {
  return [...panel.querySelectorAll('input, button, a[href], [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.hidden
  );
}

function trapTab(event) {
  const els = focusables();
  if (!els.length) return;
  const first = els[0];
  const last = els[els.length - 1];
  const current = document.activeElement;
  if (event.shiftKey && (current === first || current === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

function init() {
  document.body.appendChild(root);
  buildList();

  // Left/middle-click outside dismisses on button-down. Right-button dismiss is
  // handled on `contextmenu` (release) instead, so it can't immediately reopen.
  overlay.addEventListener("mousedown", (event) => {
    if (event.button !== 2 && event.target.closest("[data-palette-dismiss]")) close();
  });

  panel.addEventListener("mousedown", (event) => {
    const option = event.target.closest(".palette-opt");
    if (option) {
      event.preventDefault();
      runCommand(option.dataset.commandId);
    }
  });

  panel.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        highlightAt(highlightedIndex() + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        highlightAt(highlightedIndex() - 1);
        break;
      case "Enter":
        event.preventDefault();
        if (highlightedId) runCommand(highlightedId);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        trapTab(event);
        break;
      default:
        break;
    }
  });

  input.addEventListener("input", applyFilter);

  document.addEventListener("contextmenu", (event) => {
    // Right-click on the palette itself: dismiss when it lands on the overlay,
    // leave the panel alone. Firing on release means it closes once and never
    // reopens — the old bug was closing on mousedown then reopening on release.
    if (event.target.closest(".palette-root")) {
      event.preventDefault();
      if (event.target.closest(".palette-overlay")) close();
      return;
    }
    // Safety net: right-click elsewhere while open closes without reopening.
    if (isOpen) {
      event.preventDefault();
      close();
      return;
    }
    const onNative = event.target.closest(
      "a, input, textarea, select, [contenteditable], [data-palette-native]"
    );
    if (onNative) return; // preserve native menu: open-in-new-tab, paste, etc.
    event.preventDefault();
    open();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (isOpen) close();
      else open();
    }
  });
}

init();
