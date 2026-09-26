/**
 * RMA Front Elevation Designer - CAD Drawing Tools & Dynamic Input Manager
 * Handles mouse and dynamic floating input overlay for precise geometric creation
 * (Line, Polyline, Rectangle, Wall, Window, Door, Balcony, Column, Slab, Parapet, Stair, Dimension, Text).
 * Supports AutoCAD shortcuts, ORTHO mode (F8), OSNAP, and Parametric Inspector updates.
 */

class CADToolManager {
  constructor(cadCanvas) {
    this.cad = cadCanvas;
    this.isDrawing = false;
    this.startPt = null;
    this.currentPt = null;
    this.drawingPoints = []; // Polyline points
    this.draggedObject = null;
    this.dragOffset = { x: 0, y: 0 };

    // Dynamic Input Overlay Elements
    this.dynamicInputContainer = null;
    this.createDynamicInputDOM();

    this.initCanvasListeners();
    this.initKeyboardShortcuts();
  }

  createDynamicInputDOM() {
    if (typeof document === 'undefined') return;
    let container = document.getElementById('dynamicInputContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'dynamicInputContainer';
      container.className = 'dynamic-input-overlay hidden';
      const viewport = document.getElementById('canvasViewport') || document.body;
      viewport.appendChild(container);
    }
    this.dynamicInputContainer = container;
  }

