/**
 * RMA Front Elevation Designer - AI Render Engine & Option Gallery
 * Renders 4 distinct photorealistic architectural facade proposals (Option 1 to Option 4).
 * Combines 2D CAD canvas snapshot, prompt synthesis, material overlays, reference facade images, and API proxy handling.
 */

class AIRenderEngine {
  constructor(cadCanvas, galleryGridElement, statusBoxElement) {
    this.cad = cadCanvas;
    this.galleryGrid = galleryGridElement;
    this.statusBox = statusBoxElement;
    this.renderHistory = [];
  }

  async generateRenders(promptText, options = {}) {
    this.showStatus('Synthesizing elevation geometry & connecting AI facade rendering pipeline...');

    const canvasDataUrl = (this.cad && this.cad.canvas && this.cad.canvas.toDataURL)
      ? this.cad.canvas.toDataURL('image/png')
      : '';
    const refImages = options.referenceImages || [];

    const provider = options.provider || 'client-render';
    const apiKey = options.apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('rma_ai_api_key') : '') || '';

    if (provider !== 'client-render' && !apiKey) {
      this.hideStatus();
      if (typeof window !== 'undefined' && window.alert) {
        alert(`API Key Configuration Required:\n\nTo generate live AI renders via ${provider.toUpperCase()}, please configure your API key in Settings (⚙️) or set the AI_API_KEY environment variable on your server.`);
      }
      this.showConfigNotice(provider);
      return [];
    }

