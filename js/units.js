/**
 * RMA Front Elevation Designer - Unit System Utility & Dynamic Input Parser
 * All internal geometry math is computed and stored in decimal FEET (world units).
 * Supported display/input unit modes:
 * - 'ft-in' : Feet & Inches (e.g. 10'-6 1/2" or 10'-6")
 * - 'mm'    : Millimetres (e.g. 3048 mm)
 * - 'cm'    : Centimetres (e.g. 304.8 cm)
 * - 'm'     : Metres (e.g. 3.05 m)
 */

const Units = {
  currentUnit: 'ft-in',

  // Conversion factors relative to 1 Foot
  FEET_TO_MM: 304.8,
  FEET_TO_CM: 30.48,
  FEET_TO_M: 0.3048,
  FEET_TO_INCHES: 12,

  /**
   * Set the active display unit mode.
   * @param {'ft-in'|'mm'|'cm'|'m'} unit
   */
  setUnit(unit) {
    if (['ft-in', 'mm', 'cm', 'm'].includes(unit)) {
      this.currentUnit = unit;
    }
  },

  /**
   * Convert real feet value to active display value or string.
   * @param {number} feetValue
   * @param {'ft-in'|'mm'|'cm'|'m'} [unitOverride]
   * @returns {string} Formatted architectural string
   */
  format(feetValue, unitOverride = null) {
    const unit = unitOverride || this.currentUnit;
    if (feetValue === null || feetValue === undefined || isNaN(feetValue)) return '0';

    switch (unit) {
      case 'mm':
        return `${Math.round(feetValue * this.FEET_TO_MM)} mm`;
      case 'cm':
        return `${(feetValue * this.FEET_TO_CM).toFixed(1)} cm`;
      case 'm':
        return `${(feetValue * this.FEET_TO_M).toFixed(2)} m`;
      case 'ft-in':
      default: {
        const sign = feetValue < 0 ? '-' : '';
        const absVal = Math.abs(feetValue);
        let feet = Math.floor(absVal);
        let inches = (absVal - feet) * 12;
        let roundedInches = Math.round(inches * 16) / 16; // Round to nearest 1/16"

        if (roundedInches >= 12) {
          feet += 1;
          roundedInches = 0;
        }

        const wholeInches = Math.floor(roundedInches);
        const fracInches = roundedInches - wholeInches;

        let inchStr = `${wholeInches}`;
        if (fracInches > 0.001) {
          if (Math.abs(fracInches - 0.25) < 0.05) inchStr += ' 1/4';
          else if (Math.abs(fracInches - 0.5) < 0.05) inchStr += ' 1/2';
          else if (Math.abs(fracInches - 0.75) < 0.05) inchStr += ' 3/4';
          else if (Math.abs(fracInches - 0.125) < 0.05) inchStr += ' 1/8';
          else if (Math.abs(fracInches - 0.375) < 0.05) inchStr += ' 3/8';
          else if (Math.abs(fracInches - 0.625) < 0.05) inchStr += ' 5/8';
          else if (Math.abs(fracInches - 0.875) < 0.05) inchStr += ' 7/8';
        }

        if (feet === 0 && roundedInches === 0) return `0'`;
        if (roundedInches === 0) return `${sign}${feet}'`;
        if (feet === 0) return `${sign}${inchStr}"`;
        return `${sign}${feet}'-${inchStr}"`;
      }
    }
  },

  /**
   * Parse a single numeric length string into decimal FEET.
   * Handles:
   * - Feet & Inches: 5', 5 ft, 5'-6", 5'6", 5' 6", 66", 5.5', 5.5
   * - Metric: 1500 mm, 1500mm, 150 cm, 1.5 m, 1.5m
   * @param {number|string} inputVal
   * @param {'ft-in'|'mm'|'cm'|'m'} [fromUnit]
   * @returns {number} Decimal feet value
   */
  toFeet(inputVal, fromUnit = null) {
    const defaultUnit = fromUnit || this.currentUnit;

    if (typeof inputVal === 'number') {
      if (isNaN(inputVal)) return 0;
      switch (defaultUnit) {
        case 'mm': return inputVal / this.FEET_TO_MM;
        case 'cm': return inputVal / this.FEET_TO_CM;
        case 'm': return inputVal / this.FEET_TO_M;
        case 'ft-in': default: return inputVal;
      }
    }

    if (typeof inputVal !== 'string') return 0;
    const str = inputVal.trim().toLowerCase();
    if (!str) return 0;

    // Check explicit metric suffixes first
    if (str.endsWith('mm')) {
      const val = parseFloat(str.replace('mm', '').trim());
      return isNaN(val) ? 0 : val / this.FEET_TO_MM;
    }
    if (str.endsWith('cm')) {
      const val = parseFloat(str.replace('cm', '').trim());
      return isNaN(val) ? 0 : val / this.FEET_TO_CM;
    }
    if (str.endsWith('m') && !str.endsWith('mm') && !str.endsWith('cm')) {
      const val = parseFloat(str.replace('m', '').trim());
      return isNaN(val) ? 0 : val / this.FEET_TO_M;
    }

    // Check feet & inches syntax
    const hasFtSymbol = str.includes("'") || str.includes('ft');
    const hasInchSymbol = str.includes('"') || str.includes('in');

    if (hasFtSymbol || hasInchSymbol) {
      let ft = 0;
      let inch = 0;

      if (hasFtSymbol) {
        // Split around ' or ft
        const parts = str.split(/'|ft/);
        ft = parseFloat(parts[0]) || 0;

        if (parts.length > 1) {
          const inchPart = parts[1].replace(/["\s\-in]/g, '').trim();
          if (inchPart) inch = parseFloat(inchPart) || 0;
        }
      } else if (hasInchSymbol) {
        // Pure inches e.g. 66" or 66in
        const val = parseFloat(str.replace(/["\s*in]/g, '').trim());
        if (!isNaN(val)) inch = val;
      }

      return ft + (inch / 12);
    }

    // Plain number without explicit symbols -> apply current selected unit
    const num = parseFloat(str);
    if (isNaN(num)) return 0;

    switch (defaultUnit) {
      case 'mm': return num / this.FEET_TO_MM;
      case 'cm': return num / this.FEET_TO_CM;
      case 'm': return num / this.FEET_TO_M;
      case 'ft-in': default: return num;
    }
  },

  /**
   * Parse CAD point entry string. Supports:
   * 1. Relative cartesian: `@10',0` or `@10, 5`
   * 2. Polar syntax: `10'<90` or `1500mm<45`
   * 3. Cartesian coordinate: `10', 15'` or `10, 15`
   * 4. Single distance (for direction-vector or line command): `10'` or `1500 mm`
   * @param {string} inputStr
   * @param {{x: number, y: number}} referencePt - Baseline point for relative inputs
   * @param {{x: number, y: number}} [directionVector] - Baseline direction vector if polar distance given without angle
   * @returns {{ type: 'point'|'distance'|'polar', x?: number, y?: number, distance?: number, angle?: number }}
   */
  parseInput(inputStr, referencePt = { x: 0, y: 0 }, directionVector = null) {
    if (!inputStr || typeof inputStr !== 'string') return null;
    const str = inputStr.trim();
    if (!str) return null;

    // 1. Polar Syntax: distance<angle e.g. 10'<90 or 1500mm<45
    if (str.includes('<')) {
      const parts = str.split('<');
      const distFeet = this.toFeet(parts[0]);
      const angleDeg = parseFloat(parts[1]) || 0;
      const angleRad = (angleDeg * Math.PI) / 180;

      const targetX = referencePt.x + distFeet * Math.cos(angleRad);
      const targetY = referencePt.y + distFeet * Math.sin(angleRad);

      return {
        type: 'point',
        x: targetX,
        y: targetY,
        distance: distFeet,
        angle: angleDeg
      };
    }

    // 2. Relative Cartesian Syntax: @dx,dy e.g. @10',0 or @10,5
    if (str.startsWith('@')) {
      const coords = str.substring(1).split(',');
      if (coords.length === 2) {
        const dxFeet = this.toFeet(coords[0]);
        const dyFeet = this.toFeet(coords[1]);
        return {
          type: 'point',
          x: referencePt.x + dxFeet,
          y: referencePt.y + dyFeet
        };
      }
    }

    // 3. Absolute Cartesian Syntax: x,y e.g. 10', 15'
    if (str.includes(',')) {
      const coords = str.split(',');
      if (coords.length === 2) {
        const xFeet = this.toFeet(coords[0]);
        const yFeet = this.toFeet(coords[1]);
        return {
          type: 'point',
          x: xFeet,
          y: yFeet
        };
      }
    }

    // 4. Single Distance entry e.g. 10' or 5'-6" or 1500 mm
    const distFeet = this.toFeet(str);
    if (!isNaN(distFeet) && distFeet !== 0) {
      if (directionVector && (directionVector.x !== 0 || directionVector.y !== 0)) {
        const len = Math.hypot(directionVector.x, directionVector.y);
        const nx = directionVector.x / len;
        const ny = directionVector.y / len;
        return {
          type: 'point',
          x: referencePt.x + nx * distFeet,
          y: referencePt.y + ny * distFeet,
          distance: distFeet
        };
      }
      return {
        type: 'distance',
        distance: distFeet
      };
    }

    return null;
  }
};

if (typeof window !== 'undefined') {
  window.Units = Units;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Units;
}
