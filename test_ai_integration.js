const { AIPromptBuilder } = require('./js/ai/prompt.js');
const { AIRenderEngine } = require('./js/ai/render.js');
const assert = require('assert');

console.log('Testing AI Rendering & Reference Integration...');

// 1. Test Prompt Synthesis with Geometry Lock HIGH and Reference Mode
const promptText = AIPromptBuilder.synthesizePrompt(null, {
  style: 'Modern',
  geometryLock: 'LOCKED',
  hasReferenceImages: true,
  refMode: 'style_materials_colours'
});

assert(promptText.includes('STRICT GEOMETRY LOCK'));
assert(promptText.includes('USE REFERENCE STYLE + MATERIALS + COLOURS'));

// 2. Test AIRenderEngine class initialization
const engine = new AIRenderEngine(null, null, null);
assert.ok(engine);

console.log('ALL AI RENDERING TESTS PASSED SUCCESSFULLY!');
