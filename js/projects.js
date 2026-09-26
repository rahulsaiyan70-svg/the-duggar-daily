/**
 * RMA Front Elevation Designer - Project Management Engine
 * Stores project metadata, building framework parameters, CAD vector objects,
 * reference image list, AI prompt configurations, and generated render option history.
 * Fallback to browser localStorage when Supabase is offline or unconfigured.
 */

class ProjectManager {
  constructor(cadCanvas, supabaseMgr) {
    this.cad = cadCanvas;
    this.sb = supabaseMgr;
    this.currentProject = {
      id: 'proj_' + Math.random().toString(36).substr(2, 9),
      name: 'Untitled Project',
      clientName: 'Client Residence',
      units: 'ft-in',
      framework: { width: 40, plinth: 2, groundHeight: 10, firstHeight: 10, secondHeight: 0, parapetHeight: 4 },
      cadObjects: [],
      refImages: [],
      aiPrompt: '',
      aiOptions: {},
      renderHistory: [],
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString()
    };
  }

  setProjectTitle(title) {
    this.currentProject.name = title || 'Untitled Project';
    this.currentProject.modifiedDate = new Date().toISOString();
    this.updateSaveBadge('Unsaved');
  }

  updateSaveBadge(statusText) {
    const badge = typeof document !== 'undefined' ? document.getElementById('projectSaveStatus') : null;
    if (badge) {
      badge.textContent = statusText;
      badge.style.backgroundColor = statusText === 'Saved' ? 'rgba(43, 147, 72, 0.4)' : 'rgba(255, 255, 255, 0.15)';
    }
  }

  async saveProject() {
    this.currentProject.cadObjects = this.cad.objects.map(o => JSON.parse(JSON.stringify(o)));
    this.currentProject.units = Units.currentUnit;
    this.currentProject.modifiedDate = new Date().toISOString();

    // 1. Local Storage Backup
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`rma_proj_${this.currentProject.id}`, JSON.stringify(this.currentProject));
    }

    // 2. Supabase Cloud Sync if authenticated
    if (this.sb && this.sb.client && this.sb.currentUser) {
      try {
        const { error } = await this.sb.client.from('projects').upsert({
          id: this.currentProject.id,
          user_id: this.sb.currentUser.id,
          name: this.currentProject.name,
          data: this.currentProject,
          updated_at: new Date()
        });
        if (error) console.warn('Supabase cloud save error:', error);
      } catch (e) {
        console.warn('Supabase save error:', e);
      }
    }

    this.updateSaveBadge('Saved');
    return this.currentProject;
  }

  exportProjectJSON() {
    this.currentProject.cadObjects = this.cad.objects.map(o => JSON.parse(JSON.stringify(o)));
    const jsonStr = JSON.stringify(this.currentProject, null, 2);
    if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.currentProject.name.replace(/\s+/g, '_')}_RMA_Project.json`;
      a.click();
    }
    return jsonStr;
  }

  importProjectJSON(jsonStr) {
    try {
      const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      this.currentProject = data;

      // Restore CAD objects
      if (Array.isArray(data.cadObjects)) {
        this.cad.objects = data.cadObjects.map(d => CADObject.fromJSON(d));
      }

      // Restore Units
      if (data.units && typeof Units !== 'undefined') {
        Units.setUnit(data.units);
        const unitSel = typeof document !== 'undefined' ? document.getElementById('unitSelect') : null;
        if (unitSel) unitSel.value = data.units;
      }

      // Restore Name
      const projInput = typeof document !== 'undefined' ? document.getElementById('projectNameInput') : null;
      if (projInput) projInput.value = data.name || 'Untitled Project';

      this.cad.render();
      this.updateSaveBadge('Loaded');
    } catch (err) {
      if (typeof window !== 'undefined' && window.alert) {
        alert('Error loading project file: ' + err.message);
      }
    }
  }

  newProject() {
    this.cad.clearAll();
    this.currentProject = {
      id: 'proj_' + Math.random().toString(36).substr(2, 9),
      name: 'Untitled Project',
      clientName: 'Client Residence',
      units: 'ft-in',
      framework: { width: 40, plinth: 2, groundHeight: 10, firstHeight: 10, secondHeight: 0, parapetHeight: 4 },
      cadObjects: [],
      refImages: [],
      aiPrompt: '',
      aiOptions: {},
      renderHistory: [],
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString()
    };

    const projInput = typeof document !== 'undefined' ? document.getElementById('projectNameInput') : null;
    if (projInput) projInput.value = 'Untitled Project';

    this.updateSaveBadge('New');
  }
}

window.ProjectManager = ProjectManager;
