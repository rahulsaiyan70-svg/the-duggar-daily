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
  focus() {}
  select() {}
}

const mockViewport = new MockElement('canvasViewport');
const mockCanvasEl = new MockElement('elevationCanvas', 'canvas');
mockCanvasEl.parentElement = mockViewport;

global.document = {
  createElement: (tag) => new MockElement('', tag),
  getElementById: (id) => {
    if (id === 'canvasViewport') return mockViewport;
    if (id === 'elevationCanvas') return mockCanvasEl;
    if (id === 'dynamicInputContainer') return mockDynContainer;
    return null;
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

const mockDynContainer = new MockElement('dynamicInputContainer');

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

// Type '5'' into dynamic input and press Enter
const lenInput1 = new MockElement('dynLenInput', 'input');
lenInput1.classes.add('dyn-input-field');
lenInput1.value = "5'";
mockDynContainer.children = [lenInput1];
global.document.getElementById = (id) => id === 'dynLenInput' ? lenInput1 : null;

toolMgr.applyDynamicInput();

assert.strictEqual(mockCad.objects.length, 1);
assert.strictEqual(mockCad.objects[0].type, 'line');
assert.strictEqual(mockCad.objects[0].x1, 0);
assert.strictEqual(mockCad.objects[0].x2, 5);
// Continuous LINE behavior check
assert.strictEqual(toolMgr.startPt.x, 5);
console.log("-> PASS: Exact 5-ft line created by click + typing. Line continues automatically to (5,0).\n");


// --- TEST 2: RECTANGLE - Click once, Width = 10', Height = 8', Enter ---
console.log("Test 2: RECTANGLE - Click corner, Width = 10', Height = 8', Enter");
toolMgr.setTool('rectangle');

// Mouse click 1: Fix FIRST CORNER
toolMgr.handleToolMouseDown({ x: 0, y: 0 }, { button: 0 });
assert.strictEqual(toolMgr.isDrawing, true);

const wInput = new MockElement('dynWidthInput', 'input');
wInput.value = "10'";
const hInput = new MockElement('dynHeightInput', 'input');
hInput.value = "8'";
global.document.getElementById = (id) => {
  if (id === 'dynWidthInput') return wInput;
  if (id === 'dynHeightInput') return hInput;
  return null;
};

toolMgr.applyDynamicInput();

const rect = mockCad.objects.find(o => o.type === 'rectangle');
assert(rect);
assert.strictEqual(rect.width, 10);
assert.strictEqual(rect.height, 8);
assert.strictEqual(toolMgr.isDrawing, false);
console.log("-> PASS: Exact 10' x 8' rectangle created on single click + keyboard entry.\n");


// --- TEST 3: CIRCLE - Click center, Radius = 3', Enter ---
console.log("Test 3: CIRCLE - Click center, Radius = 3', Enter");
toolMgr.setTool('circle');

toolMgr.handleToolMouseDown({ x: 5, y: 5 }, { button: 0 });
assert.strictEqual(toolMgr.isDrawing, true);

const rInput = new MockElement('dynRadiusInput', 'input');
rInput.value = "3'";
global.document.getElementById = (id) => id === 'dynRadiusInput' ? rInput : null;

toolMgr.applyDynamicInput();

const circle = mockCad.objects.find(o => o.type === 'circle');
assert(circle);
assert.strictEqual(circle.cx, 5);
assert.strictEqual(circle.cy, 5);
assert.strictEqual(circle.radius, 3);
console.log("-> PASS: Circle radius 3 ft created accurately at (5,5).\n");


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

console.log('====================================================');
console.log('ALL AUTOCAD CLICK INTERACTION TESTS PASSED 100%!');
console.log('====================================================');
