import init, { SearchEngine } from './pkg/sage_wasm_demo.js';

const DATASET_URL = 'demo_data.json';
const MINI_FASTA_URL = 'mini.fasta';
const EXTRA_FASTA_URL = 'PXD003881.fasta';
const FASTA_EXTRA_COUNT = 400;
const CONFIG_URL = 'PXD003881.json';

const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const optionsFormEl = document.getElementById('engineOptionsForm');
const optionsFieldsEl = document.getElementById('engineOptionsFields');
const applyOptionsButton = document.getElementById('applyOptionsButton');
const resetOptionsButton = document.getElementById('resetOptionsButton');
const optionStatusEl = document.getElementById('optionStatus');
const themeToggleButton = document.getElementById('themeToggle');
const datasetLabelEl = document.getElementById('datasetLabel');
const resultNavEl = document.getElementById('resultNav');
const prevSpectrumButton = document.getElementById('prevSpectrum');
const nextSpectrumButton = document.getElementById('nextSpectrum');
const spectrumCounterEl = document.getElementById('spectrumCounter');
if (applyOptionsButton) applyOptionsButton.disabled = true;
if (resetOptionsButton) resetOptionsButton.disabled = true;
const THEME_KEY = 'sage-core-demo-theme';
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === THEME_LIGHT || stored === THEME_DARK) {
    return stored;
  }
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  return prefersLight ? THEME_LIGHT : THEME_DARK;
}

function setTheme(theme) {
  const nextTheme = theme === THEME_LIGHT ? THEME_LIGHT : THEME_DARK;
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
  if (themeToggleButton) {
    if (nextTheme === THEME_DARK) {
      themeToggleButton.textContent = 'Theme: Dark';
      themeToggleButton.setAttribute('aria-label', 'Switch to light theme');
      themeToggleButton.dataset.theme = THEME_DARK;
    } else {
      themeToggleButton.textContent = 'Theme: Light';
      themeToggleButton.setAttribute('aria-label', 'Switch to dark theme');
      themeToggleButton.dataset.theme = THEME_LIGHT;
    }
  }
}

const OPTION_CONTROL_GROUPS = [
  {
    title: 'Enzyme',
    controls: [
      {
        key: 'enzyme.missed_cleavages',
        label: 'Missed cleavages',
        type: 'range',
        min: 0,
        max: 8,
        step: 1,
        integer: true,
      },
      {
        key: 'enzyme.min_len',
        label: 'Min peptide length',
        type: 'range',
        min: 4,
        max: 60,
        step: 1,
        integer: true,
      },
      {
        key: 'enzyme.max_len',
        label: 'Max peptide length',
        type: 'range',
        min: 6,
        max: 100,
        step: 1,
        integer: true,
      },
      {
        key: 'enzyme.cleave_at',
        label: 'Cleavage residues',
        type: 'text',
        placeholder: 'KR',
      },
      {
        key: 'enzyme.restrict',
        label: 'Protease restrict',
        type: 'select',
        options: [
          { value: 'P', label: 'No proline exception' },
          { value: '', label: 'Allow all' },
          { value: 'C', label: 'Restrict C' },
          { value: 'D', label: 'Restrict D' },
        ],
      },
      {
        key: 'enzyme.c_terminal',
        label: 'C-terminal cleavage',
        type: 'checkbox',
      },
      {
        key: 'enzyme.semi_enzymatic',
        label: 'Semi-enzymatic digestion',
        type: 'checkbox',
      },
    ],
  },
  {
    title: 'Tolerance & filtering',
    controls: [
      {
        key: 'precursorToleranceLoPpm',
        label: 'Precursor tolerance min (ppm)',
        type: 'range',
        min: -100,
        max: 0,
        step: 1,
      },
      {
        key: 'precursorToleranceHiPpm',
        label: 'Precursor tolerance max (ppm)',
        type: 'range',
        min: 0,
        max: 100,
        step: 1,
      },
      {
        key: 'fragmentToleranceLoPpm',
        label: 'Fragment tolerance min (ppm)',
        type: 'range',
        min: -100,
        max: 0,
        step: 1,
      },
      {
        key: 'fragmentToleranceHiPpm',
        label: 'Fragment tolerance max (ppm)',
        type: 'range',
        min: 0,
        max: 100,
        step: 1,
      },
      {
        key: 'ionKinds',
        label: 'Ion kinds',
        type: 'checkbox-group',
        options: [
          { value: 'a', label: 'a' },
          { value: 'b', label: 'b' },
          { value: 'c', label: 'c' },
          { value: 'x', label: 'x' },
          { value: 'y', label: 'y' },
          { value: 'z', label: 'z' },
        ],
      },
      {
        key: 'maxPeaks',
        label: 'Max peaks',
        type: 'range',
        min: 10,
        max: 500,
        step: 1,
        integer: true,
      },
      {
        key: 'minPeaks',
        label: 'Min peaks',
        type: 'range',
        min: 1,
        max: 250,
        step: 1,
        integer: true,
      },
      {
        key: 'minMatchedPeaks',
        label: 'Min matched peaks',
        type: 'range',
        min: 0,
        max: 40,
        step: 1,
        integer: true,
      },
      {
        key: 'reportPsms',
        label: 'Report PSMs',
        type: 'range',
        min: 1,
        max: 100,
        step: 1,
        integer: true,
      },
      {
        key: 'maxFragmentCharge',
        label: 'Max fragment charge',
        type: 'range',
        min: 1,
        max: 4,
        step: 1,
        integer: true,
      },
      {
        key: 'bucketSize',
        label: 'Bucket size',
        type: 'range',
        min: 1024,
        max: 65536,
        step: 1,
        integer: true,
      },
      {
        key: 'minIonIndex',
        label: 'Min ion index',
        type: 'range',
        min: 1,
        max: 12,
        step: 1,
        integer: true,
      },
    ],
  },
  {
    title: 'Mass windows',
    controls: [
      {
        key: 'minFragmentMz',
        label: 'Min fragment m/z',
        type: 'range',
        min: 0,
        max: 1000,
        step: 1,
      },
      {
        key: 'maxFragmentMz',
        label: 'Max fragment m/z',
        type: 'range',
        min: 100,
        max: 5000,
        step: 1,
      },
      {
        key: 'minFragmentMass',
        label: 'Min fragment mass',
        type: 'range',
        min: 0,
        max: 5000,
        step: 1,
      },
      {
        key: 'maxFragmentMass',
        label: 'Max fragment mass',
        type: 'range',
        min: 100,
        max: 5000,
        step: 1,
      },
      {
        key: 'peptideMinMass',
        label: 'Min peptide mass',
        type: 'range',
        min: 0,
        max: 10000,
        step: 1,
      },
      {
        key: 'peptideMaxMass',
        label: 'Max peptide mass',
        type: 'range',
        min: 1000,
        max: 20000,
        step: 1,
      },
      {
        key: 'minPrecursorMass',
        label: 'Min precursor mass',
        type: 'range',
        min: 0,
        max: 20000,
        step: 1,
      },
      {
        key: 'maxPrecursorMass',
        label: 'Max precursor mass',
        type: 'range',
        min: 1000,
        max: 20000,
        step: 1,
      },
    ],
  },
  {
    title: 'Additional options',
    controls: [
      {
        key: 'minPrecursorCharge',
        label: 'Min precursor charge',
        type: 'range',
        min: 1,
        max: 8,
        step: 1,
        integer: true,
      },
      {
        key: 'maxPrecursorCharge',
        label: 'Max precursor charge',
        type: 'range',
        min: 1,
        max: 8,
        step: 1,
        integer: true,
      },
      {
        key: 'minIsotopeError',
        label: 'Min isotope error',
        type: 'range',
        min: -5,
        max: 0,
        step: 1,
        integer: true,
      },
      {
        key: 'maxIsotopeError',
        label: 'Max isotope error',
        type: 'range',
        min: 0,
        max: 10,
        step: 1,
        integer: true,
      },
      {
        key: 'decoyTag',
        label: 'Decoy tag',
        type: 'text',
        placeholder: 'rev_',
      },
      {
        key: 'minDeisotopeMz',
        label: 'Min deisotope m/z',
        type: 'range',
        min: 0,
        max: 200,
        step: 0.1,
      },
      {
        key: 'maxVariableMods',
        label: 'Max variable mods',
        type: 'range',
        min: 0,
        max: 10,
        step: 1,
        integer: true,
      },
      {
        key: 'generateDecoys',
        label: 'Generate decoys',
        type: 'checkbox',
      },
      {
        key: 'deisotope',
        label: 'Deisotope',
        type: 'checkbox',
      },
    ],
  },
  {
    title: 'Mass mods',
    controls: [
      {
        key: 'staticMods',
        label: 'Static mods (JSON)',
        type: 'json',
        placeholder: '{ "C": 57.0215 }',
      },
      {
        key: 'variableMods',
        label: 'Variable mods (JSON)',
        type: 'json',
        placeholder: '{ "M": [15.994] }',
      },
    ],
  },
];

