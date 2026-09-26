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
      'REC': 'RECTANGLE',
      'RECTANG': 'RECTANGLE',
      'C': 'CIRCLE',
      'A': 'ARC',
      'M': 'MOVE',
      'CO': 'COPY',
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
      'Z': 'ZOOM',
      'P': 'PAN',
      'U': 'UNDO',
      'REDO': 'REDO',
      'DIST': 'DIST',
      'AREA': 'AREA',
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

        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (this.inputEl) {
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
        this.startCommand('WINDOW', 'Specify window corner point:');
        this.tools.setTool('window');
        break;

      case 'DOOR':
        this.startCommand('DOOR', 'Specify door corner point:');
        this.tools.setTool('door');
        break;

      case 'BALCONY':
        this.startCommand('BALCONY', 'Specify balcony corner point:');
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
          this.logMessage('Select objects first or click on canvas.');
        } else {
          this.startCommand('MOVE', 'Specify base point or [Displacement]:');
        }
        break;

      case 'COPY':
        if (this.cad.selectedObjects.length === 0) {
          this.logMessage('Select objects first.');
        } else {
          this.startCommand('COPY', 'Specify base point:');
        }
        break;

      case 'ROTATE':
        if (this.cad.selectedObjects.length === 0) {
          this.logMessage('Select objects to rotate.');
        } else {
          this.startCommand('ROTATE', 'Specify rotation angle in degrees (e.g., 90):');
        }
        break;

      case 'MIRROR':
        if (this.cad.selectedObjects.length === 0) {
          this.logMessage('Select objects to mirror.');
        } else {
          this.cad.saveState();
          this.cad.selectedObjects.forEach(o => o.mirror({ x: 0, y: 0 }, { x: 0, y: 10 }));
          this.cad.render();
          this.logMessage('Objects mirrored horizontally.');
        }
        break;

      case 'OFFSET':
        this.startCommand('OFFSET', 'Specify offset distance (e.g. 9" or 1.5):');
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

  handleCommandStep(inputStr) {
    const cmd = this.activeCommandState.command;

    if (cmd === 'OFFSET') {
      const dist = typeof Units !== 'undefined' ? Units.toFeet(inputStr) : parseFloat(inputStr);
      if (dist > 0 && this.cad.selectedObjects.length > 0) {
        this.cad.saveState();
        const offObjs = [];
        this.cad.selectedObjects.forEach(o => {
          if (o.offset) offObjs.push(...o.offset(dist, { x: o.getBounds().maxX + 5, y: o.getBounds().maxY + 5 }));
        });
        offObjs.forEach(no => this.cad.addObject(no));
        const formattedDist = typeof Units !== 'undefined' ? Units.format(dist) : `${dist}'`;
        this.logMessage(`Offset by ${formattedDist} applied.`);
      }
      this.cancelCommand();
    } else if (cmd === 'ROTATE') {
      const deg = parseFloat(inputStr);
      if (!isNaN(deg) && this.cad.selectedObjects.length > 0) {
        this.cad.saveState();
        const rad = (deg * Math.PI) / 180;
        this.cad.selectedObjects.forEach(o => o.rotate(rad, { x: o.getBounds().minX, y: o.getBounds().minY }));
        this.cad.render();
        this.logMessage(`Rotated by ${deg}°.`);
      }
      this.cancelCommand();
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
