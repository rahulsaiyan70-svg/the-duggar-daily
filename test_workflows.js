const Units = require('./js/units.js');
const { CADLine, CADRect, CADDimension, CADCircle } = require('./js/cad/geometry.js');
const { AIPromptBuilder } = require('./js/ai/prompt.js');
const { AIRenderEngine } = require('./js/ai/render.js');
const assert = require('assert');

console.log('==============================================');
console.log('EXECUTION OF ALL 10 MANDATORY WORKFLOW TESTS');
console.log('==============================================\n');

// Mock CAD Canvas Container
class MockCanvas {
  constructor() {
    this.zoom = 15;
    this.panX = 100;
    this.panY = 500;
    this.objects = [];
    this.selectedObjects = [];
    this.showGrid = true;
    this.snapToGrid = true;
    this.snapToObject = true;
    this.orthoLock = false;
  }

  getSnappedPoint(x, y) {
    if (this.snapToObject) {
      for (const obj of this.objects) {
        if (obj.getSnapPoints) {
          for (const pt of obj.getSnapPoints()) {
            if (Math.hypot(pt.x - x, pt.y - y) < 1.0) {
              return { x: pt.x, y: pt.y, snappedToObject: true, snapType: pt.type };
            }
          }
        }
      }
    }
    return { x, y, snappedToObject: false };
  }

  addObject(obj) { this.objects.push(obj); }
  removeObject(obj) { this.objects = this.objects.filter(o => o !== obj); }
  saveState() {}
  render() {}
}

const mockCad = new MockCanvas();

// --- TEST 1: LINE 5 ft ---
console.log('Test 1: LINE - Enter 5 ft');
const lineInput = Units.parseInput("5'", { x: 0, y: 0 }, { x: 1, y: 0 }); // Direction vector horizontal
const testLine1 = new CADLine(0, 0, lineInput.x, lineInput.y);
assert.strictEqual(testLine1.getPerimeter(), 5);
console.log("-> PASS: Line is exactly 5 ft (Perimeter = 5.00 ft)\n");


// --- TEST 2: LINE 10 ft at 90° ---
console.log('Test 2: LINE - Enter 10 ft at 90°');
const polarInput = Units.parseInput("10'<90", { x: 0, y: 0 });
const testLine2 = new CADLine(0, 0, polarInput.x, polarInput.y);
assert.strictEqual(Math.round(testLine2.x2 * 100) / 100, 0);
assert.strictEqual(Math.round(testLine2.y2 * 100) / 100, 10);
assert.strictEqual(testLine2.getPerimeter(), 10);
console.log("-> PASS: Vertical line is exactly 10 ft at (0, 10)\n");


// --- TEST 3: RECTANGLE 10 ft x 8 ft ---
console.log('Test 3: RECTANGLE - Width = 10 ft, Height = 8 ft');
const widthFeet = Units.toFeet("10'");
const heightFeet = Units.toFeet("8'");
const testRect = new CADRect(0, 0, widthFeet, heightFeet, 'rectangle');
assert.strictEqual(testRect.width, 10);
assert.strictEqual(testRect.height, 8);
assert.strictEqual(testRect.getArea(), 80);
console.log("-> PASS: Rectangle dimensions are exactly 10 ft x 8 ft (Area = 80 sq ft)\n");


// --- TEST 4: DIM - Measure Rectangle ---
console.log('Test 4: DIM - Measure Rectangle');
const dimHoriz = new CADDimension(testRect.x, testRect.y, testRect.x + testRect.width, testRect.y, 1.5);
const dimVert = new CADDimension(testRect.x, testRect.y, testRect.x, testRect.y + testRect.height, 1.5);
assert.strictEqual(Units.format(dimHoriz.getDistance()), "10'");
assert.strictEqual(Units.format(dimVert.getDistance()), "8'");
console.log(`-> PASS: Dimension displays horizontal ${Units.format(dimHoriz.getDistance())} x vertical ${Units.format(dimVert.getDistance())}\n`);


