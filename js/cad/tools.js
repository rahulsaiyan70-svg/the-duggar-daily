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

    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const isFieldFocused = activeEl && this.dynamicInputContainer.contains(activeEl);

    // If user is actively typing/editing inside dynamic input, update position only and preserve typed values
    if (isFieldFocused) {
      return;
    }

    const formattedLen = typeof Units !== 'undefined' ? Units.format(values.length || 0) : `${(values.length || 0).toFixed(2)}'`;
    const formattedWidth = typeof Units !== 'undefined' ? Units.format(values.width || 0) : `${(values.width || 0).toFixed(2)}'`;
    const formattedHeight = typeof Units !== 'undefined' ? Units.format(values.height || 0) : `${(values.height || 0).toFixed(2)}'`;
    const formattedRadius = typeof Units !== 'undefined' ? Units.format(values.radius || 0) : `${(values.radius || 0).toFixed(2)}'`;
    const formattedAngle = `${Math.round(values.angle || 0)}°`;

    if (['line', 'wall', 'polyline'].includes(toolName)) {
      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Length:</label>
          <input type="text" id="dynLenInput" value="${formattedLen}" class="dyn-input-field" autocomplete="off">
        </div>
        <div class="dyn-input-group">
          <label>Angle:</label>
          <input type="text" id="dynAngleInput" value="${formattedAngle}" class="dyn-input-field" autocomplete="off">
        </div>
      `;
    } else if (['rectangle', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair'].includes(toolName)) {
      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Width:</label>
          <input type="text" id="dynWidthInput" value="${formattedWidth}" class="dyn-input-field" autocomplete="off">
        </div>
        <div class="dyn-input-group">
          <label>Height:</label>
          <input type="text" id="dynHeightInput" value="${formattedHeight}" class="dyn-input-field" autocomplete="off">
        </div>
      `;
    } else if (['circle', 'arc'].includes(toolName)) {
      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Radius:</label>
          <input type="text" id="dynRadiusInput" value="${formattedRadius}" class="dyn-input-field" autocomplete="off">
        </div>
      `;
    } else if (toolName === 'dimension') {
      this.dynamicInputContainer.innerHTML = `
        <div class="dyn-input-group">
          <label>Distance:</label>
          <input type="text" id="dynLenInput" value="${formattedLen}" class="dyn-input-field" autocomplete="off">
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
    });
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
        } else if (tool === 'polyline') {
          this.drawingPoints.push({ ...targetPt });
          this.startPt = { ...targetPt };
          this.currentPt = { ...targetPt };
          if (window.cadCommandLine) {
            window.cadCommandLine.setPrompt('Specify next point or [ENTER to finish]:');
            window.cadCommandLine.logMessage(`Segment = ${typeof Units !== 'undefined' ? Units.format(distFeet) : distFeet + "'"}`);
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
          }
        }
        this.cancelDrawing();
      }
    } else if (tool === 'circle') {
      const rInput = document.getElementById('dynRadiusInput');
      if (rInput) {
        const radiusFeet = typeof Units !== 'undefined' ? Units.toFeet(rInput.value) : (parseFloat(rInput.value) || 0);
        this.cad.addObject(new CADCircle(this.startPt.x, this.startPt.y, radiusFeet));
        if (window.cadCommandLine) {
          const rStr = typeof Units !== 'undefined' ? Units.format(radiusFeet) : `${radiusFeet}'`;
          window.cadCommandLine.logMessage(`CIRCLE created: Radius = ${rStr}`);
        }
        this.cancelDrawing();
      }
    } else if (tool === 'arc') {
      const rInput = document.getElementById('dynRadiusInput');
      if (rInput) {
        const radiusFeet = typeof Units !== 'undefined' ? Units.toFeet(rInput.value) : (parseFloat(rInput.value) || 0);
        this.cad.addObject(new CADArc(this.startPt.x, this.startPt.y, radiusFeet, 0, Math.PI));
        if (window.cadCommandLine) {
          const rStr = typeof Units !== 'undefined' ? Units.format(radiusFeet) : `${radiusFeet}'`;
          window.cadCommandLine.logMessage(`ARC created: Radius = ${rStr}`);
        }
        this.cancelDrawing();
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
    this.hideDynamicInput();
    this.cad.onDrawPreview = null;
    if (window.cadCommandLine) {
      window.cadCommandLine.setPrompt('Command:');
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
    this.cad.onDrawPreview = null;
    this.hideDynamicInput();

    const activeDisplay = typeof document !== 'undefined' ? document.getElementById('activeToolDisplay') : null;
    if (activeDisplay) activeDisplay.textContent = toolName.toUpperCase();

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
        // NO MOUSEUP DRAWING FINISH! Interactions are strictly click-based like AutoCAD.
      });
    }

    canvas.addEventListener('dblclick', () => {
      if (this.cad.activeTool === 'polyline' && this.drawingPoints.length > 1) {
        this.finishPolyline();
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
    const tool = this.cad.activeTool;

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
