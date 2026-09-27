const Units = require('./js/units.js');
const { GeometryUtils, CADLine, CADRect, CADCircle, CADArc, CADPolyline, CADWindow, CADDoor, CADBalcony } = require('./js/cad/geometry.js');
const { CADToolManager } = require('./js/cad/tools.js');
const { CADCommandLine } = require('./js/cad/commandline.js');
const assert = require('assert');

console.log('====================================================');
console.log('TESTING AUTOCAD CLICK-BASED DRAFTING INTERACTIONS');
console.log('====================================================\n');

// Mock DOM & Canvas for Headless Testing
class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.classList = {
      contains: (cls) => this.classes.has(cls),
      add: (cls) => this.classes.add(cls),
      remove: (cls) => this.classes.delete(cls),
      toggle: (cls, force) => force ? this.classes.add(cls) : this.classes.delete(cls)
    };
    this.classes = new Set();
    this.children = [];
    this.value = '';
    this.innerHTML = '';
    this.style = {};
    this.listeners = {};
  }

  appendChild(child) { this.children.push(child); return child; }
  querySelector(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return this.children.find(c => c.classes && c.classes.has(cls)) || null;
    }
    return null;
  }
  querySelectorAll(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return this.children.filter(c => c.classes && c.classes.has(cls));
    }
    return [];
  }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  focus() { global.document.activeElement = this; }
  select() {}
  contains(node) { return this === node || this.children.includes(node); }
}

const mockViewport = new MockElement('canvasViewport');
const mockCanvasEl = new MockElement('elevationCanvas', 'canvas');
mockCanvasEl.parentElement = mockViewport;
const mockDynContainer = new MockElement('dynamicInputContainer');

function parseHTMLToChildren(html, parent) {
  parent.children = [];
  const inputMatches = html.matchAll(/<input[^>]*id="([^"]+)"[^>]*>/g);
  for (const match of inputMatches) {
    const el = new MockElement(match[1], 'input');
    el.classes.add('dyn-input-field');
    parent.children.push(el);
  }
}

Object.defineProperty(mockDynContainer, 'innerHTML', {
  get() { return this._innerHTML || ''; },
  set(val) {
    this._innerHTML = val;
    parseHTMLToChildren(val, this);
  }
});

const registeredElements = {};

function createOrGetMockElement(id, tag = 'div') {
  if (registeredElements[id]) return registeredElements[id];
  const el = new MockElement(id, tag);
  registeredElements[id] = el;
  return el;
}

global.document = {
  createElement: (tag) => new MockElement('', tag),
  getElementById: (id) => {
    if (registeredElements[id]) return registeredElements[id];
    if (id === 'canvasViewport') return mockViewport;
    if (id === 'elevationCanvas') return mockCanvasEl;
    if (id === 'dynamicInputContainer') return mockDynContainer;
    const foundInDyn = mockDynContainer.children.find(c => c.id === id);
    if (foundInDyn) return foundInDyn;
    return createOrGetMockElement(id);
  },
  activeElement: null
};

global.window = {
  addEventListener: () => {}
};
global.Units = Units;
global.GeometryUtils = GeometryUtils;
global.CADLine = CADLine;
global.CADRect = CADRect;
global.CADCircle = CADCircle;
global.CADArc = CADArc;
global.CADPolyline = CADPolyline;
global.CADWindow = CADWindow;
global.CADDoor = CADDoor;
global.CADBalcony = CADBalcony;

class MockCADCanvas {
  constructor() {
    this.canvas = mockCanvasEl;
    this.objects = [];
    this.selectedObjects = [];
    this.activeTool = 'line';
    this.orthoLock = false;
    this.snappedWorld = { x: 0, y: 0 };
    this.cursorScreen = { x: 100, y: 100 };
  }
  addObject(obj) { this.objects.push(obj); }
  removeObject(obj) { this.objects = this.objects.filter(o => o !== obj); }
  saveState() {}
  render() {}
}

const mockCad = new MockCADCanvas();
const toolMgr = new CADToolManager(mockCad);
const cmdLine = new CADCommandLine(mockCad, toolMgr);
global.window.cadCommandLine = cmdLine;

// --- TEST 1: LINE - Click once, type 5', press Enter ---
console.log("Test 1: LINE - Click first point, type 5', Enter (No mouse drag)");
toolMgr.setTool('line');

// Mouse click 1: Fix FIRST POINT
toolMgr.handleToolMouseDown({ x: 0, y: 0 }, { button: 0 });
assert.strictEqual(toolMgr.isDrawing, true);
assert.deepStrictEqual(toolMgr.startPt, { x: 0, y: 0 });

const lenInput1 = document.getElementById('dynLenInput');
assert(lenInput1);
lenInput1.value = "5'";
lenInput1.focus();

// Mouse move should NOT overwrite focused field value
toolMgr.showDynamicInput(150, 150, 'line', { length: 8, angle: 0 });
assert.strictEqual(lenInput1.value, "5'");

toolMgr.applyDynamicInput();

assert.strictEqual(mockCad.objects.length, 1);
assert.strictEqual(mockCad.objects[0].type, 'line');
assert.strictEqual(mockCad.objects[0].x1, 0);
assert.strictEqual(mockCad.objects[0].x2, 5);
assert.strictEqual(toolMgr.startPt.x, 5);
console.log("-> PASS: Exact 5-ft line created by click + typing. Line continues automatically to (5,0).\n");