const chartByQuery = new Map();
const AXIS_MIN_MZ = 0;
const AXIS_MAX_MZ = 2000;
let fastaBuildInfo = null;

const DEFAULT_ENGINE_OPTIONS = {
  enzyme: {
    missed_cleavages: 2,
    min_len: 7,
    max_len: 50,
    cleave_at: 'KR',
    restrict: 'P',
    c_terminal: true,
    semi_enzymatic: false,
  },
  precursorToleranceLoPpm: -20,
  precursorToleranceHiPpm: 20,
  fragmentToleranceLoPpm: -20,
  fragmentToleranceHiPpm: 20,
  minFragmentMz: 150,
  maxFragmentMz: 2000,
  ionKinds: ['b', 'y'],
  maxPeaks: 150,
  minPeaks: 15,
  minMatchedPeaks: 4,
  maxVariableMods: 3,
  staticMods: {
    C: 57.0215,
  },
  variableMods: {
    M: [15.994],
  },
  reportPsms: 10,
  minPrecursorCharge: 1,
  maxPrecursorCharge: 6,
  minIsotopeError: 0,
  maxIsotopeError: 2,
  peptideMinMass: 500,
  peptideMaxMass: 5000,
  minFragmentMass: 150,
  maxFragmentMass: 2000,
  minPrecursorMass: 500,
  maxPrecursorMass: 5000,
  decoyTag: 'rev_',
  maxFragmentCharge: 1,
  bucketSize: 8192,
  minIonIndex: 2,
  generateDecoys: true,
  deisotope: true,
  minDeisotopeMz: 0,
};

let demoDataset = null;
let engineOptions = cloneDefaultOptions();
let loadedEngineOptions = cloneDefaultOptions();
let optionInputMap = new Map();
let fastaText = '';
let searchResultByQueryId = new Map();
let searchErrorByQueryId = new Map();
let searchInFlight = new Map();
let searchTokensByQueryId = new Map();
let currentResultIndex = 0;
let renderEpoch = 0;

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((value, key) => (value ? value[key] : undefined), obj);
}

function setByPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  let cursor = obj;
  parts.forEach((key) => {
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  });
  cursor[last] = value;
}

function formatOptionValue(value, precision = 2) {
  if (typeof value === 'boolean') {
    return value ? 'on' : 'off';
  }
  if (typeof value === 'number' && Number.isFinite(value) && value % 1 !== 0) {
    const digits = Math.max(0, precision);
    return String(Number(value.toFixed(digits)));
  }
  return String(value);
}

function createStatusBadge(text, tone = 'default') {
  const badge = document.createElement('span');
  badge.textContent = text;
  badge.className =
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none';

  if (tone === 'target') {
    badge.style.backgroundColor = 'hsl(var(--target) / 0.15)';
    badge.style.borderColor = 'hsl(var(--target) / 0.4)';
    badge.style.color = 'hsl(var(--target))';
    return badge;
  }

  if (tone === 'decoy') {
    badge.style.backgroundColor = 'hsl(var(--decoy) / 0.15)';
    badge.style.borderColor = 'hsl(var(--decoy) / 0.4)';
    badge.style.color = 'hsl(var(--decoy))';
    return badge;
  }

  badge.style.backgroundColor = 'hsl(var(--secondary))';
  badge.style.borderColor = 'hsl(var(--border))';
  badge.style.color = 'hsl(var(--muted-foreground))';
  return badge;
}

function setOptionStatus(message) {
  if (optionStatusEl) {
    optionStatusEl.textContent = message || '';
  }
}

function setOptionControlState(enabled) {
  if (!optionsFieldsEl) {
    return;
  }
  optionInputsAreReady().forEach((entry) => {
    entry.disabled = !enabled;
  });

  if (applyOptionsButton) {
    applyOptionsButton.disabled = !enabled;
  }
  if (resetOptionsButton) {
    resetOptionsButton.disabled = !enabled;
  }
}

function optionInputsAreReady() {
  const inputs = [];
  if (!optionsFieldsEl) {
    return inputs;
  }
  optionsFieldsEl.querySelectorAll('input, select, textarea').forEach((input) => {
    inputs.push(input);
  });
  return inputs;
}

function syncSearchControls(enabled) {
  if (!prevSpectrumButton || !nextSpectrumButton) {
    return;
  }
  const total = demoDataset && Array.isArray(demoDataset.queries) ? demoDataset.queries.length : 0;
  prevSpectrumButton.disabled = !enabled || currentResultIndex <= 0;
  nextSpectrumButton.disabled = !enabled || !total || currentResultIndex >= total - 1;
}

function setPanelEnabled(enabled) {
  setOptionControlState(enabled);
  syncSearchControls(enabled);
}

function applyControlsToOption(option) {
  if (!optionsFieldsEl) return;
  OPTION_CONTROL_GROUPS.forEach((group) => {
    group.controls.forEach((control) => {
      const entry = optionInputMap.get(control.key);
      if (!entry) {
        return;
      }
      const value = getByPath(option, control.key);
      if (value == null) return;

      switch (control.type) {
        case 'checkbox-group':
          (entry.inputs || []).forEach((input) => {
            input.checked = Array.isArray(value) ? value.includes(input.value) : false;
          });
          break;
        case 'checkbox':
          if (entry instanceof HTMLInputElement) {
            entry.checked = Boolean(value);
          }
          break;
        case 'json':
          if (entry instanceof HTMLTextAreaElement) {
            entry.value = JSON.stringify(value, null, 2);
          }
          break;
        case 'range':
        case 'number':
        case 'text':
        case 'select':
          if (entry instanceof HTMLInputElement || entry instanceof HTMLSelectElement) {
            entry.value = value;
          }
          break;
        default:
          break;
      }
    });
  });
}

