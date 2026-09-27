/**
 * RMA Front Elevation Designer - AutoCAD Command Line & Command Interpreter
 * Implements AutoCAD command system, command prompt history, arrow key navigation,
 * and command shortcuts (L, PL, REC, C, A, M, CO, RO, MI, O, TR, EX, F, S, E, D, Z, P, U).
 */

class CADCommandLine {
  constructor(cadCanvas, toolManager) {
    this.cad = cadCanvas;
    this.tools = toolManager;
    this.commandHistory = [];
    this.historyIndex = -1;
    this.activeCommandState = null; // { command, step, data }

    // DOM Elements
    this.containerEl = null;
    this.historyLogEl = null;
    this.inputEl = null;

    this.shortcuts = {
      'L': 'LINE',
      'PL': 'POLYLINE',
      'PLINE': 'POLYLINE',
      'REC': 'RECTANGLE',
      'RECTANG': 'RECTANGLE',
      'RECT': 'RECTANGLE',
      'C': 'CIRCLE',
      'A': 'ARC',
      'M': 'MOVE',
      'CO': 'COPY',
      'COPY': 'COPY',
      'RO': 'ROTATE',
      'MI': 'MIRROR',
      'O': 'OFFSET',
      'TR': 'TRIM',
      'EX': 'EXTEND',
      'F': 'FILLET',
      'S': 'STRETCH',
      'SC': 'SCALE',
      'E': 'ERASE',
      'X': 'EXPLODE',
      'D': 'DIMENSION',
      'DIM': 'DIMENSION',
      'T': 'TEXT',
      'MT': 'TEXT',
      'MTEXT': 'TEXT',
      'DI': 'DIST',
      'DIST': 'DIST',
      'AA': 'AREA',
      'AREA': 'AREA',
      'Z': 'ZOOM',
      'P': 'PAN',
      'U': 'UNDO',
      'REDO': 'REDO',
      'UNITS': 'UNITS'
    };

    this.createCommandLineDOM();
    this.initEvents();
  }

  createCommandLineDOM() {
    if (typeof document === 'undefined') return;

    let container = document.getElementById('cadCommandLine');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cadCommandLine';
      container.className = 'cad-command-line';
      container.innerHTML = `
        <div id="cmdHistoryLog" class="cmd-history-log">
          <div class="cmd-log-line">RMA Architectural CAD Engine V2.0 initialized. Type command or shortcut.</div>
        </div>
        <div class="cmd-input-row">
          <span class="cmd-prompt-label" id="cmdPromptLabel">Command:</span>
          <input type="text" id="cmdInputField" class="cmd-input-field" placeholder="Type LINE, RECT, MOVE, OFFSET, DIM or shortcut (L, REC, O)..." autocomplete="off" spellcheck="false">
        </div>
      `;

      const viewport = document.getElementById('canvasViewport') || document.body;
      viewport.appendChild(container);
    }