  showDynamicInput(screenX, screenY, toolName, values = {}) {
    if (!this.dynamicInputContainer) return;

    this.dynamicInputContainer.style.left = `${screenX + 20}px`;
    this.dynamicInputContainer.style.top = `${screenY + 20}px`;
    this.dynamicInputContainer.classList.remove('hidden');

    if (['line', 'wall', 'polyline'].includes(toolName)) {
      const lenStr = typeof Units !== 'undefined' ? Units.format(values.length || 0) : `${(values.length || 0).toFixed(2)}'`;
      const angleStr = `${Math.round(values.angle || 0)}°`;

      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Length:</label>
          <input type="text" id="dynLenInput" value="${lenStr}" class="dyn-input-field">
        </div>
        <div class="dyn-input-group">
          <label>Angle:</label>
          <input type="text" id="dynAngleInput" value="${angleStr}" class="dyn-input-field">
        </div>
      `;
    } else if (['rectangle', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair'].includes(toolName)) {
      const wStr = typeof Units !== 'undefined' ? Units.format(values.width || 0) : `${(values.width || 0).toFixed(2)}'`;
      const hStr = typeof Units !== 'undefined' ? Units.format(values.height || 0) : `${(values.height || 0).toFixed(2)}'`;

      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Width:</label>
          <input type="text" id="dynWidthInput" value="${wStr}" class="dyn-input-field">
        </div>
        <div class="dyn-input-group">
          <label>Height:</label>
          <input type="text" id="dynHeightInput" value="${hStr}" class="dyn-input-field">
        </div>
      `;
    }

    this.attachDynamicInputListeners();
  }

  hideDynamicInput() {
    if (this.dynamicInputContainer) {
      this.dynamicInputContainer.classList.add('hidden');
    }
  }

  attachDynamicInputListeners() {
    if (!this.dynamicInputContainer) return;

    const fields = this.dynamicInputContainer.querySelectorAll('.dyn-input-field');
    fields.forEach(field => {
      field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.applyDynamicInput();
        } else if (e.key === 'Escape') {
          this.isDrawing = false;
          this.hideDynamicInput();
          this.cad.render();
        }
      });
    });
  }

  applyDynamicInput() {
    if (!this.startPt) return;

    const tool = this.cad.activeTool;

    if (['line', 'wall', 'polyline'].includes(tool)) {
      const lenInput = document.getElementById('dynLenInput');
      const angleInput = document.getElementById('dynAngleInput');

      if (lenInput) {
        const distFeet = Units.toFeet(lenInput.value);
        let angleDeg = 0;
        if (angleInput) {
          angleDeg = parseFloat(angleInput.value.replace('°', '')) || 0;
        } else {
          // Keep current mouse angle
          const dx = this.currentPt.x - this.startPt.x;
          const dy = this.currentPt.y - this.startPt.y;
          angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        }

        const rad = (angleDeg * Math.PI) / 180;
        const targetPt = {
          x: this.startPt.x + distFeet * Math.cos(rad),
          y: this.startPt.y + distFeet * Math.sin(rad)
        };

        if (tool === 'line') {
          this.cad.addObject(new CADLine(this.startPt.x, this.startPt.y, targetPt.x, targetPt.y));
        } else if (tool === 'wall') {
          const thickness = 0.75; // 9 inches
          this.cad.addObject(new CADRect(this.startPt.x, this.startPt.y, distFeet, thickness, 'wall'));
        } else if (tool === 'polyline') {
          this.drawingPoints.push(targetPt);
          this.startPt = targetPt;
        }

        this.hideDynamicInput();
        this.isDrawing = false;
        this.cad.render();
      }
    } else if (['rectangle', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair'].includes(tool)) {
      const wInput = document.getElementById('dynWidthInput');
      const hInput = document.getElementById('dynHeightInput');

      if (wInput && hInput) {
        const widthFeet = Units.toFeet(wInput.value);
        const heightFeet = Units.toFeet(hInput.value);
        const minX = this.startPt.x;
        const minY = this.startPt.y;

        let newObj = null;
        switch (tool) {
          case 'rectangle': newObj = new CADRect(minX, minY, widthFeet, heightFeet, 'rectangle'); break;
          case 'wall': newObj = new CADRect(minX, minY, widthFeet, heightFeet, 'wall'); break;
          case 'window': newObj = new CADWindow(minX, minY, widthFeet, heightFeet); break;
          case 'door': newObj = new CADDoor(minX, minY, widthFeet, heightFeet); break;
          case 'balcony': newObj = new CADBalcony(minX, minY, widthFeet, heightFeet); break;
          case 'column': newObj = new CADColumn(minX, minY, widthFeet, heightFeet); break;
          case 'slab': newObj = new CADSlab(minX, minY, widthFeet, heightFeet); break;
          case 'parapet': newObj = new CADParapet(minX, minY, widthFeet, heightFeet); break;
          case 'stair': newObj = new CADStair(minX, minY, widthFeet, heightFeet); break;
        }

        if (newObj) this.cad.addObject(newObj);

        this.hideDynamicInput();
        this.isDrawing = false;
        this.cad.render();
      }
    }
  }

  setTool(toolName) {
    this.cad.activeTool = toolName;
    this.isDrawing = false;
    this.startPt = null;
    this.drawingPoints = [];
    this.cad.onDrawPreview = null;
    this.hideDynamicInput();

    const activeDisplay = typeof document !== 'undefined' ? document.getElementById('activeToolDisplay') : null;
    if (activeDisplay) activeDisplay.textContent = toolName.toUpperCase();

    this.cad.render();
  }

  initKeyboardShortcuts() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      // Avoid overriding input fields
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'F8') {
        e.preventDefault();
        this.cad.orthoLock = !this.cad.orthoLock;
        const btnOrtho = document.getElementById('btnToggleOrtho');
        if (btnOrtho) btnOrtho.classList.toggle('active', this.cad.orthoLock);
        return;
      }

      if (e.key === 'Escape') {
        this.isDrawing = false;
        this.cad.selectedObjects.forEach(o => o.selected = false);
        this.cad.selectedObjects = [];
        this.hideDynamicInput();
        this.renderInspector();
        this.cad.render();
        return;
      }

      // Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.cad.selectedObjects.length > 0) {
          this.cad.deleteSelected();
          this.renderInspector();
        }
      }
    });
  }

  initCanvasListeners() {
    const canvas = this.cad.canvas;
    if (!canvas || !canvas.addEventListener) return;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const pt = this.cad.snappedWorld;

      if (this.cad.activeTool === 'select') {
        this.handleSelectMouseDown(pt, e.shiftKey);
      } else if (this.cad.activeTool === 'eraser') {
        this.handleEraserClick(pt);
      } else {
        this.handleToolMouseDown(pt, e);
      }
    });

    this.cad.onMouseMove = (e, snappedPt, rawPt) => {
      if (this.draggedObject && this.cad.activeTool === 'select') {
        const dx = snappedPt.x - this.dragOffset.x - this.draggedObject.getBounds().minX;
        const dy = snappedPt.y - this.dragOffset.y - this.draggedObject.getBounds().minY;
        this.draggedObject.move(dx, dy);
        this.updateInspectorValues(this.draggedObject);
        return;
      }

      if (this.isDrawing) {
        this.currentPt = { ...snappedPt };

        if (this.cad.orthoLock && this.startPt) {
          const dx = Math.abs(this.currentPt.x - this.startPt.x);
          const dy = Math.abs(this.currentPt.y - this.startPt.y);
          if (dx > dy) {
            this.currentPt.y = this.startPt.y;
          } else {
            this.currentPt.x = this.startPt.x;
          }
        }

        const len = GeometryUtils.distance(this.startPt, this.currentPt);
        const dx = this.currentPt.x - this.startPt.x;
        const dy = this.currentPt.y - this.startPt.y;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const w = Math.abs(dx);
        const h = Math.abs(dy);

        this.showDynamicInput(this.cad.cursorScreen.x, this.cad.cursorScreen.y, this.cad.activeTool, {
          length: len,
          angle: angle,
          width: w,
          height: h
        });

        this.updateDrawPreview();
      }
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('mouseup', (e) => {
        if (this.draggedObject) {
          this.cad.saveState();
          this.draggedObject = null;
        }

        // Complete freehand drag drawing on mouseup if not typing exact numerical input
        if (this.isDrawing && this.cad.activeTool !== 'polyline') {
          const isInputFocused = document.activeElement && document.activeElement.classList.contains('dyn-input-field');
          if (!isInputFocused) {
            this.finishDrawing();
          }
        }
      });
    }

    canvas.addEventListener('dblclick', () => {
      if (this.cad.activeTool === 'polyline' && this.drawingPoints.length > 1) {
        const poly = new CADPolyline([...this.drawingPoints]);
        this.cad.addObject(poly);
        this.isDrawing = false;
        this.drawingPoints = [];
        this.hideDynamicInput();
        this.cad.onDrawPreview = null;
        this.cad.render();
      }
    });
  }

  handleSelectMouseDown(pt, isShift) {
    let hitObj = null;
    for (let i = this.cad.objects.length - 1; i >= 0; i--) {
      if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
        hitObj = this.cad.objects[i];
        break;
      }
    }

    if (hitObj) {
      if (isShift) {
        hitObj.selected = !hitObj.selected;
      } else {
        this.cad.objects.forEach(o => o.selected = false);
        hitObj.selected = true;
      }

      this.draggedObject = hitObj;
      const b = hitObj.getBounds();
      this.dragOffset = { x: pt.x - b.minX, y: pt.y - b.minY };
    } else if (!isShift) {
      this.cad.objects.forEach(o => o.selected = false);
    }

    this.cad.selectedObjects = this.cad.objects.filter(o => o.selected);
    this.updateSelectionDisplay();
    this.renderInspector();
    this.cad.render();
  }

  handleEraserClick(pt) {
    for (let i = this.cad.objects.length - 1; i >= 0; i--) {
      if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
        this.cad.removeObject(this.cad.objects[i]);
        break;
      }
    }
  }

  updateSelectionDisplay() {
    const selCount = this.cad.selectedObjects.length;
    const disp = typeof document !== 'undefined' ? document.getElementById('selectionDisplay') : null;
    if (disp) disp.textContent = `${selCount} object${selCount === 1 ? '' : 's'} selected`;
  }

  handleToolMouseDown(pt, e) {
    if (!this.isDrawing) {
      this.isDrawing = true;
      this.startPt = { ...pt };
      this.currentPt = { ...pt };

      if (this.cad.activeTool === 'polyline') {
        this.drawingPoints.push({ ...pt });
      } else if (this.cad.activeTool === 'text') {
        const textVal = typeof window !== 'undefined' && window.prompt ? prompt('Enter Architectural Text Label:', 'Window W1') : 'Label';
        if (textVal) {
          const textObj = new CADText(pt.x, pt.y, textVal);
          this.cad.addObject(textObj);
        }
        this.isDrawing = false;
      }
    }
  }

  updateDrawPreview() {
    this.cad.onDrawPreview = (ctx, viewport) => {
      if (!this.startPt || !this.currentPt) return;

      const p1 = viewport.worldToScreen(this.startPt.x, this.startPt.y);
      const p2 = viewport.worldToScreen(this.currentPt.x, this.currentPt.y);
      ctx.strokeStyle = '#2d6a4f';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      const w = Math.abs(this.currentPt.x - this.startPt.x);
      const h = Math.abs(this.currentPt.y - this.startPt.y);
      const minX = Math.min(this.startPt.x, this.currentPt.x);
      const minY = Math.min(this.startPt.y, this.currentPt.y);

      switch (this.cad.activeTool) {
        case 'line':
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          break;

        case 'polyline':
          if (this.drawingPoints.length > 0) {
            ctx.beginPath();
            const fp = viewport.worldToScreen(this.drawingPoints[0].x, this.drawingPoints[0].y);
            ctx.moveTo(fp.x, fp.y);
            for (let i = 1; i < this.drawingPoints.length; i++) {
              const cp = viewport.worldToScreen(this.drawingPoints[i].x, this.drawingPoints[i].y);
              ctx.lineTo(cp.x, cp.y);
            }
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          break;

        case 'rectangle':
        case 'wall':
        case 'window':
        case 'door':
        case 'balcony':
        case 'column':
        case 'slab':
        case 'parapet':
        case 'stair': {
          const sp = viewport.worldToScreen(minX, minY + h);
          ctx.strokeRect(sp.x, sp.y, w * viewport.zoom, h * viewport.zoom);
          break;
        }

        case 'circle': {
          const radius = Math.hypot(this.currentPt.x - this.startPt.x, this.currentPt.y - this.startPt.y);
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, radius * viewport.zoom, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }

        case 'arc': {
          const radius = Math.hypot(this.currentPt.x - this.startPt.x, this.currentPt.y - this.startPt.y);
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, radius * viewport.zoom, 0, Math.PI, true);
          ctx.stroke();
          break;
        }

        case 'dimension': {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          break;
        }
      }

      ctx.setLineDash([]);
    };
  }

  finishDrawing() {
    if (!this.startPt || !this.currentPt) return;

    const w = Math.abs(this.currentPt.x - this.startPt.x);
    const h = Math.abs(this.currentPt.y - this.startPt.y);
    const minX = Math.min(this.startPt.x, this.currentPt.x);
    const minY = Math.min(this.startPt.y, this.currentPt.y);

    if (w < 0.1 && h < 0.1 && !['line', 'circle', 'arc', 'dimension'].includes(this.cad.activeTool)) {
      this.isDrawing = false;
      this.hideDynamicInput();
      this.cad.onDrawPreview = null;
      this.cad.render();
      return;
    }

    let newObj = null;

    switch (this.cad.activeTool) {
      case 'line':
        newObj = new CADLine(this.startPt.x, this.startPt.y, this.currentPt.x, this.currentPt.y);
        break;
      case 'rectangle':
        newObj = new CADRect(minX, minY, w, h, 'rectangle');
        break;
      case 'wall':
        newObj = new CADRect(minX, minY, w, h, 'wall');
        break;
      case 'window':
        newObj = new CADWindow(minX, minY, w || 5, h || 4);
        break;
      case 'door':
        newObj = new CADDoor(minX, minY, w || 3.5, h || 7);
        break;
      case 'balcony':
        newObj = new CADBalcony(minX, minY, w || 10, h || 3.5);
        break;
      case 'column':
        newObj = new CADColumn(minX, minY, w || 1.5, h || 10);
        break;
      case 'slab':
        newObj = new CADSlab(minX, minY, w || 40, h || 1);
        break;
      case 'parapet':
        newObj = new CADParapet(minX, minY, w || 40, h || 4);
        break;
      case 'stair':
        newObj = new CADStair(minX, minY, w || 6, h || 4);
        break;
      case 'circle': {
        const radius = Math.hypot(this.currentPt.x - this.startPt.x, this.currentPt.y - this.startPt.y);
        newObj = new CADCircle(this.startPt.x, this.startPt.y, radius || 5);
        break;
      }
      case 'arc': {
        const radius = Math.hypot(this.currentPt.x - this.startPt.x, this.currentPt.y - this.startPt.y);
        newObj = new CADArc(this.startPt.x, this.startPt.y, radius || 5, 0, Math.PI);
        break;
      }
      case 'dimension':
        newObj = new CADDimension(this.startPt.x, this.startPt.y, this.currentPt.x, this.currentPt.y, 1.5);
        break;
    }

    if (newObj) {
      this.cad.addObject(newObj);
    }

    this.isDrawing = false;
    this.startPt = null;
    this.currentPt = null;
    this.hideDynamicInput();
    this.cad.onDrawPreview = null;
    this.cad.render();
  }

  // Parametric Inspector Rendering
  renderInspector() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('inspectorContent');
    if (!container) return;

    if (this.cad.selectedObjects.length === 0) {
      container.innerHTML = '<p class="empty-inspector-msg">Select an object on the canvas to inspect & edit architectural parameters.</p>';
      return;
    }

    if (this.cad.selectedObjects.length > 1) {
      container.innerHTML = `<p class="empty-inspector-msg">${this.cad.selectedObjects.length} objects selected (Multiple selection).</p>`;
      return;
    }

    const obj = this.cad.selectedObjects[0];
    let html = `<div class="form-group"><label>Object Type:</label><input class="input-text" value="${obj.type.toUpperCase()}" disabled></div>`;

    if (['rectangle', 'wall', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair'].includes(obj.type)) {
      const unitLabel = typeof Units !== 'undefined' ? Units.currentUnit : 'ft';
      html += `
        <div class="form-grid-2col">
          <div class="form-group"><label>X Position:</label><input type="number" id="inspX" class="input-text" step="0.1" value="${obj.x.toFixed(2)}"></div>
          <div class="form-group"><label>Y Position:</label><input type="number" id="inspY" class="input-text" step="0.1" value="${obj.y.toFixed(2)}"></div>
          <div class="form-group"><label>Width (${unitLabel}):</label><input type="number" id="inspW" class="input-text" step="0.1" value="${obj.width.toFixed(2)}"></div>
          <div class="form-group"><label>Height (${unitLabel}):</label><input type="number" id="inspH" class="input-text" step="0.1" value="${obj.height.toFixed(2)}"></div>
        </div>
      `;

      if (obj.type === 'window') {
        html += `
          <div class="form-group"><label>Sill Height:</label><input type="number" id="inspSill" class="input-text" value="${obj.sillHeight}"></div>
          <div class="form-group"><label>Frame Type:</label>
            <select id="inspFrame" class="input-select">
              <option value="Aluminium Glass" ${obj.frameType === 'Aluminium Glass' ? 'selected' : ''}>Aluminium Glass</option>
              <option value="UPVC White" ${obj.frameType === 'UPVC White' ? 'selected' : ''}>UPVC White</option>
              <option value="Teak Wood" ${obj.frameType === 'Teak Wood' ? 'selected' : ''}>Teak Wood</option>
              <option value="Black Anodized" ${obj.frameType === 'Black Anodized' ? 'selected' : ''}>Black Anodized</option>
            </select>
          </div>
          <div class="form-group"><label>Shutters:</label><input type="number" id="inspShutters" class="input-text" min="1" max="6" value="${obj.shutters}"></div>
        `;
      }

      if (obj.type === 'door') {
        html += `
          <div class="form-group"><label>Door Type:</label>
            <select id="inspDoorType" class="input-select">
              <option value="Main Entrance Door" ${obj.doorType === 'Main Entrance Door' ? 'selected' : ''}>Main Entrance Door</option>
              <option value="Service Door" ${obj.doorType === 'Service Door' ? 'selected' : ''}>Service Door</option>
              <option value="Garage Door" ${obj.doorType === 'Garage Door' ? 'selected' : ''}>Garage Door</option>
            </select>
          </div>
        `;
      }

      if (obj.type === 'balcony') {
        html += `
          <div class="form-group"><label>Railing Type:</label>
            <select id="inspRailing" class="input-select">
              <option value="Glass Railing" ${obj.railingType === 'Glass Railing' ? 'selected' : ''}>Glass Railing</option>
              <option value="Metal Vertical Fins" ${obj.railingType === 'Metal Vertical Fins' ? 'selected' : ''}>Metal Vertical Fins</option>
              <option value="Brick Parapet" ${obj.railingType === 'Brick Parapet' ? 'selected' : ''}>Brick Parapet</option>
            </select>
          </div>
        `;
      }
    }

    container.innerHTML = html;
    this.attachInspectorEvents(obj);
  }

  attachInspectorEvents(obj) {
    const bindInput = (id, prop, isNum = true) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        this.cad.saveState();
        obj[prop] = isNum ? parseFloat(el.value) : el.value;
        this.cad.render();
      });
    };

    bindInput('inspX', 'x');
    bindInput('inspY', 'y');
    bindInput('inspW', 'width');
    bindInput('inspH', 'height');
    bindInput('inspSill', 'sillHeight');
    bindInput('inspFrame', 'frameType', false);
    bindInput('inspShutters', 'shutters');
    bindInput('inspDoorType', 'doorType', false);
    bindInput('inspRailing', 'railingType', false);
  }

  updateInspectorValues(obj) {
    const setVal = (id, val) => {
      const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
      if (el) el.value = typeof val === 'number' ? val.toFixed(2) : val;
    };
    setVal('inspX', obj.x);
    setVal('inspY', obj.y);
  }
}

if (typeof window !== 'undefined') {
  window.CADToolManager = CADToolManager;
}