function readControlsAsOptions() {
  const output = cloneOptions(engineOptions);
  for (const group of OPTION_CONTROL_GROUPS) {
    for (const control of group.controls) {
      const entry = optionInputMap.get(control.key);
      if (!entry) {
        continue;
      }

      if (control.type === 'checkbox-group') {
        const selected = (entry.inputs || []).filter((input) => input.checked).map((input) => input.value);
        setByPath(output, control.key, selected);
        continue;
      }

      if (control.type === 'checkbox') {
        const input = entry instanceof HTMLInputElement ? entry : null;
        if (!input) {
          continue;
        }
        setByPath(output, control.key, input.checked);
        continue;
      }

      if (control.type === 'json') {
        if (!(entry instanceof HTMLTextAreaElement)) {
          continue;
        }
        const raw = entry.value.trim();
        if (!raw) {
          setByPath(output, control.key, {});
          continue;
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            setByPath(output, control.key, parsed);
            continue;
          }
          throw new Error('must be object');
        } catch (error) {
          throw new Error(`Invalid JSON in ${control.label}`);
        }
      }

      if (entry instanceof HTMLInputElement || entry instanceof HTMLSelectElement) {
        let nextValue = entry.value;
        if (control.type === 'range' || control.type === 'number') {
          if (control.integer) {
            const numeric = Number.parseInt(nextValue, 10);
            if (!Number.isFinite(numeric)) {
              throw new Error(`Invalid number in ${control.label}`);
            }
            nextValue = numeric;
          } else {
            const numeric = Number.parseFloat(nextValue);
            if (!Number.isFinite(numeric)) {
              throw new Error(`Invalid number in ${control.label}`);
            }
            nextValue = numeric;
          }
        }
        setByPath(output, control.key, nextValue);
      }
    }
  }

  return output;
}

function clearSearchState() {
  searchResultByQueryId.clear();
  searchErrorByQueryId.clear();
  searchInFlight.clear();
  searchTokensByQueryId.clear();
}

