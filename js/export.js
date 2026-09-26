/**
 * RMA Front Elevation Designer - Export Engine (PNG, JPG, PDF, DXF)
 * Implements high-resolution image rendering with professional RMA title block,
 * PDF vector/raster sheet export, and authentic AutoCAD DXF vector export.
 */

class ExportEngine {
  constructor(cadCanvas, projectManager) {
    this.cad = cadCanvas;
    this.pm = projectManager;
  }

  // Render high-res image with title block on offscreen canvas
  generateExportCanvas(options = {}) {
    const scale = options.scale || 2; // High-DPI multiplier
    const width = 1920 * scale;
    const height = 1080 * scale;

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Border Frame
    ctx.strokeStyle = '#1b4332';
    ctx.lineWidth = 4 * scale;
    ctx.strokeRect(20 * scale, 20 * scale, width - 40 * scale, height - 40 * scale);

    // Save CAD Viewport state
    const originalWidth = this.cad.canvas.width;
    const originalHeight = this.cad.canvas.height;
    const originalPanX = this.cad.panX;
    const originalPanY = this.cad.panY;
    const originalCtx = this.cad.ctx;

    // Temporary swap canvas context to render CAD objects at high-res
    this.cad.canvas.width = width - 80 * scale;
    this.cad.canvas.height = height - 160 * scale;
    this.cad.panX = (width - 80 * scale) / 2;
    this.cad.panY = height - 220 * scale;
    this.cad.ctx = ctx;

    // Render CAD elements
    this.cad.render();

    // Restore CAD Viewport state
    this.cad.canvas.width = originalWidth;
    this.cad.canvas.height = originalHeight;
    this.cad.panX = originalPanX;
    this.cad.panY = originalPanY;
    this.cad.ctx = originalCtx;

    // Draw Professional RMA Title Block
    const tbX = width - 420 * scale;
    const tbY = height - 140 * scale;
    const tbW = 390 * scale;
    const tbH = 110 * scale;

    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(tbX, tbY, tbW, tbH);
    ctx.strokeStyle = '#1b4332';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(tbX, tbY, tbW, tbH);

    ctx.fillStyle = '#1b4332';
    ctx.fillRect(tbX, tbY, 80 * scale, tbH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${16 * scale}px sans-serif`;
    ctx.fillText('RMA', tbX + 15 * scale, tbY + 60 * scale);

    ctx.fillStyle = '#212529';
    ctx.font = `bold ${12 * scale}px sans-serif`;
    ctx.fillText('RMA DESIGN & CONSTRUCTION', tbX + 90 * scale, tbY + 25 * scale);

    ctx.font = `${10 * scale}px sans-serif`;
    ctx.fillText('PROJECT: ' + this.pm.currentProject.name, tbX + 90 * scale, tbY + 45 * scale);
    ctx.fillText('CLIENT: ' + (options.clientName || 'Client Residence'), tbX + 90 * scale, tbY + 62 * scale);
    ctx.fillText('SCALE: ' + (options.scaleText || '1/4" = 1\'-0"'), tbX + 90 * scale, tbY + 79 * scale);
    ctx.fillText('DATE: ' + new Date().toLocaleDateString(), tbX + 90 * scale, tbY + 96 * scale);

    return offscreen;
  }

  exportPNG(options = {}) {
    const exportCanvas = this.generateExportCanvas(options);
    const link = document.createElement('a');
    link.download = `${this.pm.currentProject.name.replace(/\s+/g, '_')}_Elevation.png`;
    link.href = exportCanvas.toDataURL('image/png');
    if (link.click) link.click();
  }

  exportJPG(options = {}) {
    const exportCanvas = this.generateExportCanvas(options);
    const link = document.createElement('a');
    link.download = `${this.pm.currentProject.name.replace(/\s+/g, '_')}_Elevation.jpg`;
    link.href = exportCanvas.toDataURL('image/jpeg', 0.95);
    if (link.click) link.click();
  }

  exportPDF(options = {}) {
    const exportCanvas = this.generateExportCanvas(options);
    const imgData = exportCanvas.toDataURL('image/jpeg', 0.95);

    if (window.jspdf && window.jspdf.jsPDF) {
      const pdf = new window.jspdf.jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [1920, 1080]
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, 1920, 1080);
      pdf.save(`${this.pm.currentProject.name.replace(/\s+/g, '_')}_Sheet.pdf`);
    } else {
      alert('jsPDF library loaded fallback. Opening drawing in printable window...');
      const win = window.open('');
      win.document.write(`<img src="${imgData}" style="width:100%;">`);
      win.print();
    }
  }

  // Real AutoCAD DXF Vector Exporter
  exportDXF() {
    let dxf = '';
    // Header section
    dxf += '0\nSECTION\n2\nHEADER\n0\nENDSEC\n';
    dxf += '0\nSECTION\n2\nTABLES\n0\nENDSEC\n';
    dxf += '0\nSECTION\n2\nENTITIES\n';

    // Export CAD objects as authentic DXF entities
    this.cad.objects.forEach(obj => {
      const b = obj.getBounds();

      if (obj.type === 'line') {
        dxf += `0\nLINE\n8\n${obj.layer}\n10\n${obj.x1}\n20\n${obj.y1}\n11\n${obj.x2}\n20\n${obj.y2}\n`;
      } else if (['rectangle', 'wall', 'window', 'door', 'balcony', 'column', 'slab', 'parapet'].includes(obj.type)) {
        // Closed Polyline LWPOLYLINE for rectangular shapes
        dxf += `0\nLWPOLYLINE\n8\n${obj.type.toUpperCase()}\n90\n4\n70\n1\n`;
        dxf += `10\n${b.minX}\n20\n${b.minY}\n`;
        dxf += `10\n${b.maxX}\n20\n${b.minY}\n`;
        dxf += `10\n${b.maxX}\n20\n${b.maxY}\n`;
        dxf += `10\n${b.minX}\n20\n${b.maxY}\n`;
      } else if (obj.type === 'circle') {
        dxf += `0\nCIRCLE\n8\n${obj.layer}\n10\n${obj.cx}\n20\n${obj.cy}\n40\n${obj.radius}\n`;
      } else if (obj.type === 'text') {
        dxf += `0\nTEXT\n8\nTEXT\n10\n${obj.x}\n20\n${obj.y}\n40\n1.0\n1\n${obj.text}\n`;
      }
    });

    dxf += '0\nENDSEC\n0\nEOF\n';

    if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([dxf], { type: 'application/dxf' });
      const link = document.createElement('a');
      link.href = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(blob) : '#';
      link.download = `${this.pm.currentProject.name.replace(/\s+/g, '_')}.dxf`;
      if (link.click) link.click();
    }
    return dxf;
  }
}

window.ExportEngine = ExportEngine;
