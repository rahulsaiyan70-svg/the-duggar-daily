/**
 * RMA Front Elevation Designer - Unit System Utility
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
        return `${sign}${feet}'-${inchStr}"`;
      }
    }
  },

  /**
   * Convert value in specified unit to decimal FEET.
   * @param {number|string} inputVal
   * @param {'ft-in'|'mm'|'cm'|'m'} [fromUnit]
   * @returns {number} Value in Feet
   */
  toFeet(inputVal, fromUnit = null) {
    const unit = fromUnit || this.currentUnit;
    if (typeof inputVal === 'number') {
      switch (unit) {
        case 'mm': return inputVal / this.FEET_TO_MM;
        case 'cm': return inputVal / this.FEET_TO_CM;
        case 'm': return inputVal / this.FEET_TO_M;
        case 'ft-in': default: return inputVal;
      }
    }

    if (typeof inputVal === 'string') {
      const str = inputVal.trim();
      if (!str) return 0;

      // Handle ft-in format e.g., 10'-6" or 10' 6" or 10.5
      if (str.includes("'") || str.includes('"')) {
        let ft = 0;
        let inch = 0;
        const ftMatch = str.match(/(-?\d+(?:\.\d+)?)\s*'/);
        const inchMatch = str.match(/(-?\d+(?:\.\d+)?)\s*"/);
        if (ftMatch) ft = parseFloat(ftMatch[1]) || 0;
        if (inchMatch) inch = parseFloat(inchMatch[1]) || 0;
        return ft + (inch / 12);
      }

      const num = parseFloat(str);
      if (isNaN(num)) return 0;
      return this.toFeet(num, unit);
    }

    return 0;
  }
};

window.Units = Units;
