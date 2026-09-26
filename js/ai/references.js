/**
 * RMA Front Elevation Designer - Reference Facade Image Manager
 * Handles multi-file uploads, image preview thumbnails, replace, and removal.
 */

class ReferenceImageManager {
  constructor(listContainerElement) {
    this.container = listContainerElement;
    this.images = []; // Array of { id, dataUrl, name }
    this.onImagesChanged = null;
  }

  addImagesFromFiles(fileList) {
    if (!fileList || !fileList.length) return;

    Array.from(fileList).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const item = {
          id: 'ref_' + Math.random().toString(36).substr(2, 9),
          dataUrl: e.target.result,
          name: file.name
        };
        this.images.push(item);
        this.renderList();
        if (this.onImagesChanged) this.onImagesChanged(this.images);
      };
      reader.readAsDataURL(file);
    });
  }

  removeImage(id) {
    this.images = this.images.filter(img => img.id !== id);
    this.renderList();
    if (this.onImagesChanged) this.onImagesChanged(this.images);
  }

  clearAll() {
    this.images = [];
    this.renderList();
    if (this.onImagesChanged) this.onImagesChanged(this.images);
  }

  renderList() {
    if (!this.container) return;

    if (this.images.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    this.container.innerHTML = this.images.map(img => `
      <div class="ref-image-card" id="card_${img.id}">
        <img src="${img.dataUrl}" alt="${img.name}" title="${img.name}">
        <button class="btn-remove-img" data-ref-id="${img.id}" title="Remove reference image">&times;</button>
      </div>
    `).join('');

    // Attach remove handlers
    this.container.querySelectorAll('.btn-remove-img').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const refId = btn.getAttribute('data-ref-id');
        this.removeImage(refId);
      });
    });
  }
}

window.ReferenceImageManager = ReferenceImageManager;