function optionsEqual(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function createRangeField(control, value) {
  const container = document.createElement('div');
  container.className =
    'shadcn-control rounded-lg border border-input bg-background/40 p-2.5 flex flex-col gap-1.5';

  const label = document.createElement('label');
  label.className = 'text-xs font-medium text-foreground';
  label.textContent = control.label;

  const row = document.createElement('div');
  row.className = 'flex items-center gap-2';

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'shadcn-range';
  input.min = String(control.min ?? 0);
  input.max = String(control.max ?? 0);
  input.step = String(control.step ?? 1);
  input.value = Number.isFinite(Number(value)) ? String(value) : String(control.min ?? 0);

  const output = document.createElement('output');
  output.textContent = formatOptionValue(input.value, control.integer ? 0 : 2);

  const fieldHelp = document.createElement('span');
  fieldHelp.className = 'min-w-[3.5rem] text-right text-xs text-muted-foreground';
  fieldHelp.appendChild(output);

  input.addEventListener('input', () => {
    output.textContent = formatOptionValue(input.value, control.integer ? 0 : 2);
  });

  row.appendChild(input);
  row.appendChild(fieldHelp);
  container.append(label, row);
  optionInputMap.set(control.key, input);

  return container;
}

function createNumberField(control, value) {
  const container = document.createElement('div');
  container.className =
    'shadcn-control rounded-lg border border-input bg-background/40 p-2.5 flex flex-col gap-1.5';

  const label = document.createElement('label');
  label.className = 'text-xs font-medium text-foreground';
  label.textContent = control.label;

  const input = document.createElement('input');
  input.type = 'number';
  input.className =
    'h-9 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring shadcn-input';
  input.value = Number.isFinite(Number(value)) ? String(value) : '';
  if (control.integer) {
    input.step = '1';
  }

  container.append(label, input);
  optionInputMap.set(control.key, input);
  return container;
}

function createTextField(control, value) {
  const container = document.createElement('div');
  container.className =
    'shadcn-control rounded-lg border border-input bg-background/40 p-2.5 flex flex-col gap-1.5';

  const label = document.createElement('label');
  label.className = 'text-xs font-medium text-foreground';
  label.textContent = control.label;

  const input = document.createElement('input');
  input.type = 'text';
  input.className =
    'h-9 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring shadcn-input';
  input.placeholder = control.placeholder || '';
  input.value = value == null ? '' : String(value);

  container.append(label, input);
  optionInputMap.set(control.key, input);
  return container;
}

function createSelectField(control, value) {
  const container = document.createElement('div');
  container.className =
    'shadcn-control rounded-lg border border-input bg-background/40 p-2.5 flex flex-col gap-1.5';

  const label = document.createElement('label');
  label.className = 'text-xs font-medium text-foreground';
  label.textContent = control.label;

  const select = document.createElement('select');
  select.className =
    'shadcn-select shadcn-input h-9 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring';
  control.options.forEach((option) => {
    const item = document.createElement('option');
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  });
  if (value === '') {
    select.value = '';
  } else {
    select.value = String(value);
  }

  container.append(label, select);
  optionInputMap.set(control.key, select);
  return container;
}

function createCheckboxField(control, value) {
  const container = document.createElement('label');
  container.className =
    'shadcn-checkbox rounded-lg border border-input bg-background/40 px-3 py-2.5 flex items-center gap-2 text-sm text-foreground';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  input.checked = Boolean(value);

  const label = document.createElement('span');
  label.textContent = control.label;

  container.append(input, label);
  optionInputMap.set(control.key, input);
  return container;
}

function createCheckboxGroupField(control, value) {
  const container = document.createElement('fieldset');
  container.className =
    'shadcn-checkbox-group rounded-lg border border-input bg-background/40 p-2.5 flex flex-col gap-2 text-sm text-foreground';

  const legend = document.createElement('legend');
  legend.className = 'px-1 text-xs font-medium text-foreground';
  legend.textContent = control.label;
  container.appendChild(legend);

  const inputs = [];
  (control.options || []).forEach((item) => {
    const row = document.createElement('label');
    row.className = 'inline-flex items-center gap-2';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className =
      'h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
    input.value = item.value;
    input.checked = Array.isArray(value) ? value.includes(item.value) : false;

    const text = document.createElement('span');
    text.textContent = item.label;

    row.append(input, text);
    container.appendChild(row);
    inputs.push(input);
  });

  optionInputMap.set(control.key, { inputs });
  return container;
}

function createJsonField(control, value) {
  const container = document.createElement('div');
  container.className =
    'shadcn-control rounded-lg border border-input bg-background/40 p-2.5 flex flex-col gap-1.5';

  const label = document.createElement('label');
  label.className = 'text-xs font-medium text-foreground';
  label.textContent = control.label;

  const textarea = document.createElement('textarea');
  textarea.rows = 3;
  textarea.className =
    'shadcn-textarea w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring';
  textarea.placeholder = control.placeholder || '';
  textarea.value = JSON.stringify(value || {}, null, 2);

  container.append(label, textarea);
  optionInputMap.set(control.key, textarea);
  return container;
}

function buildOptionFields() {
  if (!optionsFieldsEl || typeof optionsFieldsEl.innerHTML === 'undefined') {
    return;
  }

  optionInputMap = new Map();
  optionsFieldsEl.innerHTML = '';

  OPTION_CONTROL_GROUPS.forEach((group) => {
    const section = document.createElement('fieldset');
    section.className = 'rounded-lg border border-border bg-muted/30 p-3 space-y-2';

    const legend = document.createElement('legend');
    legend.className = 'px-2 text-sm font-medium text-foreground';
    legend.textContent = group.title;
    section.appendChild(legend);

    const content = document.createElement('div');
    content.className = 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

    group.controls.forEach((control) => {
      const value = getByPath(engineOptions, control.key);
      let field = null;
      switch (control.type) {
        case 'range':
          field = createRangeField(control, value);
          break;
        case 'text':
          field = createTextField(control, value);
          break;
        case 'select':
          field = createSelectField(control, value);
          break;
        case 'checkbox':
          field = createCheckboxField(control, value);
          break;
        case 'checkbox-group':
          field = createCheckboxGroupField(control, value);
          break;
        case 'json':
          field = createJsonField(control, value);
          break;
        default:
          field = createTextField(control, value);
      }
      content.appendChild(field);
    });

    section.appendChild(content);
    optionsFieldsEl.appendChild(section);
  });
}

function cloneOptions(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneDefaultOptions() {
  return cloneOptions(DEFAULT_ENGINE_OPTIONS);
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseFastaEntries(rawFasta) {
  if (!rawFasta) {
    return [];
  }

  const entries = [];
  const lines = rawFasta.split(/\r?\n/);
  let currentHeader = null;
  let sequenceLines = [];

  const flushCurrent = () => {
    if (!currentHeader) {
      return;
    }
    const sequence = sequenceLines.join('').replace(/\s+/g, '');
    if (sequence.length > 0) {
      entries.push({
        header: currentHeader,
        sequence,
      });
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed.startsWith('>')) {
      flushCurrent();
      currentHeader = trimmed.replace(/^>\s*/, '');
      sequenceLines = [];
      return;
    }
    if (currentHeader) {
      sequenceLines.push(trimmed);
    }
  });

  flushCurrent();
  return entries;
}

function buildFastaFromEntries(entries) {
  return entries.map((entry) => `>${entry.header}\n${entry.sequence}\n`).join('\n');
}

function makeSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function sampleFastaEntries(entries, targetCount) {
  if (!Array.isArray(entries) || entries.length <= targetCount) {
    return entries.slice();
  }

  const sampled = entries.slice();
  const seed = (entries.length * 16777619 + targetCount * 37) >>> 0;
  const random = makeSeededRandom(seed);

  for (let idx = sampled.length - 1; idx > 0; idx -= 1) {
    const swapIndex = Math.floor(random() * (idx + 1));
    const value = sampled[idx];
    sampled[idx] = sampled[swapIndex];
    sampled[swapIndex] = value;
  }

  return sampled.slice(0, targetCount);
}

function prepareFastaForEngine(rawFasta, sampleSize) {
  const entries = parseFastaEntries(rawFasta);
  if (!entries.length) {
    return {
      fastaText: '',
      sourceProteinCount: 0,
      loadedProteinCount: 0,
      sampled: false,
      sampleSizeRequested: sampleSize,
      source: 'empty',
    };
  }

  const sourceProteinCount = entries.length;
  const targetCount = sampleSize > 0 ? Math.min(sampleSize, sourceProteinCount) : sourceProteinCount;
  const shouldSample = sampleSize > 0 && sourceProteinCount > sampleSize;
  const selectedEntries = shouldSample ? sampleFastaEntries(entries, targetCount) : entries;

  return {
    fastaText: buildFastaFromEntries(selectedEntries),
    sourceProteinCount,
    loadedProteinCount: targetCount,
    sampled: shouldSample,
    sampleSizeRequested: sampleSize,
  };
}

function prepareMiniPlusExtraFastaForEngine(miniRawFasta, extraRawFasta, extraCount) {
  const miniEntries = parseFastaEntries(miniRawFasta);
  if (!miniEntries.length) {
    return {
      fastaText: '',
      source: `mini missing (${MINI_FASTA_URL})`,
      miniSourceProteinCount: 0,
      extraSourceProteinCount: 0,
      extraCandidateCount: 0,
      loadedMiniCount: 0,
      loadedExtraCount: 0,
      loadedProteinCount: 0,
      sourceProteinCount: 0,
      sampled: false,
      sampleSizeRequested: 0,
      combined: true,
    };
  }

  const extraEntries = parseFastaEntries(extraRawFasta || '');
  const seenHeaders = new Set(miniEntries.map((entry) => entry.header));
  const extraCandidates = extraEntries.filter((entry) => !seenHeaders.has(entry.header));

  const targetExtra = extraCount > 0 ? Math.min(extraCount, extraCandidates.length) : 0;
  const selectedExtraEntries = targetExtra > 0 ? sampleFastaEntries(extraCandidates, targetExtra) : [];
  const shouldSampleExtras = targetExtra > 0 && targetExtra < extraCandidates.length;

  const combinedEntries = miniEntries.concat(selectedExtraEntries);

  return {
    fastaText: buildFastaFromEntries(combinedEntries),
    source: `${MINI_FASTA_URL} + ${EXTRA_FASTA_URL}`,
    miniSourceProteinCount: miniEntries.length,
    extraSourceProteinCount: extraEntries.length,
    extraCandidateCount: extraCandidates.length,
    loadedMiniCount: miniEntries.length,
    loadedExtraCount: selectedExtraEntries.length,
    loadedProteinCount: combinedEntries.length,
    sourceProteinCount: miniEntries.length + extraEntries.length,
    sampled: shouldSampleExtras,
    sampleSizeRequested: targetExtra,
    combined: true,
  };
}

function normalizeKind(kind) {
  if (!kind) return '';
  return String(kind).toLowerCase();
}

function normalizeIonKind(rawKind) {
  if (!rawKind) return '';
  const normalized = String(rawKind).trim().toLowerCase();
  const match = normalized.match(/^[abcxyz]/);
  return match ? match[0] : normalized;
}

function buildEngineOptionsFromPxdConfig(config) {
  if (!config || typeof config !== 'object') {
    return null;
  }

  const options = cloneDefaultOptions();
  const db = config.database || {};

  const precursorPpm = config.precursor_tol && Array.isArray(config.precursor_tol.ppm) ? config.precursor_tol.ppm : null;
  if (precursorPpm && precursorPpm.length >= 2) {
    const lo = toFiniteNumber(precursorPpm[0], options.precursorToleranceLoPpm);
    const hi = toFiniteNumber(precursorPpm[1], options.precursorToleranceHiPpm);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      options.precursorToleranceLoPpm = lo;
      options.precursorToleranceHiPpm = hi;
    }
  }

  const fragmentPpm = config.fragment_tol && Array.isArray(config.fragment_tol.ppm) ? config.fragment_tol.ppm : null;
  if (fragmentPpm && fragmentPpm.length >= 2) {
    const lo = toFiniteNumber(fragmentPpm[0], options.fragmentToleranceLoPpm);
    const hi = toFiniteNumber(fragmentPpm[1], options.fragmentToleranceHiPpm);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      options.fragmentToleranceLoPpm = lo;
      options.fragmentToleranceHiPpm = hi;
    }
  }

  const isotopeErrors = Array.isArray(config.isotope_errors) ? config.isotope_errors : null;
  if (isotopeErrors && isotopeErrors.length >= 2) {
    const lo = toFiniteNumber(isotopeErrors[0], options.minIsotopeError);
    const hi = toFiniteNumber(isotopeErrors[1], options.maxIsotopeError);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      options.minIsotopeError = lo;
      options.maxIsotopeError = hi;
    }
  }

  const reportPsms = toFiniteNumber(config.report_psms, options.reportPsms);
  if (Number.isFinite(reportPsms) && reportPsms > 0) {
    options.reportPsms = Math.floor(reportPsms);
  }

  const maxFragCharge = toFiniteNumber(config.max_fragment_charge, options.maxFragmentCharge);
  if (Number.isFinite(maxFragCharge) && maxFragCharge >= 1) {
    options.maxFragmentCharge = maxFragCharge;
  }

  const topLevelIntProps = {
    min_peaks: 'minPeaks',
    max_peaks: 'maxPeaks',
    min_matched_peaks: 'minMatchedPeaks',
    min_precursor_mass: 'minPrecursorMass',
    max_precursor_mass: 'maxPrecursorMass',
    min_precursor_charge: 'minPrecursorCharge',
    max_precursor_charge: 'maxPrecursorCharge',
  };

  Object.entries(topLevelIntProps).forEach(([jsonName, optionName]) => {
    const value = toFiniteNumber(config[jsonName], options[optionName]);
    if (Number.isFinite(value)) {
      options[optionName] = value;
    }
  });

  const dbIntProps = {
    minPeaks: 'minPeaks',
    maxPeaks: 'maxPeaks',
    minMatchedPeaks: 'minMatchedPeaks',
    maxFragmentMass: 'maxFragmentMass',
    minFragmentMass: 'minFragmentMass',
    maxPrecursorMass: 'maxPrecursorMass',
    minPrecursorMass: 'minPrecursorMass',
    peptideMinMass: 'peptideMinMass',
    peptideMaxMass: 'peptideMaxMass',
    minPrecursorCharge: 'minPrecursorCharge',
    maxPrecursorCharge: 'maxPrecursorCharge',
    minIonIndex: 'minIonIndex',
    maxVariableMods: 'maxVariableMods',
    bucketSize: 'bucketSize',
    minFragmentMz: 'minFragmentMz',
  };

  Object.entries(dbIntProps).forEach(([jsonName, optionName]) => {
    const raw = db[jsonName];
    const value = toFiniteNumber(raw, options[optionName]);
    if (Number.isFinite(value)) {
      options[optionName] = value;
    }
  });

  if (db.peptide_min_mass !== undefined) {
    const value = toFiniteNumber(db.peptide_min_mass, options.peptideMinMass);
    if (Number.isFinite(value)) options.peptideMinMass = value;
  }
  if (db.peptide_max_mass !== undefined) {
    const value = toFiniteNumber(db.peptide_max_mass, options.peptideMaxMass);
    if (Number.isFinite(value)) options.peptideMaxMass = value;
  }

  if (typeof db.deisotope === 'boolean') {
    options.deisotope = db.deisotope;
  }
  if (db.decoy_tag) {
    options.decoyTag = String(db.decoy_tag);
  }
  if (typeof db.generate_decoys === 'boolean') {
    options.generateDecoys = db.generate_decoys;
  }
  if (db.min_ion_index !== undefined) {
    const minIonIndex = toFiniteNumber(db.min_ion_index, options.minIonIndex);
    if (Number.isFinite(minIonIndex)) options.minIonIndex = minIonIndex;
  }
  if (db.max_variable_mods !== undefined) {
    const maxMods = toFiniteNumber(db.max_variable_mods, options.maxVariableMods);
    if (Number.isFinite(maxMods)) options.maxVariableMods = maxMods;
  }

  if (Array.isArray(db.ion_kinds) && db.ion_kinds.length) {
    const kinds = db.ion_kinds
      .map((kind) => normalizeKind(kind))
      .filter((kind) => kind === 'a' || kind === 'b' || kind === 'c' || kind === 'x' || kind === 'y' || kind === 'z');
    if (kinds.length) {
      options.ionKinds = kinds;
    }
  }

  if (db.static_mods && typeof db.static_mods === 'object') {
    const staticMods = {};
    Object.entries(db.static_mods).forEach(([key, value]) => {
      const mass = toFiniteNumber(value, null);
      if (key && Number.isFinite(mass)) {
        staticMods[key] = mass;
      }
    });
    if (Object.keys(staticMods).length) {
      options.staticMods = staticMods;
    }
  }

  if (db.variable_mods && typeof db.variable_mods === 'object') {
    const variableMods = {};
    Object.entries(db.variable_mods).forEach(([key, values]) => {
      if (!key || !Array.isArray(values)) {
        return;
      }
      const parsed = values
        .map((value) => toFiniteNumber(value, null))
        .filter((value) => Number.isFinite(value));
      if (parsed.length) {
        variableMods[key] = parsed;
      }
    });
    if (Object.keys(variableMods).length) {
      options.variableMods = variableMods;
    }
  }

  if (db.enzyme && typeof db.enzyme === 'object') {
    options.enzyme = {
      missed_cleavages: toFiniteNumber(db.enzyme.missed_cleavages, options.enzyme.missed_cleavages),
      min_len: toFiniteNumber(db.enzyme.min_len, options.enzyme.min_len),
      max_len: toFiniteNumber(db.enzyme.max_len, options.enzyme.max_len),
      cleave_at: db.enzyme.cleave_at || options.enzyme.cleave_at,
      restrict: db.enzyme.restrict || options.enzyme.restrict,
      c_terminal: typeof db.enzyme.c_terminal === 'boolean' ? db.enzyme.c_terminal : options.enzyme.c_terminal,
      semi_enzymatic:
        typeof db.enzyme.semi_enzymatic === 'boolean' ? db.enzyme.semi_enzymatic : options.enzyme.semi_enzymatic,
    };
  }

  return options;
}