    this.containerEl = container;
    this.historyLogEl = document.getElementById('cmdHistoryLog');
    this.inputEl = document.getElementById('cmdInputField');
  }

  logMessage(msg) {
    if (typeof document === 'undefined' || !this.historyLogEl) return;
    const line = document.createElement('div');
    line.className = 'cmd-log-line';
    line.textContent = msg;
    this.historyLogEl.appendChild(line);
    this.historyLogEl.scrollTop = this.historyLogEl.scrollHeight;
  }

  setPrompt(promptText) {
    if (typeof document === 'undefined') return;
    const label = document.getElementById('cmdPromptLabel');
    if (label) label.textContent = promptText;
  }

  initEvents() {
    if (!this.inputEl) return;

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = this.inputEl.value.trim();
        this.inputEl.value = '';
        if (val) {
          this.commandHistory.push(val);
          this.historyIndex = this.commandHistory.length;
          this.processInput(val);
        } else if (this.activeCommandState) {
          this.cancelCommand();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.inputEl.value = this.commandHistory[this.historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputEl.value = this.commandHistory[this.historyIndex];
        } else {
          this.historyIndex = this.commandHistory.length;
          this.inputEl.value = '';
        }
      } else if (e.key === 'Escape') {
        this.cancelCommand();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

        // Route printable keyboard characters
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (this.tools && this.tools.isDrawing) {
            const dynInput = document.querySelector('.dyn-input-field');
            if (dynInput) {
              dynInput.focus();
            }
          } else if (this.inputEl) {
            this.inputEl.focus();
          }
        }
      });
    }
  }

  processInput(rawStr) {
    const str = rawStr.trim().toUpperCase();
    this.logMessage(`Command: ${rawStr}`);

    const resolvedCmd = this.shortcuts[str] || str;

    // Check if input matches a known command directly
    if (this.shortcuts[str] || Object.values(this.shortcuts).includes(str)) {
      this.activeCommandState = null; // Reset previous state to switch tool
    }

    if (this.activeCommandState) {
      this.handleCommandStep(rawStr);
      return;
    }

    switch (resolvedCmd) {
      case 'LINE':
        this.startCommand('LINE', 'Specify first point:');
        this.tools.setTool('line');
        break;

      case 'POLYLINE':
        this.startCommand('POLYLINE', 'Specify start point:');
        this.tools.setTool('polyline');
        break;

      case 'RECTANGLE':
        this.startCommand('RECTANGLE', 'Specify first corner point:');
        this.tools.setTool('rectangle');
        break;

      case 'CIRCLE':
        this.startCommand('CIRCLE', 'Specify center point:');
        this.tools.setTool('circle');
        break;

      case 'ARC':
        this.startCommand('ARC', 'Specify start point of arc:');
        this.tools.setTool('arc');
        break;

      case 'WALL':
        this.startCommand('WALL', 'Specify wall start point:');
        this.tools.setTool('wall');
        break;

      case 'WINDOW':
        this.startCommand('WINDOW', 'Specify window insertion point:');
        this.tools.setTool('window');
        break;

      case 'DOOR':
        this.startCommand('DOOR', 'Specify door insertion point:');
        this.tools.setTool('door');
        break;

      case 'BALCONY':
        this.startCommand('BALCONY', 'Specify balcony insertion point:');
        this.tools.setTool('balcony');
        break;

      case 'DIMENSION':
        this.startCommand('DIMENSION', 'Specify first extension line origin:');
        this.tools.setTool('dimension');
        break;

      case 'TEXT':
        this.startCommand('TEXT', 'Specify text insertion point:');
        this.tools.setTool('text');
        break;

      case 'MOVE':
        if (this.cad.selectedObjects.length === 0) {
          this.startCommand('MOVE', 'Select object to move:');
          this.activeCommandState.step = 1;
        } else {
          this.startCommand('MOVE', 'Specify base point:');
          this.activeCommandState.step = 2;
          this.activeCommandState.data.selected = [...this.cad.selectedObjects];
        }
        break;

      case 'COPY':
        if (this.cad.selectedObjects.length === 0) {
          this.startCommand('COPY', 'Select object to copy:');
          this.activeCommandState.step = 1;
        } else {
          this.startCommand('COPY', 'Specify base point:');
          this.activeCommandState.step = 2;
          this.activeCommandState.data.selected = [...this.cad.selectedObjects];
        }
        break;

      case 'ROTATE':
        if (this.cad.selectedObjects.length === 0) {
          this.startCommand('ROTATE', 'Select object to rotate:');
          this.activeCommandState.step = 1;
        } else {
          this.startCommand('ROTATE', 'Specify base point:');
          this.activeCommandState.step = 2;
          this.activeCommandState.data.selected = [...this.cad.selectedObjects];
        }
        break;

      case 'MIRROR':
        if (this.cad.selectedObjects.length === 0) {
          this.startCommand('MIRROR', 'Select object to mirror:');
          this.activeCommandState.step = 1;
        } else {
          this.startCommand('MIRROR', 'Specify first point of mirror line:');
          this.activeCommandState.step = 2;
          this.activeCommandState.data.selected = [...this.cad.selectedObjects];
        }
        break;

      case 'OFFSET':
        this.startCommand('OFFSET', 'Specify offset distance (e.g. 9" or 1.5):');
        this.activeCommandState.step = 1;
        break;

      case 'TRIM':
        this.startCommand('TRIM', 'Select cutting edge or [ENTER for all]:');
        this.activeCommandState.step = 1;
        break;

      case 'EXTEND':
        this.startCommand('EXTEND', 'Select boundary edge or [ENTER for all]:');
        this.activeCommandState.step = 1;
        break;

      case 'ERASE':
        this.cad.deleteSelected();
        this.logMessage('Selected objects erased.');
        break;

      case 'EXPLODE':
        if (this.cad.selectedObjects.length > 0) {
          this.cad.saveState();
          const newObjs = [];
          this.cad.selectedObjects.forEach(o => {
            if (o.explode) {
              newObjs.push(...o.explode());
              this.cad.removeObject(o);
            }
          });
          newObjs.forEach(no => this.cad.addObject(no));
          this.logMessage('Objects exploded into primitives.');
        }
        break;

      case 'ZOOM':
        this.logMessage('Zoom: Use mouse wheel or click zoom tool.');
        this.tools.setTool('zoom');
        break;

      case 'PAN':
        this.tools.setTool('pan');
        this.logMessage('Pan tool active. Drag canvas to pan.');
        break;

      case 'UNDO':
        this.cad.undo();
        this.logMessage('Undo executed.');
        break;

      case 'REDO':
        this.cad.redo();
        this.logMessage('Redo executed.');
        break;

      case 'DIST':
        if (this.cad.selectedObjects.length > 0) {
          const b = this.cad.selectedObjects[0].getBounds();
          const distStr = typeof Units !== 'undefined' ? Units.format(b.width) : `${b.width.toFixed(2)}'`;
          this.logMessage(`Distance / Width = ${distStr}`);
        } else {
          this.logMessage('Select an object to measure distance.');
        }
        break;

      case 'AREA':
        if (this.cad.selectedObjects.length > 0) {
          const area = this.cad.selectedObjects[0].getArea ? this.cad.selectedObjects[0].getArea() : 0;
          this.logMessage(`Area = ${area.toFixed(2)} sq ft`);
        } else {
          this.logMessage('Select a closed object to measure area.');
        }
        break;

      case 'UNITS':
        this.logMessage(`Current Unit Mode: ${typeof Units !== 'undefined' ? Units.currentUnit : 'ft-in'}`);
        break;

      default:
        this.logMessage(`Unknown command "${rawStr}". Type LINE, REC, M, O, D, etc.`);
        break;
    }
  }

  startCommand(name, initialPrompt) {
    this.activeCommandState = { command: name, step: 1, data: {} };
    this.setPrompt(initialPrompt);
  }

  handleCanvasClick(pt) {
    if (!this.activeCommandState) return false;

    const cmd = this.activeCommandState.command;
    const step = this.activeCommandState.step;
    const data = this.activeCommandState.data;

    if (cmd === 'OFFSET') {
      if (step === 2) {
        let hitObj = null;
        for (let i = this.cad.objects.length - 1; i >= 0; i--) {
          if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
            hitObj = this.cad.objects[i];
            break;
          }
        }
        if (hitObj) {
          data.targetObj = hitObj;
          this.activeCommandState.step = 3;
          this.setPrompt('Specify side to offset:');
          this.logMessage(`Object selected (${hitObj.type.toUpperCase()}). Click side to offset.`);
        } else {
          this.logMessage('No object selected. Click object on canvas:');
        }
        return true;
      } else if (step === 3) {
        if (data.targetObj && data.distance > 0) {
          this.cad.saveState();
          const offResult = data.targetObj.offset(data.distance, pt);
          if (offResult && offResult.length) {
            offResult.forEach(o => this.cad.addObject(o));
            const formattedDist = typeof Units !== 'undefined' ? Units.format(data.distance) : `${data.distance}'`;
            this.logMessage(`Exact ${formattedDist} offset created.`);
          }
          this.activeCommandState.step = 2;
          this.setPrompt('Select object to offset:');
        }
        return true;
      }
    } else if (cmd === 'COPY') {
      if (step === 1) {
        let hitObj = null;
        for (let i = this.cad.objects.length - 1; i >= 0; i--) {
          if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
            hitObj = this.cad.objects[i];
            break;
          }
        }
        if (hitObj) {
          hitObj.selected = true;
          this.cad.selectedObjects = [hitObj];
          data.selected = [hitObj];
          this.activeCommandState.step = 2;
          this.setPrompt('Specify base point:');
          this.logMessage(`1 object selected. Specify base point:`);
        }
        return true;
      } else if (step === 2) {
        data.basePt = { ...pt };
        this.activeCommandState.step = 3;
        this.setPrompt('Specify second point or [Displacement]:');
        const formattedPt = typeof Units !== 'undefined' ? `(${Units.format(pt.x)}, ${Units.format(pt.y)})` : `(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`;
        this.logMessage(`Base point fixed at ${formattedPt}. Click destination:`);
        return true;
      } else if (step === 3) {
        const dx = pt.x - data.basePt.x;
        const dy = pt.y - data.basePt.y;
        this.cad.saveState();
        const sel = data.selected || this.cad.selectedObjects;
        sel.forEach(o => {
          const c = o.copy(dx, dy);
          this.cad.addObject(c);
        });
        this.logMessage(`Copy created.`);
        this.cancelCommand();
        return true;
      }
    } else if (cmd === 'MOVE') {
      if (step === 1) {
        let hitObj = null;
        for (let i = this.cad.objects.length - 1; i >= 0; i--) {
          if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
            hitObj = this.cad.objects[i];
            break;
          }
        }
        if (hitObj) {
          hitObj.selected = true;
          this.cad.selectedObjects = [hitObj];
          data.selected = [hitObj];
          this.activeCommandState.step = 2;
          this.setPrompt('Specify base point:');
          this.logMessage(`1 object selected. Specify base point:`);
        }
        return true;
      } else if (step === 2) {
        data.basePt = { ...pt };
        this.activeCommandState.step = 3;
        this.setPrompt('Specify second point or [Displacement]:');
        const formattedPt = typeof Units !== 'undefined' ? `(${Units.format(pt.x)}, ${Units.format(pt.y)})` : `(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`;
        this.logMessage(`Base point fixed at ${formattedPt}. Click destination:`);
        return true;
      } else if (step === 3) {
        const dx = pt.x - data.basePt.x;
        const dy = pt.y - data.basePt.y;
        this.cad.saveState();
        const sel = data.selected || this.cad.selectedObjects;
        sel.forEach(o => o.move(dx, dy));
        this.cad.render();
        this.logMessage(`Move completed.`);
        this.cancelCommand();
        return true;
      }
    } else if (cmd === 'MIRROR') {
      if (step === 1) {
        let hitObj = null;
        for (let i = this.cad.objects.length - 1; i >= 0; i--) {
          if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
            hitObj = this.cad.objects[i];
            break;
          }
        }
        if (hitObj) {
          hitObj.selected = true;
          this.cad.selectedObjects = [hitObj];
          data.selected = [hitObj];
          this.activeCommandState.step = 2;
          this.setPrompt('Specify first point of mirror line:');
        }
        return true;
      } else if (step === 2) {
        data.p1 = { ...pt };
        this.activeCommandState.step = 3;
        this.setPrompt('Specify second point of mirror line:');
        return true;
      } else if (step === 3) {
        data.p2 = { ...pt };
        this.activeCommandState.step = 4;
        this.setPrompt('Erase source objects? [Yes/No] <N>:');
        this.logMessage('Type Y or N in command line, or press ENTER for No.');
        return true;
      }
    } else if (cmd === 'ROTATE') {
      if (step === 1) {
        let hitObj = null;
        for (let i = this.cad.objects.length - 1; i >= 0; i--) {
          if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
            hitObj = this.cad.objects[i];
            break;
          }
        }
        if (hitObj) {
          hitObj.selected = true;
          this.cad.selectedObjects = [hitObj];
          data.selected = [hitObj];
          this.activeCommandState.step = 2;
          this.setPrompt('Specify base point:');
        }
        return true;
      } else if (step === 2) {
        data.basePt = { ...pt };
        this.activeCommandState.step = 3;
        this.setPrompt('Specify rotation angle (e.g., 90):');
        return true;
      }
    } else if (cmd === 'TRIM' || cmd === 'EXTEND') {
      let hitObj = null;
      for (let i = this.cad.objects.length - 1; i >= 0; i--) {
        if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
          hitObj = this.cad.objects[i];
          break;
        }
      }
      if (hitObj) {
        this.cad.saveState();
        if (cmd === 'ERASE') {
          this.cad.removeObject(hitObj);
        } else if (cmd === 'TRIM' && hitObj.type === 'line') {
          this.cad.removeObject(hitObj);
          this.logMessage(`Line trimmed.`);
        } else if (cmd === 'EXTEND' && hitObj.type === 'line') {
          hitObj.x2 += 5;
          this.cad.render();
          this.logMessage(`Line extended.`);
        }
      }
      return true;
    } else if (cmd === 'ERASE') {
      let hitObj = null;
      for (let i = this.cad.objects.length - 1; i >= 0; i--) {
        if (this.cad.objects[i].hitTest(pt.x, pt.y)) {
          hitObj = this.cad.objects[i];
          break;
        }
      }
      if (hitObj) {
        this.cad.saveState();
        this.cad.removeObject(hitObj);
        this.logMessage(`Object erased.`);
      }
      return true;
    }

    return false;
  }

  handleCommandStep(inputStr) {
    if (!this.activeCommandState) return;
    const cmd = this.activeCommandState.command;
    const step = this.activeCommandState.step;
    const data = this.activeCommandState.data;

    if (cmd === 'OFFSET') {
      if (step === 1) {
        const dist = typeof Units !== 'undefined' ? Units.toFeet(inputStr) : parseFloat(inputStr);
        if (dist > 0) {
          data.distance = dist;
          this.activeCommandState.step = 2;
          const formattedDist = typeof Units !== 'undefined' ? Units.format(dist) : `${dist}'`;
          this.setPrompt('Select object to offset:');
          this.logMessage(`Offset distance set to ${formattedDist}. Click object on canvas.`);
        } else {
          this.logMessage('Invalid distance. Specify offset distance:');
        }
      } else {
        this.cancelCommand();
      }
    } else if (cmd === 'MIRROR') {
      if (step === 4) {
        const eraseSource = inputStr.trim().toUpperCase().startsWith('Y');
        this.cad.saveState();
        const p1 = data.p1 || { x: 0, y: 0 };
        const p2 = data.p2 || { x: 0, y: 10 };
        const sel = data.selected || this.cad.selectedObjects;
        sel.forEach(o => {
          if (eraseSource) {
            o.mirror(p1, p2);
          } else {
            const m = o.clone();
            m.mirror(p1, p2);
            this.cad.addObject(m);
          }
        });
        this.cad.render();
        this.logMessage(`Mirror complete.`);
        this.cancelCommand();
      } else {
        this.cancelCommand();
      }
    } else if (cmd === 'ROTATE') {
      if (step === 3) {
        const deg = parseFloat(inputStr);
        if (!isNaN(deg)) {
          this.cad.saveState();
          const rad = (deg * Math.PI) / 180;
          const basePt = data.basePt || { x: 0, y: 0 };
          const sel = data.selected || this.cad.selectedObjects;
          sel.forEach(o => o.rotate(rad, basePt));
          this.cad.render();
          this.logMessage(`Rotated by ${deg}°.`);
        }
        this.cancelCommand();
      } else {
        this.cancelCommand();
      }
    } else if (cmd === 'COPY' || cmd === 'MOVE') {
      if (step === 3) {
        const basePt = data.basePt || { x: 0, y: 0 };
        const parsed = typeof Units !== 'undefined' ? Units.parseInput(inputStr, basePt) : null;
        let destPt = basePt;
        if (parsed && parsed.type === 'point') {
          destPt = { x: parsed.x, y: parsed.y };
        } else {
          const dist = typeof Units !== 'undefined' ? Units.toFeet(inputStr) : parseFloat(inputStr);
          destPt = { x: basePt.x + dist, y: basePt.y };
        }
        const dx = destPt.x - basePt.x;
        const dy = destPt.y - basePt.y;
        this.cad.saveState();
        const sel = data.selected || this.cad.selectedObjects;
        sel.forEach(o => {
          if (cmd === 'COPY') {
            this.cad.addObject(o.copy(dx, dy));
          } else {
            o.move(dx, dy);
          }
        });
        this.cad.render();
        this.logMessage(`${cmd} completed.`);
        this.cancelCommand();
      } else {
        this.cancelCommand();
      }
    } else {
      this.cancelCommand();
    }
  }

  cancelCommand() {
    this.activeCommandState = null;
    this.setPrompt('Command:');
    this.logMessage('*Cancel*');
  }
}

if (typeof window !== 'undefined') {
  window.CADCommandLine = CADCommandLine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CADCommandLine };
}
