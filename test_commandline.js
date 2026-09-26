const Units = require('./js/units.js');
const { CADCommandLine } = require('./js/cad/commandline.js');
const assert = require('assert');

console.log('Testing Command Line Module...');

// Mock objects
const mockCanvas = {
  selectedObjects: [],
  undo: () => {},
  redo: () => {},
  deleteSelected: () => {},
  render: () => {},
  saveState: () => {},
  addObject: () => {}
};

const mockTools = {
  setTool: (t) => { mockTools.activeTool = t; }
};

const cmdLine = new CADCommandLine(mockCanvas, mockTools);

// Test Shortcuts resolution
assert.strictEqual(cmdLine.shortcuts['L'], 'LINE');
assert.strictEqual(cmdLine.shortcuts['PL'], 'POLYLINE');
assert.strictEqual(cmdLine.shortcuts['REC'], 'RECTANGLE');
assert.strictEqual(cmdLine.shortcuts['O'], 'OFFSET');
assert.strictEqual(cmdLine.shortcuts['MI'], 'MIRROR');

// Test Command execution
cmdLine.processInput('L');
assert.strictEqual(mockTools.activeTool, 'line');

cmdLine.processInput('REC');
assert.strictEqual(mockTools.activeTool, 'rectangle');

console.log('ALL COMMAND LINE TESTS PASSED SUCCESSFULLY!');
