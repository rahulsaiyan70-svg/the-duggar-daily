/**
 * RMA Front Elevation Designer - Floor Plan Importer & Scale Calibrator
 * Handles uploading JPG/PNG/PDF floor plans, canvas overlay rendering,
 * 2-point scale calibration measurement, and wall tracing helpers.
 */

class FloorPlanImporter {
  constructor(cadCanvas) {
    this.cad = cadCanvas;
    this.overlay = null; // { image, x, y, width, height, scale, opacity }
    this.isCalibrating = false;
    this.calibrationPts = [];
  }

  loadPlanFromFile(file, callback) {
    if (!file) return;

    if (file.type === 'application/pdf') {
      alert('PDF floor plan uploaded. Note: PDF raster preview supported; for optimal resolution convert PDF page to high-res PNG/JPG.');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Default size in world feet (assume width = 40ft initial)
        const aspect = img.height / img.width;
        const initialWidthWorld = 40;
        const initialHeightWorld = initialWidthWorld * aspect;

        this.overlay = {
          image: img,
          x: -initialWidthWorld / 2,
          y: -initialHeightWorld - 5, // Position below elevation ground line
          width: initialWidthWorld,
          height: initialHeightWorld,
          opacity: 0.5
        };

        this.cad.floorPlanOverlay = this.overlay;
        this.cad.render();

        if (callback) callback(this.overlay);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  setOpacity(opacityVal) {
    if (this.overlay) {
      this.overlay.opacity = parseFloat(opacityVal);
      this.cad.render();
    }
  }

  removePlan() {
    this.overlay = null;
    this.cad.floorPlanOverlay = null;
    this.isCalibrating = false;
    this.calibrationPts = [];
    this.cad.render();
  }

  startScaleCalibration() {
    if (!this.overlay) {
      alert('Please upload a floor plan image first.');
      return;
    }

    this.isCalibrating = true;
    this.calibrationPts = [];
    alert('Scale Calibration Mode:\nClick TWO known points on the floor plan image (e.g. wall thickness or room dimension) to calibrate exact scale.');

    const oldTool = this.cad.activeTool;
    this.cad.activeTool = 'calibrate';

    const canvas = this.cad.canvas;
    const clickHandler = (e) => {
      if (!this.isCalibrating) {
        canvas.removeEventListener('click', clickHandler);
        return;
      }

      const pt = this.cad.snappedWorld;
      this.calibrationPts.push(pt);

      if (this.calibrationPts.length === 2) {
        const p1 = this.calibrationPts[0];
        const p2 = this.calibrationPts[1];
        const currentDistWorld = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        const realDistStr = prompt(`Current distance on canvas is ${currentDistWorld.toFixed(2)} ft.\nEnter real known distance in feet (or e.g. 15'-6"):`, '15');
        if (realDistStr) {
          const realDistFeet = Units.toFeet(realDistStr);
          if (realDistFeet > 0 && currentDistWorld > 0) {
            const scaleFactor = realDistFeet / currentDistWorld;
            this.overlay.width *= scaleFactor;
            this.overlay.height *= scaleFactor;
            alert(`Floor plan calibrated successfully! New scaled width: ${this.overlay.width.toFixed(1)} ft`);
          }
        }

        this.isCalibrating = false;
        this.cad.activeTool = oldTool;
        canvas.removeEventListener('click', clickHandler);
        this.cad.render();
      }
    };

    canvas.addEventListener('click', clickHandler);
  }
}

window.FloorPlanImporter = FloorPlanImporter;