function setStatus(text) {
  statusEl.textContent = text;
}

async function loadDemoData() {
  const response = await fetch(DATASET_URL);
  if (!response.ok) {
    throw new Error(`Could not load ${DATASET_URL}: ${response.status}`);
  }
  return response.json();
}

async function loadFastaText() {
  const [miniResponse, extraResponse] = await Promise.all([fetch(MINI_FASTA_URL), fetch(EXTRA_FASTA_URL)]);
  if (!miniResponse.ok) {
    throw new Error(`Could not load ${MINI_FASTA_URL}: ${miniResponse.status}`);
  }

  const miniRawFasta = await miniResponse.text();
  const requestedExtraCount = FASTA_EXTRA_COUNT;
  if (!extraResponse.ok) {
    const prepared = prepareFastaForEngine(miniRawFasta, 0);
    fastaBuildInfo = {
      ...prepared,
      source: `fallback to ${MINI_FASTA_URL} only (extra FASTA unavailable)`,
      sampleSizeRequested: requestedExtraCount,
      sampled: false,
      sourceProteinCount: prepared.sourceProteinCount,
      miniSourceProteinCount: prepared.sourceProteinCount,
      extraSourceProteinCount: 0,
      extraCandidateCount: 0,
      loadedMiniCount: prepared.loadedProteinCount,
      loadedExtraCount: 0,
      combined: false,
    };
    return prepared.fastaText;
  }

  const extraRawFasta = await extraResponse.text();
  const prepared = prepareMiniPlusExtraFastaForEngine(miniRawFasta, extraRawFasta, requestedExtraCount);
  fastaBuildInfo = {
    ...prepared,
    sampleSizeRequested: requestedExtraCount,
  };
  return prepared.fastaText;
}

async function loadEngineOptionsFromFile() {
  const response = await fetch(CONFIG_URL);
  if (!response.ok) {
    throw new Error(`Could not load ${CONFIG_URL}: ${response.status}`);
  }
  return response.json();
}

function buildSingleQueryPayload(query) {
  return {
    id: query.id,
    precursorMz: Number(query.precursorMz),
    precursorCharge: Number(query.precursorCharge),
    peaks: query.peaks
      .map((peak) => ({
        mz: Number(peak.mz),
        intensity: Number(peak.intensity),
      }))
      .filter((peak) => Number.isFinite(peak.mz) && Number.isFinite(peak.intensity)),
  };
}

