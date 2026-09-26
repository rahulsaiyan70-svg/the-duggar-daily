/**
 * RMA Front Elevation Designer - AI Prompt Synthesizer
 * Constructs a structured AI image generation prompt combining building dimensions,
 * CAD elevation geometry, window/door/balcony counts, style, materials, lighting, landscape,
 * reference image instructions, and strict geometry preservation locks.
 */

class AIPromptBuilder {
  /**
   * Synthesize full prompt text from structured inputs and CAD geometry
   */
  static synthesizePrompt(cadCanvas, options = {}) {
    const style = options.style || 'Modern';
    const materials = options.materials || ['White plaster', 'Natural stone cladding', 'Wood-look vertical fins', 'Glass balcony railings'];
    const lighting = options.lighting || 'Warm architectural lighting';
    const landscape = options.landscape || 'Basic entry planter';
    const geoLock = options.geometryLock || 'HIGH'; // LOW, MEDIUM, HIGH, LOCKED

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

    // Construct Geometry Preservation Instruction Directive
    let geoDirective = '';
    switch (geoLock) {
      case 'LOCKED':
        geoDirective = 'STRICT GEOMETRY LOCK: Preserve the exact 2D elevation geometry, wall boundaries, floor level heights, slab projections, door positions, window openings, and balcony alignments with 100% precision. Do NOT add, remove, shift, or resize any windows, doors, or floor levels.';
        break;
      case 'HIGH':
      default:
        geoDirective = 'HIGH GEOMETRY PRESERVATION: Preserve the exact building width (~' + Math.round(buildingWidth) + ' ft), floor heights, window positions (' + windowsCount + ' windows), door locations (' + doorsCount + ' doors), and balcony projections. Maintain true architectural proportions and CAD alignment.';
        break;
      case 'MEDIUM':
        geoDirective = 'MEDIUM GEOMETRY MATCH: Use the supplied elevation CAD layout as a strong geometric foundation. Retain primary wall bounds, floor counts, and major openings while allowing fine architectural styling adjustments.';
        break;
      case 'LOW':
        geoDirective = 'LOW GEOMETRY MATCH: Inspired by the CAD elevation layout, but feel free to creatively enhance structural openings, fenestration patterns, and roofline shapes.';
        break;
    }

    // Ref Image Directive
    const refDirective = options.hasReferenceImages
      ? 'Incorporate design cues, architectural language, color palette, material textures, window treatment, and railing details from the reference facade image.'
      : '';

    const promptText = `Photorealistic architectural front elevation render of a ${style} residential facade. ` +
      `${geoDirective} ` +
      `Apply high-end exterior materials including ${matString}. ` +
      `Set in ${lighting} with ${landscape} landscaping. ` +
      `${refDirective} ` +
      `Ensure straight orthographic architectural elevation view, high resolution 8K, architectural magazine quality render, hyper-realistic textures, clean shadow lines, realistic glass reflections. No distorted lines.`;

    return promptText.trim();
  }
}

window.AIPromptBuilder = AIPromptBuilder;
