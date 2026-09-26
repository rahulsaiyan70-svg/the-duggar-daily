/**
 * RMA Front Elevation Designer - 2D CAD Canvas Engine
 * Handles viewport transformations (pan, zoom), grid drawing, snapping, object snapping,
 * rendering objects, undo/redo stack, layers, and event propagation.
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
    this.orthoLock = false; // Lock drawing to 90 degrees horizontal/vertical

    // CAD State
    this.objects = [];
    this.selectedObjects = [];
    this.history = [];
    this.redoStack = [];
    this.activeTool = 'select';
    this.activeLayer = 'default';

    // Interactive State
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.cursorWorld = { x: 0, y: 0 };
    this.snappedWorld = { x: 0, y: 0 };

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

  // Snapping Calculation
  getSnappedPoint(rawWorldX, rawWorldY) {
    let sx = rawWorldX;
    let sy = rawWorldY;

    // 1. Grid Snapping
    if (this.snapToGrid && this.gridSize > 0) {
      sx = Math.round(rawWorldX / this.gridSize) * this.gridSize;
      sy = Math.round(rawWorldY / this.gridSize) * this.gridSize;
    }

    // 2. Object Point Snapping (Endpoints / Midpoints)
    if (this.snapToObject) {
      const snapThresholdWorld = 10 / this.zoom; // 10px snap distance
      let closestDist = snapThresholdWorld;
      let objectSnapPt = null;

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
        return { x: objectSnapPt.x, y: objectSnapPt.y, snappedToObject: true };
      }
    }

    return { x: sx, y: sy, snappedToObject: false };
  }

  getObjectSnapPoints(obj) {
    const pts = [];
    const b = obj.getBounds();
    pts.push({ x: b.minX, y: b.minY });
    pts.push({ x: b.maxX, y: b.minY });
    pts.push({ x: b.minX, y: b.maxY });
    pts.push({ x: b.maxX, y: b.maxY });
    pts.push({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }); // Midpoint
    return pts;
  }

  // History Undo / Redo
  saveState() {
    const json = this.objects.map(o => JSON.parse(JSON.stringify(o)));
    this.history.push(json);
    if (this.history.length > 50) this.history.shift(); // Limit to 50 states
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

      // Zoom centered at mouse position
      const worldBefore = this.screenToWorld(mouseX, mouseY);
      this.zoom = Math.max(2, Math.min(200, this.zoom * zoomFactor));
      const worldAfter = this.screenToWorld(mouseX, mouseY);

      this.panX += (worldAfter.x - worldBefore.x) * this.zoom;
      this.panY -= (worldAfter.y - worldBefore.y) * this.zoom;
      this.render();
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

      if (this.isPanning) {
        this.panX = e.clientX - this.panStart.x;
        this.panY = e.clientY - this.panStart.y;
        this.render();
        return;
      }

      this.cursorWorld = this.screenToWorld(sx, sy);
      this.snappedWorld = this.getSnappedPoint(this.cursorWorld.x, this.cursorWorld.y);

      // Trigger custom mousemove callback if set
      if (this.onMouseMove) this.onMouseMove(e, this.snappedWorld, this.cursorWorld);

      this.render();
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.style.cursor = this.activeTool === 'pan' ? 'grab' : 'crosshair';
      }
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

    // 2. Draw Floor Plan Trace Overlay if active
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

    // 3. Draw Ground Line (Y = 0)
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

    // 5. Draw Active Tool Drawing Preview (if callback defined)
    if (this.onDrawPreview) {
      this.onDrawPreview(this.ctx, this);
    }

    // 6. Draw Cursor Snap Marker
    if (this.snappedWorld) {
      const sc = this.worldToScreen(this.snappedWorld.x, this.snappedWorld.y);
      this.ctx.beginPath();
      this.ctx.arc(sc.x, sc.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = this.snappedWorld.snappedToObject ? '#c1121f' : '#2d6a4f';
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
  }

  drawGrid() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Calculate visible world bounds
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

      // Major grid line every 10 feet
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
}

window.CADCanvas = CADCanvas;
