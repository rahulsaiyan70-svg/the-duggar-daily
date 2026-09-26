/**
 * RMA Front Elevation Designer - 2D CAD Canvas Engine
 * Handles viewport transformations (pan, zoom), architectural grid, snapping, object snapping (OSNAP),
 * CAD crosshair cursor, OSNAP visual markers, dynamic input HUD overlay, rendering objects,
 * undo/redo stack, layers, and event propagation.
 */

class CADCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    // Viewport State (world coordinates in FEET)
    this.zoom = 15;        // Pixels per foot
    this.panX = 100;       // Canvas origin X offset in pixels
    this.panY = 0;         // Canvas origin Y offset in pixels (set during resize)

    // Snapping Settings
    this.gridSize = 1;     // 1 foot grid
    this.showGrid = true;
    this.snapToGrid = true;
    this.snapToObject = true;
    this.orthoLock = false; // Lock drawing to 90 degrees horizontal/vertical (F8)

    // CAD State
    this.objects = [];
    this.selectedObjects = [];
    this.history = [];
    this.redoStack = [];
    this.activeTool = 'select';
    this.activeLayer = 'default';

    // Interactive Cursor & Snap State
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.cursorScreen = { x: 0, y: 0 };
    this.cursorWorld = { x: 0, y: 0 };
    this.snappedWorld = { x: 0, y: 0 };
    this.activeSnapType = null; // 'endpoint', 'midpoint', 'center', 'intersection', 'perpendicular', 'nearest'

    // Overlay image (e.g. Floor plan trace)
    this.floorPlanOverlay = null;

    // Listeners & Initialization
    this.initEvents();
    this.resizeCanvas();
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
    if (this.panY === 0) {
      // Default elevation origin at bottom-left area of screen
      this.panY = this.canvas.height - 80;
    }
    this.render();
  }

  // Viewport Coordinate Conversions
  worldToScreen(wx, wy) {
    return {
      x: this.panX + wx * this.zoom,
      y: this.panY - wy * this.zoom // Invert Y axis so world Y+ goes UP
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (this.panY - sy) / this.zoom
    };
  }

  // Snapping Calculation with Full OSNAP Support
  getSnappedPoint(rawWorldX, rawWorldY) {
    let sx = rawWorldX;
    let sy = rawWorldY;
    let snapType = null;

    // 1. Grid Snapping
    if (this.snapToGrid && this.gridSize > 0) {
      sx = Math.round(rawWorldX / this.gridSize) * this.gridSize;
      sy = Math.round(rawWorldY / this.gridSize) * this.gridSize;
      snapType = 'grid';
    }

    // 2. Object Point Snapping (OSNAP)
    if (this.snapToObject) {
      const snapThresholdWorld = 12 / this.zoom; // 12px snap radius
      let closestDist = snapThresholdWorld;
      let objectSnapPt = null;

      // Collect all snap points across objects
      this.objects.forEach(obj => {
        const points = this.getObjectSnapPoints(obj);
        points.forEach(pt => {
          const dist = Math.hypot(pt.x - rawWorldX, pt.y - rawWorldY);
          if (dist < closestDist) {
            closestDist = dist;
            objectSnapPt = pt;
          }
        });
      });

      if (objectSnapPt) {
        this.activeSnapType = objectSnapPt.type || 'endpoint';
        return { x: objectSnapPt.x, y: objectSnapPt.y, snappedToObject: true, snapType: objectSnapPt.type };
      }
    }

    this.activeSnapType = snapType;
    return { x: sx, y: sy, snappedToObject: false, snapType };
  }

  getObjectSnapPoints(obj) {
    if (obj.getSnapPoints) {
      return obj.getSnapPoints();
    }
    const b = obj.getBounds();
    return [
      { x: b.minX, y: b.minY, type: 'endpoint' },
      { x: b.maxX, y: b.minY, type: 'endpoint' },
      { x: b.minX, y: b.maxY, type: 'endpoint' },
      { x: b.maxX, y: b.maxY, type: 'endpoint' },
      { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, type: 'midpoint' }
    ];
  }

  // History Undo / Redo
  saveState() {
    const json = this.objects.map(o => JSON.parse(JSON.stringify(o)));
    this.history.push(json);
    if (this.history.length > 50) this.history.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.history.length === 0) return;
    const currentState = this.objects.map(o => JSON.parse(JSON.stringify(o)));
    this.redoStack.push(currentState);
    const prevState = this.history.pop();
    this.objects = prevState.map(d => CADObject.fromJSON(d));
    this.selectedObjects = [];
    this.render();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const currentState = this.objects.map(o => JSON.parse(JSON.stringify(o)));
    this.history.push(currentState);
    const nextState = this.redoStack.pop();
    this.objects = nextState.map(d => CADObject.fromJSON(d));
    this.selectedObjects = [];
    this.render();
  }

  // Object CRUD Operations
  addObject(obj) {
    this.saveState();
    this.objects.push(obj);
    this.render();
  }

  removeObject(obj) {
    this.saveState();
    this.objects = this.objects.filter(o => o.id !== obj.id);
    this.selectedObjects = this.selectedObjects.filter(o => o.id !== obj.id);
    this.render();
  }

  deleteSelected() {
    if (this.selectedObjects.length === 0) return;
    this.saveState();
    const selectedIds = new Set(this.selectedObjects.map(o => o.id));
    this.objects = this.objects.filter(o => !selectedIds.has(o.id));
    this.selectedObjects = [];
    this.render();
  }

  clearAll() {
    this.saveState();
    this.objects = [];
    this.selectedObjects = [];
    this.render();
  }

  // Event Handlers
  initEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const mouseX = e.offsetX;
      const mouseY = e.offsetY;

      const worldBefore = this.screenToWorld(mouseX, mouseY);
      this.zoom = Math.max(2, Math.min(200, this.zoom * zoomFactor));
      const worldAfter = this.screenToWorld(mouseX, mouseY);

      this.panX += (worldAfter.x - worldBefore.x) * this.zoom;
      this.panY -= (worldAfter.y - worldBefore.y) * this.zoom;
      this.render();

      const zoomDisp = document.getElementById('zoomDisplay');
      if (zoomDisp) zoomDisp.textContent = `${Math.round(this.zoom * 6.66)}%`;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || this.activeTool === 'pan' || (e.button === 0 && e.spaceKey)) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      this.cursorScreen = { x: sx, y: sy };

      if (this.isPanning) {
        this.panX = e.clientX - this.panStart.x;
        this.panY = e.clientY - this.panStart.y;
        this.render();
        return;
      }

      this.cursorWorld = this.screenToWorld(sx, sy);
      this.snappedWorld = this.getSnappedPoint(this.cursorWorld.x, this.cursorWorld.y);

      // Update Coordinate HUD in Status Bar
      const coordDisplay = document.getElementById('coordDisplay');
      if (coordDisplay && typeof Units !== 'undefined') {
        coordDisplay.textContent = `X: ${Units.format(this.snappedWorld.x)} | Y: ${Units.format(this.snappedWorld.y)}`;
      }

      if (this.onMouseMove) this.onMouseMove(e, this.snappedWorld, this.cursorWorld);

      this.render();
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.style.cursor = 'none'; // Custom CAD Crosshair rendered
      }
    });

    // Crosshair cursor style
    this.canvas.addEventListener('mouseenter', () => {
      this.canvas.style.cursor = 'none';
    });
  }

  // Main Render Loop
  render() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    // 1. Draw Architectural Grid
    if (this.showGrid) {
      this.drawGrid();
    }

    // 2. Draw Floor Plan Overlay
    if (this.floorPlanOverlay && this.floorPlanOverlay.image) {
      const img = this.floorPlanOverlay.image;
      const sp = this.worldToScreen(this.floorPlanOverlay.x, this.floorPlanOverlay.y + this.floorPlanOverlay.height);
      const sw = this.floorPlanOverlay.width * this.zoom;
      const sh = this.floorPlanOverlay.height * this.zoom;

      this.ctx.save();
      this.ctx.globalAlpha = this.floorPlanOverlay.opacity || 0.5;
      this.ctx.drawImage(img, sp.x, sp.y, sw, sh);
      this.ctx.restore();
    }

    // 3. Draw Ground Level Axis (Y = 0)
    const groundP1 = this.worldToScreen(-1000, 0);
    const groundP2 = this.worldToScreen(1000, 0);
    this.ctx.beginPath();
    this.ctx.moveTo(groundP1.x, groundP1.y);
    this.ctx.lineTo(groundP2.x, groundP2.y);
    this.ctx.strokeStyle = '#081c15';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    // 4. Draw CAD Objects
    this.objects.forEach(obj => {
      obj.draw(this.ctx, this);
    });

    // 5. Draw Active Tool Drawing Preview
    if (this.onDrawPreview) {
      this.onDrawPreview(this.ctx, this);
    }

    // 6. Draw OSNAP Markers and CAD Crosshair Cursor
    this.drawOSNAPMarker();
    this.drawCrosshair();
  }

  drawGrid() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(width, height);

    const stepWorld = this.gridSize; // Feet
    const startX = Math.floor(topLeft.x / stepWorld) * stepWorld;
    const endX = Math.ceil(bottomRight.x / stepWorld) * stepWorld;
    const startY = Math.floor(bottomRight.y / stepWorld) * stepWorld;
    const endY = Math.ceil(topLeft.y / stepWorld) * stepWorld;

    this.ctx.lineWidth = 0.5;

    for (let x = startX; x <= endX; x += stepWorld) {
      const sp = this.worldToScreen(x, 0);
      this.ctx.beginPath();
      this.ctx.moveTo(sp.x, 0);
      this.ctx.lineTo(sp.x, height);

      if (Math.abs(x) % 10 < 0.01) {
        this.ctx.strokeStyle = '#d8e2dc';
      } else {
        this.ctx.strokeStyle = '#f0f2f5';
      }
      this.ctx.stroke();
    }

    for (let y = startY; y <= endY; y += stepWorld) {
      const sp = this.worldToScreen(0, y);
      this.ctx.beginPath();
      this.ctx.moveTo(0, sp.y);
      this.ctx.lineTo(width, sp.y);

      if (Math.abs(y) % 10 < 0.01) {
        this.ctx.strokeStyle = '#d8e2dc';
      } else {
        this.ctx.strokeStyle = '#f0f2f5';
      }
      this.ctx.stroke();
    }
  }

  // Architectural CAD Crosshair Cursor
  drawCrosshair() {
    if (this.cursorScreen.x === 0 && this.cursorScreen.y === 0) return;
    const sc = this.worldToScreen(this.snappedWorld.x, this.snappedWorld.y);
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(43, 147, 72, 0.7)';
    this.ctx.lineWidth = 1;

    // Horizontal full-screen line
    this.ctx.beginPath();
    this.ctx.moveTo(0, sc.y);
    this.ctx.lineTo(width, sc.y);
    this.ctx.stroke();

    // Vertical full-screen line
    this.ctx.beginPath();
    this.ctx.moveTo(sc.x, 0);
    this.ctx.lineTo(sc.x, height);
    this.ctx.stroke();

    // Pickbox Square in center
    const boxSize = 6;
    this.ctx.strokeStyle = '#1b4332';
    this.ctx.strokeRect(sc.x - boxSize / 2, sc.y - boxSize / 2, boxSize, boxSize);

    this.ctx.restore();
  }

  // OSNAP Visual Marker Glyphs
  drawOSNAPMarker() {
    if (!this.snappedWorld || !this.snappedWorld.snappedToObject) return;
    const sc = this.worldToScreen(this.snappedWorld.x, this.snappedWorld.y);
    const type = this.snappedWorld.snapType || 'endpoint';

    this.ctx.save();
    this.ctx.strokeStyle = '#2b9348';
    this.ctx.fillStyle = 'rgba(43, 147, 72, 0.2)';
    this.ctx.lineWidth = 2;

    const sz = 7;

    switch (type) {
      case 'endpoint':
        // Square
        this.ctx.fillRect(sc.x - sz, sc.y - sz, sz * 2, sz * 2);
        this.ctx.strokeRect(sc.x - sz, sc.y - sz, sz * 2, sz * 2);
        break;

      case 'midpoint':
        // Triangle
        this.ctx.beginPath();
        this.ctx.moveTo(sc.x, sc.y - sz);
        this.ctx.lineTo(sc.x - sz, sc.y + sz);
        this.ctx.lineTo(sc.x + sz, sc.y + sz);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        break;

      case 'center':
        // Circle
        this.ctx.beginPath();
        this.ctx.arc(sc.x, sc.y, sz, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        break;

      case 'intersection':
        // Cross X
        this.ctx.beginPath();
        this.ctx.moveTo(sc.x - sz, sc.y - sz); ctx.lineTo(sc.x + sz, sc.y + sz);
        this.ctx.moveTo(sc.x + sz, sc.y - sz); ctx.lineTo(sc.x - sz, sc.y + sz);
        this.ctx.stroke();
        break;

      case 'perpendicular':
        // Right Angle Glyph
        this.ctx.beginPath();
        this.ctx.moveTo(sc.x - sz, sc.y - sz);
        this.ctx.lineTo(sc.x - sz, sc.y);
        this.ctx.lineTo(sc.x, sc.y);
        this.ctx.stroke();
        break;

      default:
        this.ctx.beginPath();
        this.ctx.arc(sc.x, sc.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    }

    this.ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  window.CADCanvas = CADCanvas;
}