// --- TEST 2: RECTANGLE - Click once, Width = 12', Height = 8', Enter ---
console.log("Test 2: RECTANGLE - Click corner, Width = 12', Height = 8', Enter");
toolMgr.setTool('rectangle');

// Mouse click 1: Fix FIRST CORNER
toolMgr.handleToolMouseDown({ x: 20, y: 20 }, { button: 0 });
assert.strictEqual(toolMgr.isDrawing, true);

const wInput = document.getElementById('dynWidthInput');
const hInput = document.getElementById('dynHeightInput');
assert(wInput && hInput);

wInput.value = "12'";
hInput.value = "8'";

toolMgr.applyDynamicInput();

const rect = mockCad.objects.find(o => o.type === 'rectangle');
assert(rect);
assert.strictEqual(rect.width, 12);
assert.strictEqual(rect.height, 8);
assert.strictEqual(toolMgr.isDrawing, false);
console.log("-> PASS: Exact 12' x 8' rectangle created on single click + keyboard entry.\n");


// --- TEST 3: CIRCLE - Click center, Radius = 3', Enter ---
console.log("Test 3: CIRCLE - Click center, Radius = 3', Enter");
toolMgr.setTool('circle');

toolMgr.handleToolMouseDown({ x: 50, y: 50 }, { button: 0 });
assert.strictEqual(toolMgr.isDrawing, true);

const rInput = document.getElementById('dynRadiusInput');
assert(rInput);
rInput.value = "3'";

toolMgr.applyDynamicInput();

const circle = mockCad.objects.find(o => o.type === 'circle');
assert(circle);
assert.strictEqual(circle.cx, 50);
assert.strictEqual(circle.cy, 50);
assert.strictEqual(circle.radius, 3);
console.log("-> PASS: Circle radius 3 ft created accurately at (50,50).\n");


// --- TEST 4: POLYLINE & ESC CANCEL ---
console.log("Test 4: POLYLINE & ESC Cancel");
toolMgr.setTool('polyline');
toolMgr.handleToolMouseDown({ x: 0, y: 0 }, { button: 0 });
assert.strictEqual(toolMgr.isDrawing, true);

// ESC cancels current active drawing without deleting previously created objects
toolMgr.cancelDrawing();
assert.strictEqual(toolMgr.isDrawing, false);
assert.strictEqual(mockCad.objects.length, 3); // Line, Rectangle, Circle remain intact
console.log("-> PASS: ESC cancels current polyline without deleting previously committed geometry.\n");


// --- TEST 5: COMMAND SUGGESTIONS & PERSISTENT REPEAT OFFSET ---
console.log("Test 5: Command Suggestions & Persistent Repeat OFFSET");

// Test Suggestions
cmdLine.updateSuggestions('OF');
assert.strictEqual(cmdLine.filteredSuggestions.length, 1);
assert.strictEqual(cmdLine.filteredSuggestions[0].name, 'OFFSET');

cmdLine.updateSuggestions('CO');
assert.strictEqual(cmdLine.filteredSuggestions[0].name, 'COPY');

// Start OFFSET
toolMgr.setTool('offset');
assert.strictEqual(toolMgr.offsetState, 'WAITING_FOR_DISTANCE');

// Enter 9" distance
cmdLine.handleCommandStep('9"');
assert.strictEqual(toolMgr.lastOffsetDistance, 0.75);
assert.strictEqual(toolMgr.offsetState, 'SELECT_OBJECT');

// Select Line 1 (x1=0, y1=0, x2=5, y2=0)
const line1 = mockCad.objects[0];
toolMgr.handleToolMouseDown({ x: 2.5, y: 0 }, { button: 0 });
assert.strictEqual(toolMgr.offsetSourceObject, line1);
assert.strictEqual(toolMgr.offsetState, 'SELECT_SIDE');

// Click side (y = 2) to commit offset of Line 1
toolMgr.handleToolMouseDown({ x: 2.5, y: 2 }, { button: 0 });
assert.strictEqual(mockCad.objects.length, 4); // Line 1 offset created!
assert.strictEqual(toolMgr.offsetState, 'SELECT_OBJECT'); // Continuous repeat mode remains ACTIVE!

// Select Rectangle (Line 2 equivalent)
const rectObj = mockCad.objects.find(o => o.type === 'rectangle');
toolMgr.handleToolMouseDown({ x: 25, y: 25 }, { button: 0 });
assert.strictEqual(toolMgr.offsetSourceObject, rectObj);

// Click side outside to commit offset of Rectangle
toolMgr.handleToolMouseDown({ x: -2, y: -2 }, { button: 0 });
assert.strictEqual(mockCad.objects.length, 5); // Rectangle offset created!
assert.strictEqual(toolMgr.offsetState, 'SELECT_OBJECT'); // Still active!

// ESC terminates OFFSET
toolMgr.cancelDrawing();
assert.strictEqual(toolMgr.offsetState, null);
assert.strictEqual(mockCad.objects.length, 5); // Offset geometry remains intact

console.log("-> PASS: Command suggestions work, OFFSET repeats continuously across multiple objects with distance memory, and ESC exits cleanly.\n");

console.log('====================================================');
console.log('ALL AUTOCAD CLICK INTERACTION TESTS PASSED 100%!');
console.log('====================================================');
