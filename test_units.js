const Units = require('./js/units.js');
const assert = require('assert');

console.log('Testing Units Module...');

// 1. Test feet and inches parsing
assert.strictEqual(Units.toFeet("5'"), 5);
assert.strictEqual(Units.toFeet("5'6\""), 5.5);
assert.strictEqual(Units.toFeet("5'-6\""), 5.5);
assert.strictEqual(Units.toFeet("5' 6\""), 5.5);
assert.strictEqual(Units.toFeet("66\""), 5.5);
assert.strictEqual(Units.toFeet("5.5'"), 5.5);
assert.strictEqual(Units.toFeet("10'"), 10);

// 2. Test metric parsing
assert.strictEqual(Math.round(Units.toFeet("1500 mm") * 100) / 100, Math.round((1500 / 304.8) * 100) / 100);
assert.strictEqual(Math.round(Units.toFeet("1.5 m") * 100) / 100, Math.round((1.5 / 0.3048) * 100) / 100);

// 3. Test polar & relative coordinate parsing
const resPolar = Units.parseInput("10'<90", { x: 0, y: 0 });
assert.strictEqual(resPolar.type, 'point');
assert.strictEqual(Math.round(resPolar.x * 100) / 100, 0);
assert.strictEqual(Math.round(resPolar.y * 100) / 100, 10);

const resRel = Units.parseInput("@10',0", { x: 5, y: 5 });
assert.strictEqual(resRel.type, 'point');
assert.strictEqual(resRel.x, 15);
assert.strictEqual(resRel.y, 5);

// 4. Test formatting
Units.setUnit('ft-in');
assert.strictEqual(Units.format(5.5), "5'-6\"");
assert.strictEqual(Units.format(10), "10'");

console.log('ALL UNITS TESTS PASSED SUCCESSFULLY!');