function svg(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([name, value]) => {
    el.setAttribute(name, String(value));
  });
  return el;
}

function isQuerySearching(queryId) {
  if (!queryId) return false;
  const inFlight = searchInFlight.get(queryId);
  if (!inFlight) return false;
  return searchTokensByQueryId.get(queryId) === inFlight.token;
}

function createSpectrumChart(query) {
  const peaks = query.peaks
    .map((peak) => ({ mz: Number(peak.mz), intensity: Number(peak.intensity) }))
    .filter((peak) => Number.isFinite(peak.mz) && Number.isFinite(peak.intensity))
    .sort((a, b) => a.mz - b.mz);

  const width = Math.min(1200, Math.max(900, Math.floor(window.innerWidth * 0.82)));
  const height = 260;
  const margin = { left: 45, right: 20, top: 10, bottom: 26 };
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const plotHeight = Math.max(1, height - margin.top - margin.bottom);

  const maxIntensity = Math.max(1e-8, ...peaks.map((p) => p.intensity));
  const minMz = AXIS_MIN_MZ;
  const maxMz = Math.max(AXIS_MAX_MZ, minMz + 1);

  const toX = (mz) => margin.left + ((mz - minMz) / (maxMz - minMz)) * plotWidth;
  const toY = (intensity) => margin.top + plotHeight * (1 - intensity / maxIntensity);

  const svgEl = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    xmlns: 'http://www.w3.org/2000/svg',
    class: 'spectrum-svg',
  });

  const baselineY = toY(0);
  svgEl.appendChild(
    svg('line', {
      x1: margin.left,
      y1: baselineY,
      x2: width - margin.right,
      y2: baselineY,
      class: 'baseline',
    }),
  );

  peaks.forEach((peak) => {
    const x = toX(peak.mz);
    if (x < margin.left - 1 || x > width - margin.right + 1) {
      return;
    }

    const y = toY(peak.intensity);
    svgEl.appendChild(
      svg('line', {
        x1: x,
        y1: baselineY,
        x2: x,
        y2: y,
        class: 'peak-stick',
      }),
    );
  });

  const yAxisLabel = `${peaks.length} peaks`;
  svgEl.appendChild(
    svg('text', {
      x: width - 8,
      y: margin.top + 14,
      class: 'axis-label',
    }),
  ).textContent = yAxisLabel;

  const xTicks = 6;
  for (let idx = 0; idx <= xTicks; idx += 1) {
    const mz = minMz + ((maxMz - minMz) * idx) / xTicks;
    const x = toX(mz);
    svgEl.appendChild(
      svg('line', {
        x1: x,
        y1: baselineY,
        x2: x,
        y2: baselineY + 6,
        class: 'axis-tick',
      }),
    );
    svgEl.appendChild(
      svg('text', {
        x,
        y: baselineY + 20,
        class: 'axis-label',
      }),
    ).textContent = mz.toFixed(0);
  }

  return {
    element: svgEl,
    query,
    peaks,
    width,
    height,
    margin,
    toX,
    toY,
    maxIntensity,
    baselineY,
    plotHeight,
  };
}

function clearAnnotations(state) {
  if (!state || !state.annotationGroup) return;
  while (state.annotationGroup.firstChild) {
    state.annotationGroup.removeChild(state.annotationGroup.firstChild);
  }
}

function annotateSpectrum(state, hit) {
  if (!state) return;
  if (!state.annotationGroup) {
    state.annotationGroup = svg('g', { class: 'ion-annotation-group' });
    state.element.appendChild(state.annotationGroup);
  }
  clearAnnotations(state);

  if (!hit || !hit.matchedIons || !hit.matchedIons.length) {
    return;
  }

  hit.matchedIons.forEach((ion) => {
    const kind = normalizeIonKind(ion.kind || ion.ion || ion.type || ion.fragmentKind);
    if (kind !== 'a' && kind !== 'b' && kind !== 'c' && kind !== 'x' && kind !== 'y' && kind !== 'z') {
      return;
    }

    const mz = Number(ion.mzExperimental || ion.mzCalculated);
    if (!Number.isFinite(mz)) {
      return;
    }

    const intensity = Number(ion.intensity);
    const hasIntensity = Number.isFinite(intensity) && intensity > 0;
    const y = hasIntensity ? state.toY(intensity) : state.baselineY - state.plotHeight * 0.25;
    const x = state.toX(mz);

    if (x < state.margin.left - 1 || x > Number(state.width) - state.margin.right + 1) {
      return;
    }

    const lineClass = `ion-${kind}-line`;
    const labelClass = `ion-${kind}-label`;
    state.annotationGroup.appendChild(
      svg('line', {
        x1: x,
        x2: x,
        y1: state.baselineY,
        y2: y,
        class: lineClass,
      }),
    );

    const ordinal = Number.isFinite(Number(ion.ordinal)) ? Number(ion.ordinal) : 0;
    const ionLabel = `${kind.toUpperCase()}_${ordinal}`;
    const charge = Number.isFinite(Number(ion.charge)) && ion.charge > 0 ? `${ion.charge}+` : '';
    state.annotationGroup.appendChild(
      svg('text', {
        x: x + 3,
        y: Math.max(state.margin.top + 12, y - 4),
        class: `ion-label ${labelClass}`,
      }),
    ).textContent = `${ionLabel}${charge ? ` (${charge})` : ''}`;
  });
}

function createHitsTable(result, chartState) {
  const table = document.createElement('table');
  const hits = Array.isArray(result?.hits) ? result.hits.slice(0, 10) : [];
  table.className = 'shadcn-table w-full text-sm';

  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  [
    'Rank',
    'Target/Decoy',
    'Peptide',
    'Hyperscore',
    'Δmass',
    'Matched Peaks',
    'Matched Intensity %',
  ].forEach((label) => {
    const th = document.createElement('th');
    th.className = 'shadcn-table-head px-3 py-2 text-left text-xs font-semibold text-muted-foreground';
    th.textContent = label;
    headerRow.appendChild(th);
  });
  head.appendChild(headerRow);
  table.appendChild(head);

  const body = document.createElement('tbody');

  if (!hits.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'px-3 py-2 text-sm text-muted-foreground';
    cell.colSpan = 7;
    if (!result) {
      const autoSearchEnabled = chartState?.autoSearchEnabled;
      const queryId = chartState?.queryId;
      const isSearching = queryId ? isQuerySearching(queryId) : false;
      const queryError = queryId ? searchErrorByQueryId.get(queryId) : null;

      if (queryError) {
        cell.textContent = `Search failed for this spectrum: ${queryError}`;
      } else if (isSearching) {
        cell.innerHTML = `
          <span class="inline-spinner" aria-hidden="true"></span>
          Searching live matches...
        `;
      } else if (autoSearchEnabled === false) {
        cell.textContent = 'Click Search current spectrum to run live matching.';
      } else {
        cell.textContent = 'No matches met thresholds for this spectrum.';
      }
    } else {
      cell.textContent = 'No matches met thresholds for this spectrum.';
    }
    row.appendChild(cell);
    body.appendChild(row);
  } else {
    hits.forEach((hit, idx) => {
      const row = document.createElement('tr');
      const label = hit.label === 1 ? 'Target' : 'Decoy';
      row.dataset.hitIndex = String(idx);
      row.className = 'shadcn-table-row';

      const rank = document.createElement('td');
      rank.className = 'px-3 py-2';
      rank.textContent = hit.rank;
      row.appendChild(rank);

      const target = document.createElement('td');
      target.className = 'px-3 py-2';
      const labelBadge = createStatusBadge(label, label === 'Target' ? 'target' : 'decoy');
      target.appendChild(labelBadge);
      row.appendChild(target);

      const peptide = document.createElement('td');
      peptide.className = 'px-3 py-2';
      const peptideCode = document.createElement('code');
      peptideCode.className = 'rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground';
      peptideCode.textContent = hit.peptide;
      peptide.appendChild(peptideCode);
      row.appendChild(peptide);

      const hyperscore = document.createElement('td');
      hyperscore.className = 'px-3 py-2';
      hyperscore.textContent = hit.score.toFixed(3);
      row.appendChild(hyperscore);

      const deltaMass = document.createElement('td');
      deltaMass.className = 'px-3 py-2';
      deltaMass.textContent = hit.deltaMass.toFixed(4);
      row.appendChild(deltaMass);

      const matchedPeaks = document.createElement('td');
      matchedPeaks.className = 'px-3 py-2';
      matchedPeaks.textContent = hit.matchedPeaks;
      row.appendChild(matchedPeaks);

      const matchedIntensity = document.createElement('td');
      matchedIntensity.className = 'px-3 py-2';
      matchedIntensity.textContent = `${hit.matchedIntensityPct.toFixed(2)}%`;
      row.appendChild(matchedIntensity);

      row.addEventListener('click', () => {
        const siblings = row.parentNode.querySelectorAll('tr');
        siblings.forEach((element) => element.classList.remove('shadcn-table-row-active'));
        row.classList.add('shadcn-table-row-active');
        annotateSpectrum(chartState, hit);
      });

      body.appendChild(row);
      if (idx === 0) {
        row.classList.add('shadcn-table-row-active');
        requestAnimationFrame(() => annotateSpectrum(chartState, hit));
      }
    });
  }

  table.appendChild(body);
  return table;
}

