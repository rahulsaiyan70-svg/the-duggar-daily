/**
 * RMA Front Elevation Designer - AI Prompt Synthesizer
 * Constructs structured AI image generation prompts combining building dimensions,
 * CAD elevation geometry, window/door/balcony counts, style, materials, lighting, landscape,
 * reference image instructions, reference material modes, and strict geometry preservation locks.
 */

class AIPromptBuilder {
  /**
   * Synthesize full prompt text from structured inputs, CAD geometry, and reference image modes
   */
  static synthesizePrompt(cadCanvas, options = {}) {
    const style = options.style || 'Modern';
    const materials = options.materials || ['White plaster', 'Natural stone cladding', 'Wood-look vertical fins', 'Glass balcony railings'];
    const lighting = options.lighting || 'Warm architectural lighting';
    const landscape = options.landscape || 'Basic entry planter';
    const geoLock = options.geometryLock || 'HIGH'; // LOW, MEDIUM, HIGH, LOCKED
    const refMode = options.refMode || 'style_materials_colours'; // 'style', 'materials', 'colours', 'geometry', 'all', 'style_materials_colours'

    // Extract geometry counts & dimensions from CAD Canvas
    const objects = cadCanvas ? cadCanvas.objects : [];
    let buildingWidth = 40;
    let windowsCount = 0;
    let doorsCount = 0;
    let balconiesCount = 0;
    let maxFloorHeight = 0;

    objects.forEach(obj => {
      const b = obj.getBounds();
      if (b.maxX > buildingWidth / 2) buildingWidth = b.maxX * 2;
      if (b.maxY > maxFloorHeight) maxFloorHeight = b.maxY;

      if (obj.type === 'window') windowsCount++;
      if (obj.type === 'door') doorsCount++;
      if (obj.type === 'balcony') balconiesCount++;
    });

    const matString = materials.length ? materials.join(', ') : 'White plaster and natural stone cladding';

    // Construct Geometry Preservation Directive (Requirement 22)
    let geoDirective = '';
    switch (geoLock) {
      case 'LOCKED':
        geoDirective = 'STRICT GEOMETRY LOCK: Preserve exact 2D elevation geometry, wall boundaries, floor level heights, slab projections, door positions, window openings, and balcony alignments with 100% precision. Do NOT add, remove, shift, or resize any windows, doors, or floor levels.';
        break;
      case 'HIGH':
      default:
        geoDirective = 'HIGH GEOMETRY PRESERVATION: Preserve exact building width (~' + Math.round(buildingWidth) + ' ft), floor heights, window positions (' + windowsCount + ' windows), door locations (' + doorsCount + ' doors), and balcony projections. Maintain true architectural proportions and CAD alignment.';
        break;
      case 'MEDIUM':
        geoDirective = 'MEDIUM GEOMETRY MATCH: Use supplied CAD layout as strong geometric foundation. Retain primary wall bounds, floor counts, and major openings while allowing fine architectural styling adjustments.';
        break;
      case 'LOW':
        geoDirective = 'LOW GEOMETRY MATCH: Inspired by CAD elevation layout, but feel free to creatively enhance structural openings and facade shapes.';
        break;
    }

    // Reference Material Mode Directive (Requirement 20 & 21)
    let refDirective = '';
    if (options.hasReferenceImages) {
      switch (refMode) {
        case 'style':
          refDirective = 'Analyze and apply the overarching architectural facade style and design language from the reference photo.';
          break;
        case 'materials':
          refDirective = 'PRIORITIZE REFERENCE MATERIALS: Analyze and extract exact visual material textures (stone cladding, brick, timber fins, metal paneling) from the reference photo and apply them directly onto the CAD elevation walls.';
          break;
        case 'colours':
          refDirective = 'PRIORITIZE REFERENCE COLOURS: Extract and apply the exact exterior color palette, paint tones, and accent hues visible in the reference facade photo.';
          break;
        case 'geometry':
          refDirective = 'Incorporate subtle geometric facade framing motifs from the reference image without violating the user building CAD bounds.';
          break;
        case 'all':
          refDirective = 'USE ALL REFERENCE CHARACTERISTICS: Mirror style, materials, cladding textures, color palette, window treatments, and railing details directly from the reference photo onto the elevation.';
          break;
        case 'style_materials_colours':
        default:
          refDirective = 'USE REFERENCE STYLE + MATERIALS + COLOURS: Prioritize the exterior cladding materials, facade textures, color palette, and architectural style visible in the uploaded reference photo.';
          break;
      }
    }

    const promptText = `Photorealistic architectural front elevation render of a ${style} residential facade. ` +
      `${geoDirective} ` +
      `Apply high-end exterior materials including ${matString}. ` +
      `Set in ${lighting} with ${landscape} landscaping. ` +
      `${refDirective} ` +
      `Ensure straight orthographic architectural elevation view, high resolution 8K, architectural magazine quality render, hyper-realistic textures, clean shadow lines, realistic glass reflections. No distorted lines.`;

    return promptText.trim();
  }
}

if (typeof window !== 'undefined') {
  window.AIPromptBuilder = AIPromptBuilder;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIPromptBuilder };
}
