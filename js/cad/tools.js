/**
 * RMA Front Elevation Designer - CAD Drawing Tools & Dynamic Input Manager
 * Implements AutoCAD click-based drafting state machine (Click -> Point Fixed -> Preview -> Dynamic Input -> Exact Geometry).
 * Supports continuous LINE / POLYLINE drawing, RECTANGLE, CIRCLE, ARC, WALL, WINDOW, DOOR, BALCONY, COLUMN, SLAB, PARAPET, STAIR, DIMENSION, and TEXT.
 * Strictly avoids click-and-drag requirement. Single mouse click fixes points immediately.
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
    this.currentToolMode = null;

    // Persistent OFFSET State
    this.lastOffsetDistance = 0.75; // Default 9 inches (0.75 ft)
    this.offsetState = null; // 'WAITING_FOR_DISTANCE', 'SELECT_OBJECT', 'SELECT_SIDE'
    this.offsetSourceObject = null;

    // Persistent EXTEND State
    this.extendState = null; // 'SELECT_BOUNDARIES', 'SELECT_LINE_TO_EXTEND'
    this.extendBoundaries = [];

    // Window / Crossing Selection State
    this.isSelectionBox = false;
    this.selectionStartPt = null;
    this.selectionCurrentPt = null;

    // Dynamic Input Overlay Elements
    this.dynamicInputContainer = null;
    this.createDynamicInputDOM();

    this.initCanvasListeners();
    this.initKeyboardShortcuts();
  }

  setOffsetState(state) {
    this.offsetState = state;
    if (state === 'SELECT_OBJECT') {
      this.offsetSourceObject = null;
      this.cad.onDrawPreview = null;
      if (window.cadCommandLine) {
        const distStr = typeof Units !== 'undefined' ? Units.format(this.lastOffsetDistance) : `${this.lastOffsetDistance}'`;
        window.cadCommandLine.setPrompt(`OFFSET — Select object to offset [Distance = ${distStr}]:`);
        window.cadCommandLine.setActiveBadge(`OFFSET (${distStr})`);
      }
    } else if (state === 'SELECT_SIDE') {
      if (window.cadCommandLine) {
        window.cadCommandLine.setPrompt('OFFSET — Specify point on side to offset:');
      }
    }
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

    // Stop mouse event propagation from dynamic input box to underlying canvas
    ['mousedown', 'mouseup', 'click', 'dblclick', 'pointerdown', 'pointerup'].forEach(evtType => {
      container.addEventListener(evtType, (e) => {
        e.stopPropagation();
      });
    });

    this.dynamicInputContainer = container;
  }

  setupDynamicInputDOM(toolName) {
    if (!this.dynamicInputContainer) return;

    if (this.currentToolMode === toolName && this.dynamicInputContainer.children.length > 0) {
      return; // DOM structure already initialized for this tool
    }

    this.currentToolMode = toolName;

    if (['line', 'wall', 'polyline'].includes(toolName)) {
      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Length:</label>
          <input type="text" id="dynLenInput" class="dyn-input-field" autocomplete="off" placeholder="5'">
        </div>
        <div class="dyn-input-group">
          <label>Angle:</label>
          <input type="text" id="dynAngleInput" class="dyn-input-field" autocomplete="off" placeholder="0°">
        </div>
      `;
    } else if (['rectangle', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair'].includes(toolName)) {
      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Width:</label>
          <input type="text" id="dynWidthInput" class="dyn-input-field" autocomplete="off" placeholder="10'">
        </div>
        <div class="dyn-input-group">
          <label>Height:</label>
          <input type="text" id="dynHeightInput" class="dyn-input-field" autocomplete="off" placeholder="8'">
        </div>
      `;
    } else if (['circle', 'arc'].includes(toolName)) {
      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Radius:</label>
          <input type="text" id="dynRadiusInput" class="dyn-input-field" autocomplete="off" placeholder="3'">
        </div>
      `;
    } else if (toolName === 'dimension') {
      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Distance:</label>
          <input type="text" id="dynLenInput" class="dyn-input-field" autocomplete="off" placeholder="5'">
        </div>
      `;
    }

    this.attachDynamicInputListeners();
  }

  showDynamicInput(screenX, screenY, toolName, values = {}) {
    if (!this.dynamicInputContainer) return;

    // 1. Position overlay container near cursor
    this.dynamicInputContainer.style.left = `${screenX + 20}px`;
    this.dynamicInputContainer.style.top = `${screenY + 20}px`;
    this.dynamicInputContainer.classList.remove('hidden');

    // 2. Build DOM layout if not present
    this.setupDynamicInputDOM(toolName);

    // 3. Update field values ONLY IF user is NOT actively focusing/typing in the field
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;

    const formattedLen = typeof Units !== 'undefined' ? Units.format(values.length || 0) : `${(values.length || 0).toFixed(2)}'`;
    const formattedWidth = typeof Units !== 'undefined' ? Units.format(values.width || 0) : `${(values.width || 0).toFixed(2)}'`;
    const formattedHeight = typeof Units !== 'undefined' ? Units.format(values.height || 0) : `${(values.height || 0).toFixed(2)}'`;
    const formattedRadius = typeof Units !== 'undefined' ? Units.format(values.radius || 0) : `${(values.radius || 0).toFixed(2)}'`;
    const formattedAngle = `${Math.round(values.angle || 0)}°`;

    const updateField = (id, valStr) => {
      const field = document.getElementById(id);
      if (field && activeEl !== field) {
        field.value = valStr;
      }
    };

    if (['line', 'wall', 'polyline', 'dimension'].includes(toolName)) {
      updateField('dynLenInput', formattedLen);
      updateField('dynAngleInput', formattedAngle);
    } else if (['rectangle', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair'].includes(toolName)) {
      updateField('dynWidthInput', formattedWidth);
      updateField('dynHeightInput', formattedHeight);
    } else if (['circle', 'arc'].includes(toolName)) {
      updateField('dynRadiusInput', formattedRadius);
    }
  }

  hideDynamicInput() {
    if (this.dynamicInputContainer) {
      this.dynamicInputContainer.classList.add('hidden');
    }
    this.currentToolMode = null;
  }

  attachDynamicInputListeners() {
    if (!this.dynamicInputContainer) return;

    const fields = Array.from(this.dynamicInputContainer.querySelectorAll('.dyn-input-field'));
    fields.forEach((field, index) => {
      field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.applyDynamicInput();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelDrawing();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const nextIndex = (index + 1) % fields.length;
          fields[nextIndex].focus();
          fields[nextIndex].select();
        }
      });

      field.addEventListener('input', () => {
        this.updatePreviewFromInput();
      });
    });
  }

  updatePreviewFromInput() {
    if (!this.startPt) return;

    const tool = this.cad.activeTool;

    if (['line', 'wall', 'polyline', 'dimension'].includes(tool)) {
      const lenInput = document.getElementById('dynLenInput');
      const angleInput = document.getElementById('dynAngleInput');

      if (lenInput && lenInput.value) {
        const distFeet = typeof Units !== 'undefined' ? Units.toFeet(lenInput.value) : (parseFloat(lenInput.value) || 0);
        let angleDeg = 0;

        if (angleInput && angleInput.value) {
          angleDeg = parseFloat(angleInput.value.replace('°', '')) || 0;
        } else if (this.currentPt) {
          const dx = this.currentPt.x - this.startPt.x;
          const dy = this.currentPt.y - this.startPt.y;
          angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        }

        const rad = (angleDeg * Math.PI) / 180;
        this.currentPt = {
          x: this.startPt.x + distFeet * Math.cos(rad),
          y: this.startPt.y + distFeet * Math.sin(rad)
        };
        this.cad.render();
      }
    } else if (['rectangle', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair'].includes(tool)) {
      const wInput = document.getElementById('dynWidthInput');
      const hInput = document.getElementById('dynHeightInput');

      if (wInput && hInput) {
        const w = typeof Units !== 'undefined' ? Units.toFeet(wInput.value) : (parseFloat(wInput.value) || 0);
        const h = typeof Units !== 'undefined' ? Units.toFeet(hInput.value) : (parseFloat(hInput.value) || 0);

        this.currentPt = {
          x: this.startPt.x + w,
          y: this.startPt.y + h
        };
        this.cad.render();
      }
    } else if (['circle', 'arc'].includes(tool)) {
      const rInput = document.getElementById('dynRadiusInput');
      if (rInput) {
        const r = typeof Units !== 'undefined' ? Units.toFeet(rInput.value) : (parseFloat(rInput.value) || 0);
        this.currentPt = {
          x: this.startPt.x + r,
          y: this.startPt.y
        };
        this.cad.render();
      }
    }
  }

  applyDynamicInput() {
    if (!this.startPt) return;

    const tool = this.cad.activeTool;

    if (['line', 'wall', 'polyline', 'dimension'].includes(tool)) {
      const lenInput = document.getElementById('dynLenInput');
      const angleInput = document.getElementById('dynAngleInput');

      if (lenInput) {
        const distFeet = typeof Units !== 'undefined' ? Units.toFeet(lenInput.value) : (parseFloat(lenInput.value) || 0);
        let angleDeg = 0;

        if (angleInput && angleInput.value) {
          angleDeg = parseFloat(angleInput.value.replace('°', '')) || 0;
        } else if (this.currentPt) {
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
          // AutoCAD continuous LINE: endpoint becomes next active point
          this.startPt = { ...targetPt };
          this.currentPt = { ...targetPt };
          if (window.cadCommandLine) {
            window.cadCommandLine.setPrompt('Specify next point or [Length/Angle]:');
            window.cadCommandLine.logMessage(`Length = ${typeof Units !== 'undefined' ? Units.format(distFeet) : distFeet + "'"}`);
          }
          // Reset DOM so new segment shows fresh initial field state
          this.currentToolMode = null;
          this.setupDynamicInputDOM(tool);
          const primaryInput = document.getElementById('dynLenInput');
          if (primaryInput) {
            primaryInput.focus();
            primaryInput.select();
          }
        } else if (tool === 'polyline') {
          this.drawingPoints.push({ ...targetPt });
          this.startPt = { ...targetPt };
          this.currentPt = { ...targetPt };
          if (window.cadCommandLine) {
            window.cadCommandLine.setPrompt('Specify next point or [ENTER to finish]:');
            window.cadCommandLine.logMessage(`Segment = ${typeof Units !== 'undefined' ? Units.format(distFeet) : distFeet + "'"}`);
          }
          this.currentToolMode = null;
          this.setupDynamicInputDOM(tool);
          const primaryInput = document.getElementById('dynLenInput');
          if (primaryInput) {
            primaryInput.focus();
            primaryInput.select();
          }
        } else if (tool === 'wall') {
          const thickness = 0.75; // 9 inches standard
          this.cad.addObject(new CADRect(this.startPt.x, this.startPt.y, distFeet, thickness, 'wall'));
          this.cancelDrawing();
        } else if (tool === 'dimension') {
          this.cad.addObject(new CADDimension(this.startPt.x, this.startPt.y, targetPt.x, targetPt.y, 1.5));
          this.cancelDrawing();
        }

        this.cad.render();
      }
    } else if (['rectangle', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair'].includes(tool)) {
      const wInput = document.getElementById('dynWidthInput');
      const hInput = document.getElementById('dynHeightInput');

      if (wInput && hInput) {
        const widthFeet = typeof Units !== 'undefined' ? Units.toFeet(wInput.value) : (parseFloat(wInput.value) || 0);
        const heightFeet = typeof Units !== 'undefined' ? Units.toFeet(hInput.value) : (parseFloat(hInput.value) || 0);
        const minX = this.startPt.x;
        const minY = this.startPt.y;

        let newObj = null;
        switch (tool) {
          case 'rectangle': newObj = new CADRect(minX, minY, widthFeet, heightFeet, 'rectangle'); break;
          case 'window': newObj = new CADWindow(minX, minY, widthFeet, heightFeet); break;
          case 'door': newObj = new CADDoor(minX, minY, widthFeet, heightFeet); break;
          case 'balcony': newObj = new CADBalcony(minX, minY, widthFeet, heightFeet); break;
          case 'column': newObj = new CADColumn(minX, minY, widthFeet, heightFeet); break;
          case 'slab': newObj = new CADSlab(minX, minY, widthFeet, heightFeet); break;
          case 'parapet': newObj = new CADParapet(minX, minY, widthFeet, heightFeet); break;
          case 'stair': newObj = new CADStair(minX, minY, widthFeet, heightFeet); break;
        }

        if (newObj) {
          this.cad.addObject(newObj);
          if (window.cadCommandLine) {
            const wStr = typeof Units !== 'undefined' ? Units.format(widthFeet) : `${widthFeet}'`;
            const hStr = typeof Units !== 'undefined' ? Units.format(heightFeet) : `${heightFeet}'`;
            window.cadCommandLine.logMessage(`${tool.toUpperCase()} created: ${wStr} x ${hStr}`);
            window.cadCommandLine.setPrompt(`Specify first corner of next ${tool}:`);
          }
        }
        this.isDrawing = false;
        this.startPt = null;
        this.currentPt = null;
        this.hideDynamicInput();
        this.cad.onDrawPreview = null;
      }
    } else if (tool === 'circle') {
      const rInput = document.getElementById('dynRadiusInput');
      if (rInput) {
        const radiusFeet = typeof Units !== 'undefined' ? Units.toFeet(rInput.value) : (parseFloat(rInput.value) || 0);
        this.cad.addObject(new CADCircle(this.startPt.x, this.startPt.y, radiusFeet));
        if (window.cadCommandLine) {
          const rStr = typeof Units !== 'undefined' ? Units.format(radiusFeet) : `${radiusFeet}'`;
          window.cadCommandLine.logMessage(`CIRCLE created: Radius = ${rStr}`);
          window.cadCommandLine.setPrompt('Specify center point of next circle:');
        }
        this.isDrawing = false;
        this.startPt = null;
        this.currentPt = null;
        this.hideDynamicInput();
        this.cad.onDrawPreview = null;
      }
    } else if (tool === 'arc') {
      const rInput = document.getElementById('dynRadiusInput');
      if (rInput) {
        const radiusFeet = typeof Units !== 'undefined' ? Units.toFeet(rInput.value) : (parseFloat(rInput.value) || 0);
        this.cad.addObject(new CADArc(this.startPt.x, this.startPt.y, radiusFeet, 0, Math.PI));
        if (window.cadCommandLine) {
          const rStr = typeof Units !== 'undefined' ? Units.format(radiusFeet) : `${radiusFeet}'`;
          window.cadCommandLine.logMessage(`ARC created: Radius = ${rStr}`);
          window.cadCommandLine.setPrompt('Specify start point of next arc:');
        }
        this.isDrawing = false;
        this.startPt = null;
        this.currentPt = null;
        this.hideDynamicInput();
        this.cad.onDrawPreview = null;
      }
    }
  }

  cancelDrawing() {
    if (this.activeTool === 'polyline' && this.drawingPoints.length > 1) {
      this.finishPolyline();
      return;
    }

    this.isDrawing = false;
    this.startPt = null;
    this.currentPt = null;
    this.drawingPoints = [];
    this.offsetState = null;
    this.offsetSourceObject = null;
    this.extendState = null;
    if (this.extendBoundaries) {
      this.extendBoundaries.forEach(b => b.selected = false);
    }
    this.extendBoundaries = [];
    this.isSelectionBox = false;
    this.selectionStartPt = null;
    this.selectionCurrentPt = null;
    this.hideDynamicInput();
    this.cad.onDrawPreview = null;
    if (window.cadCommandLine) {
      window.cadCommandLine.setPrompt('Command:');
      window.cadCommandLine.setActiveBadge(null);
    }
    this.cad.render();
  }

  finishPolyline() {
    if (this.drawingPoints.length > 1) {
      const poly = new CADPolyline([...this.drawingPoints]);
      this.cad.addObject(poly);
      if (window.cadCommandLine) {
        window.cadCommandLine.logMessage(`POLYLINE created (${this.drawingPoints.length} vertices).`);
      }
    }
    this.isDrawing = false;
    this.startPt = null;
    this.currentPt = null;
    this.drawingPoints = [];
    this.hideDynamicInput();
    this.cad.onDrawPreview = null;
    if (window.cadCommandLine) {
      window.cadCommandLine.setPrompt('Command:');
    }
    this.cad.render();
  }

  setTool(toolName) {
    if (this.isDrawing) {
      this.cancelDrawing();
    }
    this.cad.activeTool = toolName;
    this.isDrawing = false;
    this.startPt = null;
    this.currentPt = null;
    this.drawingPoints = [];
    this.offsetState = null;
    this.offsetSourceObject = null;
    this.cad.onDrawPreview = null;
    this.hideDynamicInput();

    const activeDisplay = typeof document !== 'undefined' ? document.getElementById('activeToolDisplay') : null;
    if (activeDisplay) activeDisplay.textContent = toolName.toUpperCase();

    if (toolName === 'offset') {
      const distVal = this.lastOffsetDistance || 0.75;
      const formattedDist = typeof Units !== 'undefined' ? Units.format(distVal) : `${distVal}'`;
      this.offsetState = 'WAITING_FOR_DISTANCE';
      if (window.cadCommandLine) {
        window.cadCommandLine.startCommand('OFFSET', `Specify offset distance or <${formattedDist}>:`);
        window.cadCommandLine.setActiveBadge(`OFFSET (${formattedDist})`);
      }
    } else if (toolName === 'extend') {
      this.extendState = 'SELECT_BOUNDARIES';
      this.extendBoundaries = [];
      if (window.cadCommandLine) {
        window.cadCommandLine.startCommand('EXTEND', 'EXTEND — Select boundary edges or <Press ENTER for all>:');
        window.cadCommandLine.setActiveBadge('EXTEND');
      }
    } else if (window.cadCommandLine) {
      if (toolName && !['select', 'pan', 'zoom'].includes(toolName)) {
        window.cadCommandLine.setActiveBadge(toolName);
      } else {
        window.cadCommandLine.setActiveBadge(null);
      }
    }

    this.cad.render();
  }

  initKeyboardShortcuts() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (e.key === 'F8') {
        e.preventDefault();
        this.cad.orthoLock = !this.cad.orthoLock;
        const btnOrtho = document.getElementById('btnToggleOrtho');
        if (btnOrtho) btnOrtho.classList.toggle('active', this.cad.orthoLock);
        return;
      }

      if (e.key === 'Escape') {
        if (this.isDrawing) {
          this.cancelDrawing();
        } else {
          this.cad.selectedObjects.forEach(o => o.selected = false);
          this.cad.selectedObjects = [];
          this.hideDynamicInput();
          this.renderInspector();
          this.cad.render();
        }
        return;
      }

      if (this.isDrawing) {
        if (e.key === 'Enter') {
          const activeEl = document.activeElement;
          const isField = activeEl && activeEl.classList.contains('dyn-input-field');
          if (isField) {
            e.preventDefault();
            this.applyDynamicInput();
          } else {
            e.preventDefault();
            if (this.cad.activeTool === 'line') {
              this.cancelDrawing();
            } else if (this.cad.activeTool === 'polyline') {
              this.finishPolyline();
            } else {
              this.applyDynamicInput();
            }
          }
          return;
        }

        // Direct numeric / keyboard redirection to dynamic input without losing focus
        const isInputFocused = document.activeElement && document.activeElement.tagName === 'INPUT';
        if (!isInputFocused && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          const primaryInput = this.dynamicInputContainer ? this.dynamicInputContainer.querySelector('.dyn-input-field') : null;
          if (primaryInput) {
            primaryInput.focus();
          }
        }
        return;
      }

      // Delete selected objects when not drawing
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
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

      if (this.isSelectionBox && this.selectionStartPt) {
        this.selectionCurrentPt = { ...snappedPt };
        const p1 = this.selectionStartPt;
        const p2 = this.selectionCurrentPt;
        const dx = p2.x - p1.x;

        this.cad.onDrawPreview = (ctx, viewport) => {
          const sp1 = viewport.worldToScreen(Math.min(p1.x, p2.x), Math.max(p1.y, p2.y));
          const sw = Math.abs(p2.x - p1.x) * viewport.zoom;
          const sh = Math.abs(p2.y - p1.y) * viewport.zoom;

          ctx.save();
          if (dx >= 0) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
          } else {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
          }

          ctx.fillRect(sp1.x, sp1.y, sw, sh);
          ctx.strokeRect(sp1.x, sp1.y, sw, sh);
          ctx.restore();
        };
        this.cad.render();
        return;
      }

      if (this.cad.activeTool === 'offset' && this.offsetSourceObject && this.offsetState === 'SELECT_SIDE') {
        const previewObjs = this.offsetSourceObject.offset(this.lastOffsetDistance, snappedPt);
        this.cad.onDrawPreview = (ctx, viewport) => {
          if (!previewObjs || !previewObjs.length) return;
          ctx.save();
          ctx.strokeStyle = '#2b9348';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          previewObjs.forEach(po => po.draw(ctx, viewport));
          ctx.restore();
        };
        this.cad.render();
        return;
      }

      if (this.isDrawing && this.startPt) {
        this.currentPt = { ...snappedPt };

        if (this.cad.orthoLock) {
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
        const radius = Math.hypot(dx, dy);

        this.showDynamicInput(this.cad.cursorScreen.x, this.cad.cursorScreen.y, this.cad.activeTool, {
          length: len,
          angle: angle,
          width: w,
          height: h,
          radius: radius
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
        if (this.isSelectionBox && this.selectionStartPt && this.selectionCurrentPt) {
          const dx = Math.abs(this.selectionCurrentPt.x - this.selectionStartPt.x);
          const dy = Math.abs(this.selectionCurrentPt.y - this.selectionStartPt.y);
          if (dx > 0.2 || dy > 0.2) {
            this.commitBoxSelection();
          }
        }
      });
    }

    canvas.addEventListener('dblclick', () => {
      if (this.cad.activeTool === 'polyline' && this.drawingPoints.length > 1) {
        this.finishPolyline();
      }
    });
  }

  commitBoxSelection() {
    if (!this.isSelectionBox || !this.selectionStartPt || !this.selectionCurrentPt) return;

    const box = {
      x1: this.selectionStartPt.x,
      y1: this.selectionStartPt.y,
      x2: this.selectionCurrentPt.x,
      y2: this.selectionCurrentPt.y
    };

    const dx = box.x2 - box.x1;
    const dy = box.y2 - box.y1;

    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      const isWindowSelection = dx >= 0;
      const selected = this.cad.objects.filter(o => {
        return isWindowSelection
          ? GeometryUtils.isObjectCompletelyInsideBox(o, box)
          : GeometryUtils.isObjectInsideOrIntersectingBox(o, box);
      });

      this.cad.objects.forEach(o => o.selected = selected.includes(o));
      this.cad.selectedObjects = selected;

      const modeLabel = isWindowSelection ? 'Window selection' : 'Crossing selection';
      if (window.cadCommandLine) {
        window.cadCommandLine.logMessage(`${selected.length} objects selected (${modeLabel}).`);
      }
      this.updateSelectionDisplay();
      this.renderInspector();
    }

    this.isSelectionBox = false;
    this.selectionStartPt = null;
    this.selectionCurrentPt = null;
    this.cad.onDrawPreview = null;
    this.cad.render();
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
      this.cad.selectedObjects = this.cad.objects.filter(o => o.selected);
      this.updateSelectionDisplay();
      this.renderInspector();
      this.cad.render();
    } else if (!this.isSelectionBox) {
      this.isSelectionBox = true;
      this.selectionStartPt = { ...pt };
      this.selectionCurrentPt = { ...pt };
      if (!isShift) {
        this.cad.objects.forEach(o => o.selected = false);
        this.cad.selectedObjects = [];
      }
    } else {
      this.commitBoxSelection();
    }
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
    const tool = this.cad.activeTool;

    if (tool === 'extend') {
      if (this.extendState === 'SELECT_BOUNDARIES') {
        let hitObj = null;
        for (let i = this.cad.objects.length - 1; i >= 0; i--) {
          if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
            hitObj = this.cad.objects[i];
            break;
          }
        }
        if (hitObj) {
          if (!this.extendBoundaries.includes(hitObj)) {
            this.extendBoundaries.push(hitObj);
            hitObj.selected = true;
            this.cad.render();
            if (window.cadCommandLine) {
              window.cadCommandLine.logMessage(`Boundary object added (${this.extendBoundaries.length} total). Press ENTER when done selecting boundaries.`);
            }
          }
        } else {
          this.extendState = 'SELECT_LINE_TO_EXTEND';
          if (window.cadCommandLine) {
            window.cadCommandLine.setPrompt('EXTEND — Select object to extend:');
          }
        }
      } else if (this.extendState === 'SELECT_LINE_TO_EXTEND') {
        let hitLine = null;
        for (let i = this.cad.objects.length - 1; i >= 0; i--) {
          if (this.cad.objects[i].type === 'line' && this.cad.objects[i].hitTest(pt.x, pt.y)) {
            hitLine = this.cad.objects[i];
            break;
          }
        }

        if (hitLine) {
          const d1 = GeometryUtils.distance(pt, { x: hitLine.x1, y: hitLine.y1 });
          const d2 = GeometryUtils.distance(pt, { x: hitLine.x2, y: hitLine.y2 });

          let fixedPt, extendEndPt, isP1;
          if (d1 < d2) {
            fixedPt = { x: hitLine.x2, y: hitLine.y2 };
            extendEndPt = { x: hitLine.x1, y: hitLine.y1 };
            isP1 = true;
          } else {
            fixedPt = { x: hitLine.x1, y: hitLine.y1 };
            extendEndPt = { x: hitLine.x2, y: hitLine.y2 };
            isP1 = false;
          }

          const boundaries = this.extendBoundaries.length > 0
            ? this.extendBoundaries
            : this.cad.objects.filter(o => o !== hitLine);

          const intersections = GeometryUtils.findRayObjectIntersections(fixedPt, extendEndPt, boundaries);

          if (intersections.length > 0) {
            this.cad.saveState();
            const target = intersections[0];
            if (isP1) {
              hitLine.x1 = target.x;
              hitLine.y1 = target.y;
            } else {
              hitLine.x2 = target.x;
              hitLine.y2 = target.y;
            }
            this.cad.render();
            if (window.cadCommandLine) {
              window.cadCommandLine.logMessage('Line extended to boundary.');
            }
          } else if (window.cadCommandLine) {
            window.cadCommandLine.logMessage('No valid boundary intersection found in extension direction.');
          }
        } else if (window.cadCommandLine) {
          window.cadCommandLine.logMessage('Select a valid line to extend.');
        }
      }
      return;
    }

    if (tool === 'offset') {
      if (this.offsetState === 'SELECT_OBJECT' || !this.offsetSourceObject) {
        let hitObj = null;
        for (let i = this.cad.objects.length - 1; i >= 0; i--) {
          if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
            hitObj = this.cad.objects[i];
            break;
          }
        }
        if (hitObj) {
          this.offsetSourceObject = hitObj;
          this.setOffsetState('SELECT_SIDE');
        } else if (window.cadCommandLine) {
          window.cadCommandLine.logMessage('No object selected. Click directly on a line or shape to offset.');
        }
      } else if (this.offsetState === 'SELECT_SIDE' && this.offsetSourceObject) {
        const newObjs = this.offsetSourceObject.offset(this.lastOffsetDistance, pt);
        if (newObjs && newObjs.length > 0) {
          newObjs.forEach(no => this.cad.addObject(no));
          const formattedDist = typeof Units !== 'undefined' ? Units.format(this.lastOffsetDistance) : `${this.lastOffsetDistance}'`;
          if (window.cadCommandLine) {
            window.cadCommandLine.logMessage(`Offset created: ${formattedDist}`);
          }
        }
        // Repeat OFFSET command for next object
        this.setOffsetState('SELECT_OBJECT');
      }
      return;
    }

    if (tool === 'text') {
      const textVal = typeof window !== 'undefined' && window.prompt ? prompt('Enter Architectural Text Label:', 'Window W1') : 'Label';
      if (textVal) {
        const textObj = new CADText(pt.x, pt.y, textVal);
        this.cad.addObject(textObj);
      }
      return;
    }

    if (!this.isDrawing) {
      // Step 1: Fix FIRST POINT immediately on single mouse click
      this.isDrawing = true;
      this.startPt = { ...pt };
      this.currentPt = { ...pt };

      if (tool === 'polyline') {
        this.drawingPoints = [{ ...pt }];
      }

      if (window.cadCommandLine) {
        if (['line', 'polyline', 'wall'].includes(tool)) {
          window.cadCommandLine.setPrompt('Specify next point or [Length/Angle]:');
        } else if (tool === 'circle') {
          window.cadCommandLine.setPrompt('Specify radius:');
        } else if (['rectangle', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair'].includes(tool)) {
          window.cadCommandLine.setPrompt('Specify opposite corner or [Width/Height]:');
        }
      }

      this.showDynamicInput(this.cad.cursorScreen.x, this.cad.cursorScreen.y, tool, {
        length: 0, angle: 0, width: 0, height: 0, radius: 0
      });

      // Focus input field immediately so keyboard works directly
      if (this.dynamicInputContainer) {
        const primaryInput = this.dynamicInputContainer.querySelector('.dyn-input-field');
        if (primaryInput) {
          primaryInput.focus();
          primaryInput.select();
        }
      }

      this.updateDrawPreview();
      this.cad.render();
    } else {
      // Step 2: Fix SECOND POINT on subsequent mouse click
      this.currentPt = { ...pt };

      if (this.cad.orthoLock) {
        const dx = Math.abs(this.currentPt.x - this.startPt.x);
        const dy = Math.abs(this.currentPt.y - this.startPt.y);
        if (dx > dy) {
          this.currentPt.y = this.startPt.y;
        } else {
          this.currentPt.x = this.startPt.x;
        }
      }

      const w = Math.abs(this.currentPt.x - this.startPt.x);
      const h = Math.abs(this.currentPt.y - this.startPt.y);
      const minX = Math.min(this.startPt.x, this.currentPt.x);
      const minY = Math.min(this.startPt.y, this.currentPt.y);

      let newObj = null;

      switch (tool) {
        case 'line':
          newObj = new CADLine(this.startPt.x, this.startPt.y, this.currentPt.x, this.currentPt.y);
          this.cad.addObject(newObj);
          // AutoCAD continuous LINE: endpoint becomes next start point
          this.startPt = { ...this.currentPt };
          if (window.cadCommandLine) {
            window.cadCommandLine.setPrompt('Specify next point or [Length/Angle]:');
          }
          break;

        case 'polyline':
          this.drawingPoints.push({ ...this.currentPt });
          this.startPt = { ...this.currentPt };
          if (window.cadCommandLine) {
            window.cadCommandLine.setPrompt('Specify next point or [ENTER to finish]:');
          }
          break;

        case 'rectangle': newObj = new CADRect(minX, minY, w, h, 'rectangle'); break;
        case 'wall': newObj = new CADRect(minX, minY, w, h, 'wall'); break;
        case 'window': newObj = new CADWindow(minX, minY, w || 5, h || 4); break;
        case 'door': newObj = new CADDoor(minX, minY, w || 3.5, h || 7); break;
        case 'balcony': newObj = new CADBalcony(minX, minY, w || 10, h || 3.5); break;
        case 'column': newObj = new CADColumn(minX, minY, w || 1.5, h || 10); break;
        case 'slab': newObj = new CADSlab(minX, minY, w || 40, h || 1); break;
        case 'parapet': newObj = new CADParapet(minX, minY, w || 40, h || 4); break;
        case 'stair': newObj = new CADStair(minX, minY, w || 6, h || 4); break;

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

      if (newObj && tool !== 'line' && tool !== 'polyline') {
        this.cad.addObject(newObj);
        this.cancelDrawing();
      } else {
        this.cad.render();
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CADToolManager };
}