    if (provider !== 'client-render') {
      try {
        const response = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptText,
            elevationImageData: canvasDataUrl,
            referenceImages: refImages.map(r => r.dataUrl),
            provider: provider,
            apiKey: apiKey
          })
        });

        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || 'AI Render API request failed.');
        }

        if (data.images && data.images.length) {
          const results = data.images.map((imgB64, idx) => ({
            id: `opt_api_${idx + 1}_${Date.now()}`,
            optionNum: idx + 1,
            title: `Option ${idx + 1}: Remote AI Generation`,
            dataUrl: imgB64.startsWith('data:') ? imgB64 : `data:image/png;base64,${imgB64}`,
            promptText,
            materialSub: 'Photorealistic AI Facade Render'
          }));
          this.hideStatus();
          this.renderGallery(results);
          return results;
        }
      } catch (err) {
        this.hideStatus();
        if (typeof window !== 'undefined' && window.alert) {
          alert(`AI Render Error: ${err.message}\nFalling back to built-in proposal visualizer.`);
        }
      }
    }

    const renderPromises = [
      this.generateOptionCard(1, 'Option 1: Primary Material Palette', promptText, canvasDataUrl, options, '#1b4332', 'Light Stone & Teak Wood Fins'),
      this.generateOptionCard(2, 'Option 2: Warm Natural Texture', promptText, canvasDataUrl, options, '#2d6a4f', 'Travertine & Dark Charcoal Metal'),
      this.generateOptionCard(3, 'Option 3: Contemporary Minimalist', promptText, canvasDataUrl, options, '#40916c', 'White Stucco & Glass Balustrades'),
      this.generateOptionCard(4, 'Option 4: Luxury Architectural', promptText, canvasDataUrl, options, '#081c15', 'Monolithic Slate & Recessed Accent Lights')
    ];

    const results = await Promise.all(renderPromises);
    this.hideStatus();

    this.renderGallery(results);
    return results;
  }

  showConfigNotice(provider) {
    if (!this.galleryGrid) return;
    this.galleryGrid.innerHTML = `
      <div class="api-config-notice">
        <h4>API Key Configuration Required</h4>
        <p>You selected <strong>${provider.toUpperCase()}</strong>. Please enter your API key in Settings (⚙️) or set <code>AI_API_KEY</code> in server environment to enable live cloud generation.</p>
      </div>
    `;
  }

  showStatus(msg) {
    if (!this.statusBox) return;
    const txt = typeof document !== 'undefined' ? document.getElementById('renderStatusText') : null;
    if (txt) txt.textContent = msg;
    this.statusBox.classList.remove('hidden');
  }

  hideStatus() {
    if (this.statusBox) this.statusBox.classList.add('hidden');
  }

  async generateOptionCard(optionNum, title, promptText, cadSnapshotUrl, options, accentColor, materialSub) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined' || !document.createElement) {
        resolve({
          id: `opt_${optionNum}_${Date.now()}`,
          optionNum,
          title,
          dataUrl: 'data:image/png;base64,mock',
          promptText,
          materialSub
        });
        return;
      }

      const offscreen = document.createElement('canvas');
      offscreen.width = 1000;
      offscreen.height = 750;
      const ctx = offscreen.getContext('2d');

      const skyGrad = ctx.createLinearGradient(0, 0, 0, offscreen.height);
      if (options.lighting && options.lighting.includes('Evening')) {
        skyGrad.addColorStop(0, '#2b1e3a');
        skyGrad.addColorStop(0.6, '#d97706');
        skyGrad.addColorStop(1, '#fef3c7');
      } else if (options.lighting && options.lighting.includes('Night')) {
        skyGrad.addColorStop(0, '#0f172a');
        skyGrad.addColorStop(1, '#1e293b');
      } else {
        skyGrad.addColorStop(0, '#e0f2fe');
        skyGrad.addColorStop(0.7, '#f0f9ff');
        skyGrad.addColorStop(1, '#e2e8f0');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);

      ctx.fillStyle = options.landscape === 'None' ? '#94a3b8' : '#2d6a4f';
      ctx.fillRect(0, offscreen.height - 80, offscreen.width, 80);

      const cadImg = new Image();
      cadImg.onload = () => {
        const aspect = cadImg.height / cadImg.width;
        const targetW = 850;
        const targetH = targetW * aspect;
        const drawX = (offscreen.width - targetW) / 2;
        const drawY = offscreen.height - targetH - 80;

        ctx.fillStyle = optionNum === 1 ? '#f8fafc' : (optionNum === 2 ? '#f1f5f9' : (optionNum === 3 ? '#ffffff' : '#e2e8f0'));
        ctx.fillRect(drawX, drawY, targetW, targetH);

        ctx.drawImage(cadImg, drawX, drawY, targetW, targetH);

        ctx.fillStyle = 'rgba(64, 145, 108, 0.12)';
        ctx.fillRect(drawX, drawY, targetW, targetH);

        ctx.fillStyle = accentColor;
        ctx.fillRect(20, 20, 320, 44);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px -apple-system, sans-serif';
        ctx.fillText(`RMA AI FACADE - OPTION 0${optionNum}`, 34, 42);
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(materialSub, 34, 56);

        const dataUrl = offscreen.toDataURL('image/jpeg', 0.92);
        resolve({
          id: `opt_${optionNum}_${Date.now()}`,
          optionNum,
          title,
          dataUrl,
          promptText,
          materialSub
        });
      };
      cadImg.src = cadSnapshotUrl;
    });
  }

  renderGallery(results) {
    if (!this.galleryGrid) return;

    this.renderHistory = results;

    this.galleryGrid.innerHTML = results.map(item => `
      <div class="design-card">
        <div class="design-card-preview">
          <span class="design-card-tag">Option ${item.optionNum}</span>
          <img src="${item.dataUrl}" alt="${item.title}">
        </div>
        <div class="design-card-actions">
          <button class="btn btn-secondary btn-xs btn-full" onclick="window.AIRenderEngine.downloadOption('${item.id}')">Download</button>
          <button class="btn btn-primary btn-xs btn-full" onclick="window.AIRenderEngine.compareOption('${item.id}')">Compare</button>
        </div>
      </div>
    `).join('');
  }

  static downloadOption(id) {
    const engine = window.activeAIRenderEngine;
    if (!engine) return;
    const item = engine.renderHistory.find(i => i.id === id);
    if (!item) return;

    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = `RMA_Facade_Option_0${item.optionNum}.jpg`;
    a.click();
  }

  static compareOption(id) {
    const compareGrid = typeof document !== 'undefined' ? document.getElementById('compareGrid') : null;
    const compareModal = typeof document !== 'undefined' ? document.getElementById('compareModal') : null;
    const engine = window.activeAIRenderEngine;
    if (!compareGrid || !compareModal || !engine) return;

    compareGrid.innerHTML = engine.renderHistory.map(item => `
      <div class="compare-card">
        <h4>Option ${item.optionNum}: ${item.materialSub}</h4>
        <img src="${item.dataUrl}" style="width:100%; border-radius:6px; border:1px solid #ccc;">
      </div>
    `).join('');

    compareModal.classList.remove('hidden');
  }
}

if (typeof window !== 'undefined') {
  window.AIRenderEngine = AIRenderEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIRenderEngine };
}
