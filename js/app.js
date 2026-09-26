/**
 * RMA AI Front Elevation Designer - Main Application Controller
 * Connects Canvas Engine, CAD Tools, Framework Generator, Floor Plan Importer,
 * 3D Visualizer, AI Prompt Engine & Renderers, Supabase, Project Manager, and Export Engine.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Core Canvas & Subsystems
  const canvasElement = document.getElementById('elevationCanvas');
  const cadCanvas = new CADCanvas(canvasElement);
  window.cadCanvas = cadCanvas;

  const toolManager = new CADToolManager(cadCanvas);
  window.toolManager = toolManager;

  const supabaseMgr = new SupabaseManager();
  window.supabaseMgr = supabaseMgr;

  const projectManager = new ProjectManager(cadCanvas, supabaseMgr);
  window.projectManager = projectManager;

  const floorPlanImporter = new FloorPlanImporter(cadCanvas);
  window.floorPlanImporter = floorPlanImporter;

  const threeContainer = document.getElementById('threeContainer');
  const visualizer3D = new Elevation3DVisualizer(threeContainer);
  window.visualizer3D = visualizer3D;

  const refImageManager = new ReferenceImageManager(document.getElementById('refImageList'));
  window.refImageManager = refImageManager;

  const aiRenderEngine = new AIRenderEngine(
    cadCanvas,
    document.getElementById('designGalleryGrid'),
    document.getElementById('renderStatusMessage')
  );
  window.activeAIRenderEngine = aiRenderEngine;

  const exportEngine = new ExportEngine(cadCanvas, projectManager);
  window.exportEngine = exportEngine;

  // 2. Initial Setup Default Framework
  FrameworkGenerator.createFramework(cadCanvas, {
    width: 40,
    plinth: 2,
    groundHeight: 10,
    firstHeight: 10,
    secondHeight: 0,
    parapetHeight: 4
  });

  // Synthesize initial prompt text
  const updatePromptText = () => {
    const promptInput = document.getElementById('aiPromptText');
    if (!promptInput) return;

    const style = document.getElementById('aiStyle').value;
    const lighting = document.getElementById('aiLighting').value;
    const landscape = document.getElementById('aiLandscape').value;
    const geoLock = document.getElementById('aiGeometryLock').value;

    const selectedMaterials = Array.from(document.querySelectorAll('input[name="aiMaterials"]:checked')).map(cb => cb.value);

    promptInput.value = AIPromptBuilder.synthesizePrompt(cadCanvas, {
      style,
      materials: selectedMaterials,
      lighting,
      landscape,
      geometryLock: geoLock,
      hasReferenceImages: refImageManager.images.length > 0
    });
  };

  updatePromptText();

  // 3. Attach UI Event Listeners

  // Left CAD Toolbar Tool Selection
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const toolName = btn.getAttribute('data-tool');
      toolManager.setTool(toolName);
    });
  });

  // View Mode Tabs (2D, 3D, Split)
  const tab2D = document.getElementById('tab2D');
  const tab3D = document.getElementById('tab3D');
  const tabSplit = document.getElementById('tabSplit');

  const setViewMode = (mode) => {
    [tab2D, tab3D, tabSplit].forEach(t => t.classList.remove('active'));

    if (mode === '2D') {
      tab2D.classList.add('active');
      threeContainer.classList.add('hidden');
      canvasElement.style.display = 'block';
    } else if (mode === '3D') {
      tab3D.classList.add('active');
      canvasElement.style.display = 'none';
      threeContainer.classList.remove('hidden');
      visualizer3D.init();
      visualizer3D.updateFrom2DCAD(cadCanvas.objects);
    } else if (mode === 'split') {
      tabSplit.classList.add('active');
      canvasElement.style.display = 'block';
      threeContainer.classList.remove('hidden');
      threeContainer.style.width = '50%';
      threeContainer.style.left = '50%';
      canvasElement.style.width = '50%';
      visualizer3D.init();
      visualizer3D.updateFrom2DCAD(cadCanvas.objects);
    }
  };

  tab2D.addEventListener('click', () => setViewMode('2D'));
  tab3D.addEventListener('click', () => setViewMode('3D'));
  tabSplit.addEventListener('click', () => setViewMode('split'));

  // Snapping & History Toggles
  document.getElementById('btnToggleGrid').addEventListener('click', function() {
    cadCanvas.showGrid = !cadCanvas.showGrid;
    this.classList.toggle('active', cadCanvas.showGrid);
    cadCanvas.render();
  });

  document.getElementById('btnToggleSnap').addEventListener('click', function() {
    cadCanvas.snapToGrid = !cadCanvas.snapToGrid;
    this.classList.toggle('active', cadCanvas.snapToGrid);
  });

  document.getElementById('btnToggleOSnap').addEventListener('click', function() {
    cadCanvas.snapToObject = !cadCanvas.snapToObject;
    this.classList.toggle('active', cadCanvas.snapToObject);
  });

  document.getElementById('btnToggleOrtho').addEventListener('click', function() {
    cadCanvas.orthoLock = !cadCanvas.orthoLock;
    this.classList.toggle('active', cadCanvas.orthoLock);
  });

  document.getElementById('btnUndo').addEventListener('click', () => cadCanvas.undo());
  document.getElementById('btnRedo').addEventListener('click', () => cadCanvas.redo());
  document.getElementById('btnDeleteSelected').addEventListener('click', () => cadCanvas.deleteSelected());
  document.getElementById('btnClearCanvas').addEventListener('click', () => {
    if (confirm('Clear all CAD elevation geometry?')) cadCanvas.clearAll();
  });

  // Unit Selector
  document.getElementById('unitSelect').addEventListener('change', (e) => {
    Units.setUnit(e.target.value);
    cadCanvas.render();
  });

  // Project Title Input
  document.getElementById('projectNameInput').addEventListener('input', (e) => {
    projectManager.setProjectTitle(e.target.value);
  });

  // New, Save, Export Header Buttons
  document.getElementById('btnNewProject').addEventListener('click', () => {
    if (confirm('Start new project? Unsaved changes will be cleared.')) {
      projectManager.newProject();
      updatePromptText();
    }
  });

  document.getElementById('btnSaveProject').addEventListener('click', async () => {
    await projectManager.saveProject();
    alert(`Project "${projectManager.currentProject.name}" saved successfully!`);
  });

  document.getElementById('btnOpenExport').addEventListener('click', () => {
    document.getElementById('exportModal').classList.remove('hidden');
  });

  // Settings & Auth Modals
  document.getElementById('btnOpenSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('hidden');
  });

  document.getElementById('btnOpenAuth').addEventListener('click', () => {
    document.getElementById('authModal').classList.remove('hidden');
  });

  // Modal Close Handlers
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add('hidden');
    });
  });

  // Framework Generator Button
  document.getElementById('btnCreateFramework').addEventListener('click', () => {
    FrameworkGenerator.createFramework(cadCanvas, {
      width: document.getElementById('fwWidth').value,
      plinth: document.getElementById('fwPlinth').value,
      groundHeight: document.getElementById('fwGround').value,
      firstHeight: document.getElementById('fwFirst').value,
      secondHeight: document.getElementById('fwSecond').value,
      parapetHeight: document.getElementById('fwParapet').value
    });
    updatePromptText();
  });

  // Floor Plan Input
  const fpInput = document.getElementById('floorPlanFileInput');
  if (fpInput) {
    fpInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        floorPlanImporter.loadPlanFromFile(e.target.files[0], () => {
          document.getElementById('floorPlanControls').classList.remove('hidden');
        });
      }
    });
  }

  document.getElementById('fpOpacity').addEventListener('input', (e) => {
    floorPlanImporter.setOpacity(e.target.value);
  });

  document.getElementById('btnCalibrateFP').addEventListener('click', () => {
    floorPlanImporter.startScaleCalibration();
  });

  document.getElementById('btnRemoveFP').addEventListener('click', () => {
    floorPlanImporter.removePlan();
    document.getElementById('floorPlanControls').classList.add('hidden');
  });

  // Reference Facade Image Inputs
  const refInput = document.getElementById('refImageFileInput');
  if (refInput) {
    refInput.addEventListener('change', (e) => {
      refImageManager.addImagesFromFiles(e.target.files);
      updatePromptText();
    });
  }

  // AI Prompt Auto-Synthesize & Render Buttons
  document.getElementById('btnAutoPrompt').addEventListener('click', updatePromptText);

  ['aiStyle', 'aiLighting', 'aiLandscape', 'aiGeometryLock'].forEach(id => {
    document.getElementById(id).addEventListener('change', updatePromptText);
  });

  document.querySelectorAll('input[name="aiMaterials"]').forEach(cb => {
    cb.addEventListener('change', updatePromptText);
  });

  document.getElementById('btnRenderAI').addEventListener('click', async () => {
    const promptText = document.getElementById('aiPromptText').value;
    const style = document.getElementById('aiStyle').value;
    const lighting = document.getElementById('aiLighting').value;
    const landscape = document.getElementById('aiLandscape').value;

    await aiRenderEngine.generateRenders(promptText, { style, lighting, landscape });
  });

  // 3D View Preset Buttons
  document.getElementById('btn3DFront').addEventListener('click', () => visualizer3D.setPresetView('front'));
  document.getElementById('btn3DSide').addEventListener('click', () => visualizer3D.setPresetView('side'));
  document.getElementById('btn3DPerspective').addEventListener('click', () => visualizer3D.setPresetView('perspective'));
  document.getElementById('btn3DReset').addEventListener('click', () => visualizer3D.setPresetView('reset'));

  // Export Modal Type Cards
  document.getElementById('btnExportPNG').addEventListener('click', () => exportEngine.exportPNG({ clientName: document.getElementById('exportClientName').value }));
  document.getElementById('btnExportJPG').addEventListener('click', () => exportEngine.exportJPG({ clientName: document.getElementById('exportClientName').value }));
  document.getElementById('btnExportPDF').addEventListener('click', () => exportEngine.exportPDF({ clientName: document.getElementById('exportClientName').value }));
  document.getElementById('btnExportDXF').addEventListener('click', () => exportEngine.exportDXF());

  // Supabase Auth Form Submit
  const authForm = document.getElementById('authForm');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('authEmail').value;
      const pass = document.getElementById('authPassword').value;
      try {
        await supabaseMgr.signIn(email, pass);
        document.getElementById('authModal').classList.add('hidden');
        alert('Signed in successfully!');
      } catch (err) {
        document.getElementById('authAlert').textContent = err.message;
        document.getElementById('authAlert').classList.remove('hidden');
      }
    });
  }
});