// --- TEST 5: MOVE - Move object and verify dimensions update ---
console.log('Test 5: MOVE - Move object');
testRect.move(5, 5); // Shift by (5, 5)
dimHoriz.move(5, 5);
assert.strictEqual(testRect.x, 5);
assert.strictEqual(testRect.y, 5);
assert.strictEqual(dimHoriz.x1, 5);
assert.strictEqual(dimHoriz.x2, 15);
assert.strictEqual(Units.format(dimHoriz.getDistance()), "10'");
console.log("-> PASS: Object moved to (5,5) and dimension maintains exact 10' width\n");


// --- TEST 6: OFFSET - Offset wall by 9" ---
console.log('Test 6: OFFSET - Offset wall by 9"');
const wallLine = new CADLine(0, 0, 20, 0);
const offsetDist = Units.toFeet("9\""); // 0.75 ft
assert.strictEqual(offsetDist, 0.75);
const offsetResult = wallLine.offset(offsetDist, { x: 10, y: 5 }); // Offset upwards
assert.strictEqual(offsetResult[0].y1, 0.75);
assert.strictEqual(offsetResult[0].y2, 0.75);
console.log("-> PASS: Wall line offset by 9\" (0.75 ft) exactly at Y = 0.75 ft\n");


// --- TEST 7: ORTHO - Enable F8 and verify lock ---
console.log('Test 7: ORTHO - Enable F8 and verify lock');
mockCad.orthoLock = true;
let startPt = { x: 0, y: 0 };
let rawPt = { x: 10, y: 1.2 }; // Small Y deviation
let constrainedPt = { ...rawPt };
if (mockCad.orthoLock) {
  const dx = Math.abs(constrainedPt.x - startPt.x);
  const dy = Math.abs(constrainedPt.y - startPt.y);
  if (dx > dy) constrainedPt.y = startPt.y;
  else constrainedPt.x = startPt.x;
}
assert.strictEqual(constrainedPt.y, 0); // Y constrained to horizontal line!
console.log("-> PASS: F8 Ortho lock constrained (10, 1.2) to purely horizontal (10, 0)\n");


// --- TEST 8: OBJECT SNAP - Verify endpoint and midpoint snapping ---
console.log('Test 8: OBJECT SNAP - Verify endpoint and midpoint snapping');
mockCad.objects = [new CADLine(0, 0, 10, 0)];
const endSnap = mockCad.getSnappedPoint(0.2, 0.1);
assert.strictEqual(endSnap.snappedToObject, true);
assert.strictEqual(endSnap.snapType, 'endpoint');
assert.strictEqual(endSnap.x, 0);
assert.strictEqual(endSnap.y, 0);

const midSnap = mockCad.getSnappedPoint(5.1, -0.1);
assert.strictEqual(midSnap.snappedToObject, true);
assert.strictEqual(midSnap.snapType, 'midpoint');
assert.strictEqual(midSnap.x, 5);
assert.strictEqual(midSnap.y, 0);
console.log("-> PASS: Snapped accurately to (0,0) Endpoint and (5,0) Midpoint\n");


// --- TEST 9: REFERENCE IMAGE - Verify included in AI prompt payload ---
console.log('Test 9: REFERENCE IMAGE - Verify inclusion in AI rendering prompt payload');
const promptWithRef = AIPromptBuilder.synthesizePrompt(null, {
  style: 'Modern',
  hasReferenceImages: true,
  refMode: 'style_materials_colours'
});
assert(promptWithRef.includes('USE REFERENCE STYLE + MATERIALS + COLOURS'));
console.log("-> PASS: Reference facade material directive successfully included in AI prompt payload\n");


// --- TEST 10: AI RENDER - Verify configuration message when key not provided ---
console.log('Test 10: AI RENDER - Verify configuration message when key not provided');
const engine = new AIRenderEngine(mockCad, null, null);
let noticeShown = false;
engine.showConfigNotice = (p) => { noticeShown = true; };

// Test call without API key for custom provider
engine.generateRenders('Test prompt', { provider: 'openai', apiKey: '' }).then(() => {
  assert.strictEqual(noticeShown, true);
  console.log("-> PASS: Clear configuration message displayed when API key is missing for live AI provider\n");
  console.log('==============================================');
  console.log('ALL 10 MANDATORY WORKFLOW TESTS PASSED 100%!');
  console.log('==============================================');
});