function updateSpectrumPager() {
  if (!resultNavEl || !prevSpectrumButton || !nextSpectrumButton || !spectrumCounterEl) {
    return;
  }

  const totalQueries = demoDataset && Array.isArray(demoDataset.queries) ? demoDataset.queries.length : 0;
  if (!totalQueries) {
    resultNavEl.hidden = true;
    return;
  }

  resultNavEl.hidden = false;
  prevSpectrumButton.disabled = currentResultIndex <= 0;
  nextSpectrumButton.disabled = currentResultIndex >= totalQueries - 1;
  spectrumCounterEl.textContent = `Spectrum ${currentResultIndex + 1} of ${totalQueries}`;
}

function renderCurrentResult(autoSearch = false) {
  resultsEl.innerHTML = '';
  chartByQuery.clear();

  if (!demoDataset || !Array.isArray(demoDataset.queries) || demoDataset.queries.length === 0) {
    updateSpectrumPager();
    return;
  }

  const query = demoDataset.queries[currentResultIndex];
  if (!query) {
    setStatus('Loaded dataset has no valid query index.');
    return;
  }

  const result = autoSearch ? null : searchResultByQueryId.get(query.id);
  const card = renderResultCard(query, result, autoSearch);
  if (card) {
    resultsEl.appendChild(card);
  }

  updateSpectrumPager();

  if (
    autoSearch &&
    !searchInFlight.has(query.id)
  ) {
    const requestId = ++renderEpoch;
    void runSearchForQuery(query, true)
      .then(() => {
        if (requestId !== renderEpoch) {
          return;
        }
        renderCurrentResult(false);
      })
      .catch(() => {
        if (requestId === renderEpoch) {
          renderCurrentResult(false);
        }
      });
    setStatus(`Searching spectrum ${currentResultIndex + 1} of ${demoDataset.queries.length}...`);
  }
}

function goToSpectrum(index) {
  if (!demoDataset || !Array.isArray(demoDataset.queries) || demoDataset.queries.length === 0) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(demoDataset.queries.length - 1, Number(index) || 0));
  if (nextIndex === currentResultIndex) {
    return;
  }

  const query = demoDataset.queries[nextIndex];
  if (query?.id) {
    searchResultByQueryId.delete(query.id);
    searchErrorByQueryId.delete(query.id);
  }

  currentResultIndex = nextIndex;
  renderEpoch += 1;
  renderCurrentResult(true);
}

function handleSpectrumStep(delta) {
  if (!demoDataset || !Array.isArray(demoDataset.queries) || demoDataset.queries.length === 0) {
    return;
  }
  goToSpectrum(currentResultIndex + delta);
}

function isTextInputTarget(target) {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function renderResultCard(query, result, autoSearch = false) {
  if (!query) return null;

  const card = document.createElement('section');
  card.className =
    'shadcn-result-card rounded-lg border border-border bg-card p-4 shadow-sm text-card-foreground space-y-3';

  const head = document.createElement('div');
  head.className = 'flex flex-wrap items-start justify-between gap-2';
  const title = document.createElement('h3');
  title.className = 'text-sm font-semibold';
  title.textContent = query.sourceName;
  head.appendChild(title);

  const chips = document.createElement('div');
  chips.className = 'flex flex-wrap items-center gap-1.5';
  chips.appendChild(createStatusBadge(`Charge +${query.precursorCharge}`, 'default'));
  chips.appendChild(createStatusBadge('HCD', 'default'));
  head.appendChild(chips);
  card.appendChild(head);

  const details = document.createElement('div');
  details.className = 'text-sm text-muted-foreground';
  details.textContent = `m/z ${query.precursorMz.toFixed(5)} • peaks ${query.peaks.length} • expected peptide: ${query.peptideHint || 'n/a'}`;
  card.appendChild(details);

  const chartWrap = document.createElement('div');
  chartWrap.className = 'overflow-hidden rounded-lg border border-border bg-background p-2';
  const state = createSpectrumChart(query);
  state.queryId = query.id;
  chartWrap.appendChild(state.element);
  card.appendChild(chartWrap);
  chartByQuery.set(query.id, state);

  const hitsArea = document.createElement('div');
  const table = createHitsTable(result, { ...state, autoSearchEnabled: autoSearch });
  hitsArea.appendChild(table);
  card.appendChild(hitsArea);

  return card;
}

async function runSearch() {
  if (!demoDataset || !Array.isArray(demoDataset.queries) || demoDataset.queries.length === 0) {
    return;
  }

  const query = demoDataset.queries[currentResultIndex];
  if (!query) {
    return;
  }

  try {
    await runSearchForQuery(query, true);
    renderCurrentResult(true);
  } catch (error) {
    setStatus(`Search failed: ${error.message}`);
    console.error(error);
  }
}
async function runSearchForQuery(query, force = false) {
  const queryId = query?.id;
  if (!queryId || !window.sageEngine) {
    throw new Error('Search engine not ready.');
  }

  if (!force && searchResultByQueryId.has(queryId)) {
    return searchResultByQueryId.get(queryId);
  }

  const currentToken = searchTokensByQueryId.get(queryId);
  const inFlight = searchInFlight.get(queryId);
  if (!force && inFlight && currentToken === inFlight.token) {
    return inFlight.promise;
  }
  if (inFlight && inFlight.token !== currentToken) {
    searchInFlight.delete(queryId);
  }

  if (force) {
    searchResultByQueryId.delete(queryId);
    searchErrorByQueryId.delete(queryId);
  }

  const requestToken = (currentToken || 0) + 1;
  searchTokensByQueryId.set(queryId, requestToken);
  const payload = buildSingleQueryPayload(query);
  const request = (async () => {
    const activeToken = searchTokensByQueryId.get(queryId);
    if (activeToken !== requestToken) {
      return null;
    }

    const response = await window.sageEngine.search_one(JSON.stringify(payload));
    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Search response was empty');
    }

    const result = parsed[0];
    if (searchTokensByQueryId.get(queryId) !== requestToken) {
      return null;
    }

    result.queryId = result.queryId || queryId;
    searchResultByQueryId.set(queryId, result);
    searchErrorByQueryId.delete(queryId);
    return result;
  })();

  searchInFlight.set(queryId, { token: requestToken, promise: request });

  try {
    const result = await request;
    if (result === null) {
      throw new Error('Search request was superseded.');
    }
    return result;
  } catch (error) {
    if (searchTokensByQueryId.get(queryId) === requestToken) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== 'Search request was superseded.') {
        searchErrorByQueryId.set(queryId, message);
      }
    }
    throw error;
  } finally {
    if (searchInFlight.get(queryId)?.token === requestToken) {
      searchInFlight.delete(queryId);
    }
  }
}


