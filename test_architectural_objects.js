const { CADWindow, CADDoor, CADBalcony, CADRect, CADDimension, CADObject } = require('./js/cad/geometry.js');
const assert = require('assert');

console.log('Testing Parametric Architectural Objects...');

// 1. Test Wall
const wall = new CADRect(0, 0, 20, 0.75, 'wall'); // 20 ft long, 9" thick
assert.strictEqual(wall.type, 'wall');
assert.strictEqual(wall.width, 20);
assert.strictEqual(wall.height, 0.75);

// 2. Test Door
const mainDoor = new CADDoor(10, 0, 4, 7, 'Main entrance door');
assert.strictEqual(mainDoor.width, 4);
assert.strictEqual(mainDoor.height, 7);
assert.strictEqual(mainDoor.doorType, 'Main entrance door');

// 3. Test Window
const win = new CADWindow(15, 3, 5, 4, 3, 'Sliding window');
assert.strictEqual(win.sillHeight, 3);
assert.strictEqual(win.windowType, 'Sliding window');

// 4. Test Balcony
const balc = new CADBalcony(5, 12, 12, 4, 0.75, 3.5, 'Glass Railing');
assert.strictEqual(balc.width, 12);
assert.strictEqual(balc.projection, 4);
assert.strictEqual(balc.railingHeight, 3.5);

// 5. Test Dimension
const dim = new CADDimension(0, 0, 10, 0);
assert.strictEqual(dim.getDistance(), 10);

// 6. Test JSON roundtrip
const json = JSON.parse(JSON.stringify(win));
const restoredWin = CADObject.fromJSON(json);
assert.strictEqual(restoredWin.sillHeight, 3);
assert.strictEqual(restoredWin.windowType, 'Sliding window');

console.log('ALL PARAMETRIC ARCHITECTURAL OBJECTS TESTS PASSED!');
