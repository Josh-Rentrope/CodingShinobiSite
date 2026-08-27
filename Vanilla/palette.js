// Command palette — vanilla ES module.
// Self-contained: builds its own DOM, opens on right-click (except on links/inputs,
// where the native menu is preserved) or Ctrl/Cmd+K. Search, arrow navigation,
// Enter to run, Esc to close, focus-trapped, reduced-motion aware.
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

let visible = COMMANDS;
let highlighted = -1;
let isOpen = false;
let lastFocused = null;

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

function renderList() {
  const query = input.value.trim().toLowerCase();
  visible = query
    ? COMMANDS.filter((cmd) =>
        [cmd.label, cmd.hint, ...(cmd.keywords ?? [])].join(" ").toLowerCase().includes(query)
      )
    : COMMANDS;

  list.textContent = "";

  if (!visible.length) {
    const empty = document.createElement("li");
    empty.className = "palette-empty";
    empty.setAttribute("role", "presentation");
    empty.textContent = "No commands match";
    list.appendChild(empty);
    highlighted = -1;
    input.setAttribute("aria-activedescendant", "");
    return;
  }

  let currentGroup = null;
  visible.forEach((cmd, index) => {
    if (cmd.group !== currentGroup) {
      const separator = document.createElement("li");
      separator.className = "palette-group";
      separator.setAttribute("role", "presentation");
      separator.textContent = cmd.group;
      list.appendChild(separator);
      currentGroup = cmd.group;
    }

    const option = document.createElement("li");
    option.className = "palette-opt";
    option.setAttribute("role", "option");
    option.tabIndex = -1;
    option.id = `palette-opt-${index}`;
    option.dataset.index = String(index);

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
  });

  highlighted = -1;
  highlight(0);
}

function highlight(index) {
  if (!visible.length) return;
  const size = visible.length;
  const target = ((index % size) + size) % size;
  highlighted = target;

  const option = document.getElementById(`palette-opt-${target}`);
  if (!option) return;
  list.querySelectorAll(".palette-opt").forEach((el) => {
    el.classList.toggle("is-highlighted", el === option);
  });
  option.scrollIntoView({ block: "nearest" });
  input.setAttribute("aria-activedescendant", option.id);
}

function run(index) {
  const command = visible[index];
  if (!command) return;
  command.run();
  close();
}

function open() {
  if (isOpen) return;
  isOpen = true;
  lastFocused = document.activeElement;
  input.value = "";
  renderList();

  const currentIndex = visible.findIndex((cmd) => cmd.id === currentSectionId());
  if (currentIndex >= 0) highlight(currentIndex);

  root.classList.add("is-open");
  input.setAttribute("aria-expanded", "true");
  input.focus();
}

function close() {
  if (!isOpen) return;
  isOpen = false;
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

  overlay.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-palette-dismiss]")) close();
  });

  panel.addEventListener("mousedown", (event) => {
    const option = event.target.closest(".palette-opt");
    if (option) {
      event.preventDefault();
      run(Number(option.dataset.index));
    }
  });

  panel.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        highlight(highlighted + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        highlight(highlighted - 1);
        break;
      case "Enter":
        event.preventDefault();
        if (highlighted >= 0) run(highlighted);
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

  input.addEventListener("input", renderList);

  document.addEventListener("contextmenu", (event) => {
    const native = event.target.closest(
      "a, input, textarea, select, [contenteditable], [data-palette-native]"
    );
    if (native) return; // preserve native menu: open-in-new-tab, paste, etc.
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
