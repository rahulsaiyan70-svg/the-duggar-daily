/**
 * RMA Front Elevation Designer - Building Framework Generator
 * Automatically constructs standard architectural elevation framework geometry based on parametric inputs:
 * Width, Plinth Height, Ground Floor Height, First Floor Height, Second Floor Height, Parapet Height.
 */

class FrameworkGenerator {
  static createFramework(cadCanvas, params) {
    // Parameters in feet
    const width = parseFloat(params.width) || 40;
    const plinth = parseFloat(params.plinth) || 2;
    const groundHeight = parseFloat(params.groundHeight) || 10;
    const firstHeight = parseFloat(params.firstHeight) || 10;
    const secondHeight = parseFloat(params.secondHeight) || 0;
    const parapetHeight = parseFloat(params.parapetHeight) || 4;

    cadCanvas.saveState();

    // Center building horizontally around world X = 0
    const startX = -width / 2;

    // 1. Plinth Line / Slab
    let currentY = 0;
    if (plinth > 0) {
      const plinthSlab = new CADSlab(startX - 1, currentY, width + 2, plinth, 1);
      plinthSlab.layer = 'framework';
      cadCanvas.addObject(plinthSlab);
      currentY += plinth;
    }

    // 2. Ground Floor Wall Boundaries
    if (groundHeight > 0) {
      const gfWall = new CADRect(startX, currentY, width, groundHeight, 'wall');
      gfWall.layer = 'framework';
      cadCanvas.addObject(gfWall);

      // First Floor Slab
      const gfSlab = new CADSlab(startX - 0.5, currentY + groundHeight - 0.8, width + 1, 0.8, 0.5);
      gfSlab.layer = 'framework';
      cadCanvas.addObject(gfSlab);

      currentY += groundHeight;
    }

    // 3. First Floor Wall Boundaries
    if (firstHeight > 0) {
      const ffWall = new CADRect(startX, currentY, width, firstHeight, 'wall');
      ffWall.layer = 'framework';
      cadCanvas.addObject(ffWall);

      // Second Floor Slab
      const ffSlab = new CADSlab(startX - 0.5, currentY + firstHeight - 0.8, width + 1, 0.8, 0.5);
      ffSlab.layer = 'framework';
      cadCanvas.addObject(ffSlab);

      currentY += firstHeight;
    }

    // 4. Second Floor Wall Boundaries
    if (secondHeight > 0) {
      const sfWall = new CADRect(startX, currentY, width, secondHeight, 'wall');
      sfWall.layer = 'framework';
      cadCanvas.addObject(sfWall);

      // Terrace Slab
      const sfSlab = new CADSlab(startX - 0.5, currentY + secondHeight - 0.8, width + 1, 0.8, 0.5);
      sfSlab.layer = 'framework';
      cadCanvas.addObject(sfSlab);

      currentY += secondHeight;
    }

    // 5. Parapet Wall
    if (parapetHeight > 0) {
      const parapet = new CADParapet(startX, currentY, width, parapetHeight);
      parapet.layer = 'framework';
      cadCanvas.addObject(parapet);
    }

    // 6. Automatically add Storey Level Dimensions
    const totalHeight = currentY + parapetHeight;
    const dimLeft = new CADDimension(startX - 3, 0, startX - 3, totalHeight, 1.5);
    dimLeft.layer = 'dimensions';
    cadCanvas.addObject(dimLeft);

    const dimWidth = new CADDimension(startX, -2, startX + width, -2, 1.5);
    dimWidth.layer = 'dimensions';
    cadCanvas.addObject(dimWidth);

    // Zoom to fit created building framework
    cadCanvas.panX = cadCanvas.canvas.width / 2;
    cadCanvas.panY = cadCanvas.canvas.height - 100;
    cadCanvas.zoom = Math.min(20, (cadCanvas.canvas.height - 180) / (totalHeight || 20));

    cadCanvas.render();
  }
}

window.FrameworkGenerator = FrameworkGenerator;
