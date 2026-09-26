const { CADLine, CADRect, CADCircle, GeometryUtils } = require('./js/cad/geometry.js');
const assert = require('assert');

console.log('Testing Geometry Module...');

// 1. Test Line
const line = new CADLine(0, 0, 10, 0);
assert.strictEqual(line.getPerimeter(), 10);
const snaps = line.getSnapPoints();
assert.strictEqual(snaps.length, 3);
assert.strictEqual(snaps[0].type, 'endpoint');
assert.strictEqual(snaps[2].type, 'midpoint');
assert.strictEqual(snaps[2].x, 5);

// 2. Test Offset
const offLines = line.offset(2, { x: 5, y: 5 });
assert.strictEqual(offLines.length, 1);
assert.strictEqual(offLines[0].y1, 2);
assert.strictEqual(offLines[0].y2, 2);

// 3. Test Rectangle Area & Perimeter
const rect = new CADRect(0, 0, 10, 8);
assert.strictEqual(rect.getArea(), 80);
assert.strictEqual(rect.getPerimeter(), 36);

// 4. Test Mirror
const rect2 = new CADRect(0, 0, 10, 8);
rect2.mirror({ x: 0, y: 0 }, { x: 0, y: 10 }); // Vertical Y axis mirror
assert.strictEqual(rect2.x, -10);

// 5. Test Circle
const circle = new CADCircle(0, 0, 5);
assert.strictEqual(Math.round(circle.getArea()), Math.round(Math.PI * 25));

console.log('ALL GEOMETRY TESTS PASSED SUCCESSFULLY!');
