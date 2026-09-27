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
      'EXTEND': 'EXTEND',
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
        <div id="cmdActiveBadge" class="cmd-active-badge hidden">ACTIVE COMMAND: <span id="cmdActiveName">NONE</span></div>
        <div id="cmdSuggestionBox" class="cmd-suggestion-box hidden"></div>
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
    this.suggestionBoxEl = document.getElementById('cmdSuggestionBox');
    this.activeBadgeEl = document.getElementById('cmdActiveBadge');
    this.activeNameEl = document.getElementById('cmdActiveName');
    this.selectedSuggestionIndex = -1;
    this.filteredSuggestions = [];
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

  updateSuggestions(query) {
    if (!this.suggestionBoxEl) return;
    const q = query.trim().toUpperCase();
    if (!q) {
      this.hideSuggestions();
      return;
    }

    const availableCommands = [
      { name: 'OFFSET', shortcut: 'O, OF' },
      { name: 'LINE', shortcut: 'L' },
      { name: 'POLYLINE', shortcut: 'PL' },
      { name: 'RECTANGLE', shortcut: 'REC, RECTANG' },
      { name: 'CIRCLE', shortcut: 'C' },
      { name: 'ARC', shortcut: 'A' },
      { name: 'MOVE', shortcut: 'M, MO' },
      { name: 'COPY', shortcut: 'CO' },
      { name: 'ROTATE', shortcut: 'RO' },
      { name: 'MIRROR', shortcut: 'MI' },
      { name: 'TRIM', shortcut: 'TR' },
      { name: 'EXTEND', shortcut: 'EX' },
      { name: 'FILLET', shortcut: 'F' },
      { name: 'STRETCH', shortcut: 'S' },
      { name: 'SCALE', shortcut: 'SC' },
      { name: 'ERASE', shortcut: 'E' },
      { name: 'EXPLODE', shortcut: 'X' },
      { name: 'DIMENSION', shortcut: 'D, DIM' },
      { name: 'TEXT', shortcut: 'T, MT' },
      { name: 'ZOOM', shortcut: 'Z' },
      { name: 'PAN', shortcut: 'P' },
      { name: 'UNDO', shortcut: 'U' },
      { name: 'REDO', shortcut: 'REDO' },
      { name: 'WALL', shortcut: 'WALL' },
      { name: 'WINDOW', shortcut: 'WIN' },
      { name: 'DOOR', shortcut: 'DOOR' },
      { name: 'BALCONY', shortcut: 'BAL' }
    ];

    this.filteredSuggestions = availableCommands.filter(cmd => {
      const shortcuts = cmd.shortcut.split(',').map(s => s.trim());
      return cmd.name.startsWith(q) || shortcuts.some(s => s.startsWith(q));
    });

    if (this.filteredSuggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.selectedSuggestionIndex = 0;
    this.renderSuggestions();
  }

  renderSuggestions() {
    if (!this.suggestionBoxEl) return;

    this.suggestionBoxEl.innerHTML = this.filteredSuggestions.map((item, idx) => `
      <div class="cmd-suggestion-item ${idx === this.selectedSuggestionIndex ? 'selected' : ''}" data-cmd="${item.name}">
        <span class="cmd-sug-name">${item.name}</span>
        <span class="cmd-sug-shortcut">${item.shortcut}</span>
      </div>
    `).join('');

    this.suggestionBoxEl.classList.remove('hidden');

    Array.from(this.suggestionBoxEl.querySelectorAll('.cmd-suggestion-item')).forEach((el, idx) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const cmdName = el.getAttribute('data-cmd');
        if (cmdName) {
          if (this.inputEl) this.inputEl.value = '';
          this.hideSuggestions();
          this.processInput(cmdName);
        }
      });
    });
  }

  hideSuggestions() {
    if (this.suggestionBoxEl) {
      this.suggestionBoxEl.classList.add('hidden');
      this.suggestionBoxEl.innerHTML = '';
    }
    this.filteredSuggestions = [];
    this.selectedSuggestionIndex = -1;
  }

  setActiveBadge(cmdName) {
    if (!this.activeBadgeEl || !this.activeNameEl) return;
    if (cmdName) {
      this.activeNameEl.textContent = cmdName.toUpperCase();
      this.activeBadgeEl.classList.remove('hidden');
    } else {
      this.activeBadgeEl.classList.add('hidden');
    }
  }

  initEvents() {
    if (!this.inputEl) return;

    this.inputEl.addEventListener('input', (e) => {
      this.updateSuggestions(this.inputEl.value);
    });

    this.inputEl.addEventListener('keydown', (e) => {
      const isSuggestionsVisible = this.filteredSuggestions.length > 0;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isSuggestionsVisible) {
          this.selectedSuggestionIndex = (this.selectedSuggestionIndex - 1 + this.filteredSuggestions.length) % this.filteredSuggestions.length;
          this.renderSuggestions();
        } else if (this.historyIndex > 0) {
          this.historyIndex--;
          this.inputEl.value = this.commandHistory[this.historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (isSuggestionsVisible) {
          this.selectedSuggestionIndex = (this.selectedSuggestionIndex + 1) % this.filteredSuggestions.length;
          this.renderSuggestions();
        } else if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputEl.value = this.commandHistory[this.historyIndex];
        } else {
          this.historyIndex = this.commandHistory.length;
          this.inputEl.value = '';
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        let cmdToRun = '';
        if (isSuggestionsVisible && this.selectedSuggestionIndex >= 0) {
          cmdToRun = this.filteredSuggestions[this.selectedSuggestionIndex].name;
        } else {
          cmdToRun = this.inputEl.value.trim();
        }

        this.inputEl.value = '';
        this.hideSuggestions();

        if (cmdToRun) {
          this.commandHistory.push(cmdToRun);
          this.historyIndex = this.commandHistory.length;
          this.processInput(cmdToRun);
        } else if (this.activeCommandState) {
          this.cancelCommand();
        }
      } else if (e.key === 'Tab') {
        if (isSuggestionsVisible && this.selectedSuggestionIndex >= 0) {
          e.preventDefault();
          this.inputEl.value = this.filteredSuggestions[this.selectedSuggestionIndex].name;
          this.hideSuggestions();
        }
      } else if (e.key === 'Escape') {
        this.hideSuggestions();
        this.cancelCommand();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        // Global Ctrl+Z / Ctrl+Y undo/redo shortcut handling
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          const isTextInput = e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);

          if (e.key.toLowerCase() === 'z') {
            if (isTextInput && !e.target.classList.contains('cmd-input-field')) {
              // Allow browser native text undo when focused inside user text inputs
              return;
            }
            e.preventDefault();
            if (e.shiftKey) {
              if (this.cad) this.cad.redo();
              this.logMessage('Redo executed.');
            } else {
              if (this.cad) this.cad.undo();
              this.logMessage('Undo executed.');
            }
            return;
          } else if (e.key.toLowerCase() === 'y') {
            if (isTextInput && !e.target.classList.contains('cmd-input-field')) {
              return;
            }
            e.preventDefault();
            if (this.cad) this.cad.redo();
            this.logMessage('Redo executed.');
            return;
          }
        }

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
        this.tools.setTool('offset');
        break;

      case 'EXTEND':
        this.tools.setTool('extend');
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

    if (cmd === 'EXTEND') {
      if (this.tools.extendState === 'SELECT_BOUNDARIES') {
        this.tools.extendState = 'SELECT_LINE_TO_EXTEND';
        this.setPrompt('EXTEND — Select object to extend:');
        this.logMessage('All objects selected as boundaries.');
      } else {
        this.cancelCommand();
      }
      this.activeCommandState = null;
      return;
    }

    if (cmd === 'OFFSET') {
      let dist = 0;
      if (!inputStr.trim()) {
        dist = this.tools.lastOffsetDistance || 0.75;
      } else {
        dist = typeof Units !== 'undefined' ? Units.toFeet(inputStr) : parseFloat(inputStr);
      }
      if (dist > 0) {
        this.tools.lastOffsetDistance = dist;
        this.tools.setOffsetState('SELECT_OBJECT');
        const formattedDist = typeof Units !== 'undefined' ? Units.format(dist) : `${dist}'`;
        this.logMessage(`Offset distance set to ${formattedDist}`);
      } else {
        this.logMessage('Invalid distance entered.');
        this.cancelCommand();
      }
      this.activeCommandState = null;
      return;
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