function formatFastaSummary(info) {
  if (!info || !info.loadedProteinCount) {
    return '';
  }

  if (info.combined) {
    const miniCount = info.loadedMiniCount || 0;
    const miniTotal = info.miniSourceProteinCount || 0;
    const extraLoaded = info.loadedExtraCount || 0;
    const extraTotal = info.extraCandidateCount || 0;
    const extraTarget = info.sampleSizeRequested || 0;
    if (info.sampled) {
      return `${miniCount}/${miniTotal} mini proteins + ${extraLoaded}/${extraTarget} extras sampled from ${extraTotal} candidates`;
    }
    if (extraLoaded) {
      return `${miniCount} mini proteins + ${extraLoaded} extras loaded (from ${extraTotal} candidates)`;
    }
    return `${miniCount} mini proteins loaded`;
  }

  if (info.sampled) {
    return `${info.loadedProteinCount}/${info.sourceProteinCount} proteins sampled (target ${info.sampleSizeRequested})`;
  }

  if (info.sampleSizeRequested > 0 && info.sourceProteinCount > 0) {
    return `${info.loadedProteinCount} proteins loaded (sample target ${info.sampleSizeRequested})`;
  }

  return `${info.loadedProteinCount} proteins loaded`;
}


async function main() {
  const initialTheme = getInitialTheme();
  setTheme(initialTheme);
  setStatus('Loading dataset and initialising WASM engine...');
  try {
    const [dataset, preparedFasta] = await Promise.all([loadDemoData(), loadFastaText()]);
    fastaText = preparedFasta;
    let configuredOptions = null;
    try {
      configuredOptions = await loadEngineOptionsFromFile();
    } catch (error) {
      console.warn('Falling back to embedded engine defaults.', error);
      setStatus(`Could not load ${CONFIG_URL}. Using defaults.`);
    }

    if (configuredOptions) {
      const mapped = buildEngineOptionsFromPxdConfig(configuredOptions);
      if (mapped) {
        engineOptions = mapped;
      }
    }
    loadedEngineOptions = cloneOptions(engineOptions);
    buildOptionFields();
    setOptionStatus(
      `Loaded ${configuredOptions ? 'PXD003881.json' : 'embedded defaults'} for full option coverage.`,
    );

    demoDataset = dataset;
    clearSearchState();

    if (datasetLabelEl) {
      let fastaLabel = `FASTA: ${fastaBuildInfo?.source || dataset.fastaSource || MINI_FASTA_URL}`;
      if (fastaBuildInfo?.combined) {
        const miniCount = fastaBuildInfo.loadedMiniCount || 0;
        const miniTotal = fastaBuildInfo.miniSourceProteinCount || 0;
        const extrasLoaded = fastaBuildInfo.loadedExtraCount || 0;
        const extraTarget = fastaBuildInfo.sampleSizeRequested || 0;
        if (extrasLoaded > 0) {
          const sampledText = fastaBuildInfo.sampled ? ` + ${extrasLoaded}/${extraTarget} sampled` : ` + ${extrasLoaded} added`;
          fastaLabel = `FASTA: mini (${miniCount}/${miniTotal}) + extra (${sampledText} proteins from ${EXTRA_FASTA_URL})`;
        }
      } else if (fastaBuildInfo?.sampled) {
        fastaLabel = `FASTA: ${fastaBuildInfo.source} (${fastaBuildInfo.loadedProteinCount}/${fastaBuildInfo.sourceProteinCount} proteins sampled)`;
      }
      datasetLabelEl.textContent = fastaLabel;
    }

    await init();
    window.sageEngine = new SearchEngine(fastaText, JSON.stringify(engineOptions));
    setStatus(
      `Ready. Loaded ${dataset.queries.length} spectrum(s). Using ${
        configuredOptions ? 'PXD003881.json' : 'embedded defaults'
      }.`,
    );
    setPanelEnabled(true);
    if (dataset.queries.length) {
      renderCurrentResult(true);
    }
  } catch (error) {
    setStatus(`Startup error: ${error.message}`);
    console.error(error);
  }

  const handleApplyOptions = async () => {
    if (!demoDataset || !fastaText || !window.sageEngine) {
      setOptionStatus('Engine not ready.');
      return;
    }

    let next = null;
    try {
      next = readControlsAsOptions();
    } catch (error) {
      setOptionStatus(`Invalid options: ${error.message}`);
      return;
    }

    if (optionsEqual(next, engineOptions)) {
      setOptionStatus('No option changes to apply.');
      return;
    }

    setPanelEnabled(false);
    setStatus('Applying options and rebuilding search engine...');
    setOptionStatus('Applying options...');
    try {
      const nextEngine = new SearchEngine(fastaText, JSON.stringify(next));
      window.sageEngine = nextEngine;
      engineOptions = next;
      clearSearchState();
      renderEpoch += 1;
      setOptionStatus('Options applied. Searching current spectrum.');
      renderCurrentResult(true);
      if (demoDataset?.queries?.length) {
        setStatus(`Ready with ${demoDataset.queries.length} spectrum(s).`);
      }
    } catch (error) {
      setOptionStatus(`Apply failed: ${error.message}`);
      setStatus(`Could not apply options: ${error.message}`);
      console.error(error);
    } finally {
      setPanelEnabled(true);
    }
  };

  const handleResetOptions = async () => {
    engineOptions = cloneOptions(loadedEngineOptions);
    if (optionsFieldsEl) {
      applyControlsToOption(engineOptions);
    }
    await handleApplyOptions();
  };

  applyOptionsButton?.addEventListener('click', handleApplyOptions);
  resetOptionsButton?.addEventListener('click', handleResetOptions);
  themeToggleButton?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const nextTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    setTheme(nextTheme);
  });

  if (prevSpectrumButton) {
    prevSpectrumButton.addEventListener('click', () => {
      handleSpectrumStep(-1);
    });
  }

  if (nextSpectrumButton) {
    nextSpectrumButton.addEventListener('click', () => {
      handleSpectrumStep(1);
    });
  }

  window.addEventListener('keydown', (event) => {
    if (!demoDataset || !Array.isArray(demoDataset.queries) || demoDataset.queries.length === 0 || isTextInputTarget(event.target)) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handleSpectrumStep(-1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleSpectrumStep(1);
    }
  });
}

main().catch((error) => {
  setStatus(`Startup error: ${error.message}`);
  console.error(error);
});
