/**
 * RMA CAD Geometry Engine & Data Model
 * Defines structured CAD elements storing spatial coordinates and architectural properties in FEET.
 */

class CADObject {
  constructor(type, properties = {}) {
    this.id = properties.id || 'obj_' + Math.random().toString(36).substr(2, 9);
    this.type = type; // 'line', 'polyline', 'rectangle', 'arc', 'circle', 'wall', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair', 'dimension', 'text'
    this.layer = properties.layer || 'default';
    this.selected = false;
    this.color = properties.color || null;
    this.lineWidth = properties.lineWidth || 1.5;
  }

  // Get bounding box in world feet {minX, minY, maxX, maxY, width, height}
  getBounds() {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  // Move object by delta feet
  move(dx, dy) {}

  // Clone object
  clone() {
    const json = JSON.parse(JSON.stringify(this));
    json.id = 'obj_' + Math.random().toString(36).substr(2, 9);
    return CADObject.fromJSON(json);
  }

  // Draw object on HTML5 2D Canvas context
  draw(ctx, viewport) {}

  // Check if point (world x, y in feet) hits this object
  hitTest(x, y, tolerance = 0.5) {
    const b = this.getBounds();
    return x >= (b.minX - tolerance) && x <= (b.maxX + tolerance) &&
           y >= (b.minY - tolerance) && y <= (b.maxY + tolerance);
  }

  static fromJSON(data) {
    switch (data.type) {
      case 'line': return Object.assign(new CADLine(data.x1, data.y1, data.x2, data.y2), data);
      case 'polyline': return Object.assign(new CADPolyline(data.points), data);
      case 'rectangle':
      case 'wall': return Object.assign(new CADRect(data.x, data.y, data.width, data.height, data.type), data);
      case 'circle': return Object.assign(new CADCircle(data.cx, data.cy, data.radius), data);
      case 'arc': return Object.assign(new CADArc(data.cx, data.cy, data.radius, data.startAngle, data.endAngle), data);
      case 'window': return Object.assign(new CADWindow(data.x, data.y, data.width, data.height, data.sillHeight, data.frameType, data.shutters), data);
      case 'door': return Object.assign(new CADDoor(data.x, data.y, data.width, data.height, data.doorType), data);
      case 'balcony': return Object.assign(new CADBalcony(data.x, data.y, data.width, data.height, data.railingType, data.projection), data);
      case 'column': return Object.assign(new CADColumn(data.x, data.y, data.width, data.height), data);
      case 'slab': return Object.assign(new CADSlab(data.x, data.y, data.width, data.thickness, data.projection), data);
      case 'parapet': return Object.assign(new CADParapet(data.x, data.y, data.width, data.height), data);
      case 'stair': return Object.assign(new CADStair(data.x, data.y, data.width, data.height, data.steps), data);
      case 'dimension': return Object.assign(new CADDimension(data.x1, data.y1, data.x2, data.y2, data.offset), data);
      case 'text': return Object.assign(new CADText(data.x, data.y, data.text, data.fontSize), data);
      default: return Object.assign(new CADObject(data.type), data);
    }
  }
}

// CAD Primitives

class CADLine extends CADObject {
  constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
    super('line');
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  getBounds() {
    const minX = Math.min(this.x1, this.x2);
    const maxX = Math.max(this.x1, this.x2);
    const minY = Math.min(this.y1, this.y2);
    const maxY = Math.max(this.y1, this.y2);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  move(dx, dy) {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  draw(ctx, viewport) {
    const p1 = viewport.worldToScreen(this.x1, this.y1);
    const p2 = viewport.worldToScreen(this.x2, this.y2);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = this.selected ? '#c1121f' : (this.color || '#212529');
    ctx.lineWidth = this.selected ? this.lineWidth + 1.5 : this.lineWidth;
    ctx.stroke();
  }
}

class CADPolyline extends CADObject {
  constructor(points = []) {
    super('polyline');
    this.points = points; // Array of {x, y}
  }

  getBounds() {
    if (!this.points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  move(dx, dy) {
    this.points.forEach(p => { p.x += dx; p.y += dy; });
  }

  draw(ctx, viewport) {
    if (this.points.length < 2) return;
    ctx.beginPath();
    const p0 = viewport.worldToScreen(this.points[0].x, this.points[0].y);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < this.points.length; i++) {
      const p = viewport.worldToScreen(this.points[i].x, this.points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = this.selected ? '#c1121f' : (this.color || '#212529');
    ctx.lineWidth = this.selected ? this.lineWidth + 1.5 : this.lineWidth;
    ctx.stroke();
  }
}

class CADRect extends CADObject {
  constructor(x = 0, y = 0, width = 10, height = 10, type = 'rectangle') {
    super(type);
    this.x = x;         // Bottom-left corner X
    this.y = y;         // Bottom-left corner Y
    this.width = width;
    this.height = height;
  }

  getBounds() {
    return {
      minX: this.x,
      minY: this.y,
      maxX: this.x + this.width,
      maxY: this.y + this.height,
      width: this.width,
      height: this.height
    };
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  draw(ctx, viewport) {
    const sp = viewport.worldToScreen(this.x, this.y + this.height); // Top-left on screen canvas
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    ctx.beginPath();
    ctx.rect(sp.x, sp.y, sw, sh);
    if (this.type === 'wall') {
      ctx.fillStyle = this.selected ? 'rgba(193, 18, 31, 0.1)' : 'rgba(240, 242, 245, 0.5)';
      ctx.fill();
    }
    ctx.strokeStyle = this.selected ? '#c1121f' : (this.color || '#1b4332');
    ctx.lineWidth = this.selected ? this.lineWidth + 1.5 : (this.type === 'wall' ? 2 : this.lineWidth);
    ctx.stroke();
  }
}

class CADCircle extends CADObject {
  constructor(cx = 0, cy = 0, radius = 5) {
    super('circle');
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
  }

  getBounds() {
    return {
      minX: this.cx - this.radius,
      minY: this.cy - this.radius,
      maxX: this.cx + this.radius,
      maxY: this.cy + this.radius,
      width: this.radius * 2,
      height: this.radius * 2
    };
  }

  move(dx, dy) {
    this.cx += dx;
    this.cy += dy;
  }

  draw(ctx, viewport) {
    const sc = viewport.worldToScreen(this.cx, this.cy);
    const sr = this.radius * viewport.zoom;
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, sr, 0, Math.PI * 2);
    ctx.strokeStyle = this.selected ? '#c1121f' : (this.color || '#212529');
    ctx.lineWidth = this.selected ? this.lineWidth + 1.5 : this.lineWidth;
    ctx.stroke();
  }
}

class CADArc extends CADObject {
  constructor(cx = 0, cy = 0, radius = 5, startAngle = 0, endAngle = Math.PI) {
    super('arc');
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
  }

  getBounds() {
    return {
      minX: this.cx - this.radius,
      minY: this.cy - this.radius,
      maxX: this.cx + this.radius,
      maxY: this.cy + this.radius,
      width: this.radius * 2,
      height: this.radius * 2
    };
  }

  move(dx, dy) {
    this.cx += dx;
    this.cy += dy;
  }

  draw(ctx, viewport) {
    const sc = viewport.worldToScreen(this.cx, this.cy);
    const sr = this.radius * viewport.zoom;
    ctx.beginPath();
    // Invert canvas angles because screen Y goes down
    ctx.arc(sc.x, sc.y, sr, -this.startAngle, -this.endAngle, true);
    ctx.strokeStyle = this.selected ? '#c1121f' : (this.color || '#212529');
    ctx.lineWidth = this.selected ? this.lineWidth + 1.5 : this.lineWidth;
    ctx.stroke();
  }
}

// Parametric Architectural Components

class CADWindow extends CADRect {
  constructor(x = 0, y = 0, width = 5, height = 4, sillHeight = 3, frameType = 'Aluminium Glass', shutters = 2) {
    super(x, y, width, height, 'window');
    this.sillHeight = sillHeight;
    this.frameType = frameType;
    this.shutters = shutters;
  }

  draw(ctx, viewport) {
    super.draw(ctx, viewport);
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    // Draw inner window frame and shutter divisions
    ctx.strokeStyle = this.selected ? '#c1121f' : '#2d6a4f';
    ctx.lineWidth = 1;

    // Outer frame inset
    const inset = Math.min(sw, sh) * 0.08;
    ctx.strokeRect(sp.x + inset, sp.y + inset, sw - inset * 2, sh - inset * 2);

    // Shutters mullions
    if (this.shutters > 1) {
      const step = (sw - inset * 2) / this.shutters;
      for (let i = 1; i < this.shutters; i++) {
        ctx.beginPath();
        ctx.moveTo(sp.x + inset + step * i, sp.y + inset);
        ctx.lineTo(sp.x + inset + step * i, sp.y + sh - inset);
        ctx.stroke();
      }
    }

    // Glass reflection line
    ctx.beginPath();
    ctx.moveTo(sp.x + inset * 2, sp.y + sh - inset * 2);
    ctx.lineTo(sp.x + sw - inset * 2, sp.y + inset * 2);
    ctx.strokeStyle = 'rgba(64, 145, 108, 0.4)';
    ctx.stroke();
  }
}

class CADDoor extends CADRect {
  constructor(x = 0, y = 0, width = 3.5, height = 7, doorType = 'Main Entrance Door') {
    super(x, y, width, height, 'door');
    this.doorType = doorType; // 'Main Entrance Door', 'Service Door', 'Garage Door'
  }

  draw(ctx, viewport) {
    super.draw(ctx, viewport);
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    ctx.strokeStyle = this.selected ? '#c1121f' : '#1b4332';
    ctx.lineWidth = 1;

    if (this.doorType === 'Garage Door') {
      // Draw horizontal garage panels
      const panels = 5;
      const step = sh / panels;
      for (let i = 1; i < panels; i++) {
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y + step * i);
        ctx.lineTo(sp.x + sw, sp.y + step * i);
        ctx.stroke();
      }
    } else {
      // Draw door frame & handle knob
      ctx.strokeRect(sp.x + sw * 0.05, sp.y + sh * 0.02, sw * 0.9, sh * 0.98);
      // Handle
      ctx.beginPath();
      ctx.arc(sp.x + sw * 0.82, sp.y + sh * 0.55, Math.max(2, sw * 0.04), 0, Math.PI * 2);
      ctx.fillStyle = '#1b4332';
      ctx.fill();
    }
  }
}

class CADBalcony extends CADRect {
  constructor(x = 0, y = 0, width = 12, height = 3.5, railingType = 'Glass Railing', projection = 4) {
    super(x, y, width, height, 'balcony');
    this.railingType = railingType; // 'Glass Railing', 'Metal Vertical Fins', 'Brick Parapet'
    this.projection = projection;
  }

  draw(ctx, viewport) {
    super.draw(ctx, viewport);
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    ctx.strokeStyle = this.selected ? '#c1121f' : '#40916c';
    ctx.lineWidth = 1.5;

    if (this.railingType === 'Metal Vertical Fins') {
      const pCount = Math.floor(sw / 8);
      for (let i = 1; i < pCount; i++) {
        ctx.beginPath();
        ctx.moveTo(sp.x + (sw / pCount) * i, sp.y);
        ctx.lineTo(sp.x + (sw / pCount) * i, sp.y + sh);
        ctx.stroke();
      }
    } else if (this.railingType === 'Glass Railing') {
      ctx.fillStyle = 'rgba(64, 145, 108, 0.15)';
      ctx.fillRect(sp.x, sp.y, sw, sh);
      // Top handrail
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x + sw, sp.y);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

class CADColumn extends CADRect {
  constructor(x = 0, y = 0, width = 1.5, height = 10) {
    super(x, y, width, height, 'column');
  }

  draw(ctx, viewport) {
    super.draw(ctx, viewport);
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    // Cross-hatch structural fill
    ctx.strokeStyle = 'rgba(27, 67, 50, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x + sw, sp.y + sh);
    ctx.moveTo(sp.x + sw, sp.y); ctx.lineTo(sp.x, sp.y + sh);
    ctx.stroke();
  }
}

class CADSlab extends CADRect {
  constructor(x = 0, y = 0, width = 40, thickness = 1, projection = 1.5) {
    super(x, y, width, thickness, 'slab');
    this.thickness = thickness;
    this.projection = projection;
  }

  draw(ctx, viewport) {
    super.draw(ctx, viewport);
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    ctx.fillStyle = 'rgba(45, 106, 79, 0.2)';
    ctx.fillRect(sp.x, sp.y, sw, sh);
  }
}

class CADParapet extends CADRect {
  constructor(x = 0, y = 0, width = 40, height = 4) {
    super(x, y, width, height, 'parapet');
  }
}

class CADStair extends CADRect {
  constructor(x = 0, y = 0, width = 6, height = 4, steps = 6) {
    super(x, y, width, height, 'stair');
    this.steps = steps;
  }

  draw(ctx, viewport) {
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    ctx.strokeStyle = this.selected ? '#c1121f' : '#212529';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    const stepW = sw / this.steps;
    const stepH = sh / this.steps;
    ctx.moveTo(sp.x, sp.y + sh);
    for (let i = 0; i < this.steps; i++) {
      ctx.lineTo(sp.x + stepW * i, sp.y + sh - stepH * i);
      ctx.lineTo(sp.x + stepW * (i + 1), sp.y + sh - stepH * i);
    }
    ctx.lineTo(sp.x + sw, sp.y + sh);
    ctx.closePath();
    ctx.stroke();
  }
}

// Annotation Tools

class CADDimension extends CADObject {
  constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0, offset = 1.5) {
    super('dimension');
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.offset = offset; // Distance of dimension line from geometric points
  }

  getDistance() {
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getBounds() {
    const minX = Math.min(this.x1, this.x2);
    const maxX = Math.max(this.x1, this.x2);
    const minY = Math.min(this.y1, this.y2) - Math.abs(this.offset);
    const maxY = Math.max(this.y1, this.y2) + Math.abs(this.offset);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  move(dx, dy) {
    this.x1 += dx; this.y1 += dy;
    this.x2 += dx; this.y2 += dy;
  }

  draw(ctx, viewport) {
    const dist = this.getDistance();
    const formattedVal = Units.format(dist);

    const p1 = viewport.worldToScreen(this.x1, this.y1);
    const p2 = viewport.worldToScreen(this.x2, this.y2);

    const offPx = this.offset * viewport.zoom;
    // Dimension line points shifted by offset
    const d1 = { x: p1.x, y: p1.y - offPx };
    const d2 = { x: p2.x, y: p2.y - offPx };

    ctx.strokeStyle = this.selected ? '#c1121f' : '#2b9348';
    ctx.fillStyle = this.selected ? '#c1121f' : '#2b9348';
    ctx.lineWidth = 1;

    // Extension lines
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(d1.x, d1.y - 4);
    ctx.moveTo(p2.x, p2.y); ctx.lineTo(d2.x, d2.y - 4);
    // Main dimension line
    ctx.moveTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y);
    ctx.stroke();

    // Arrows / Ticks
    const drawTick = (pt) => {
      ctx.beginPath();
      ctx.moveTo(pt.x - 4, pt.y + 4);
      ctx.lineTo(pt.x + 4, pt.y - 4);
      ctx.stroke();
    };
    drawTick(d1);
    drawTick(d2);

    // Dimension Text
    ctx.font = 'bold 11px SFMono-Regular, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(formattedVal, (d1.x + d2.x) / 2, (d1.y + d2.y) / 2 - 2);
  }
}

class CADText extends CADObject {
  constructor(x = 0, y = 0, text = 'Label', fontSize = 12) {
    super('text');
    this.x = x;
    this.y = y;
    this.text = text;
    this.fontSize = fontSize;
  }

  getBounds() {
    return { minX: this.x, minY: this.y, maxX: this.x + 5, maxY: this.y + 2, width: 5, height: 2 };
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  draw(ctx, viewport) {
    const sp = viewport.worldToScreen(this.x, this.y);
    ctx.font = `${this.fontSize}px sans-serif`;
    ctx.fillStyle = this.selected ? '#c1121f' : (this.color || '#212529');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.text, sp.x, sp.y);
  }
}

window.CADObject = CADObject;
window.CADLine = CADLine;
window.CADPolyline = CADPolyline;
window.CADRect = CADRect;
window.CADCircle = CADCircle;
window.CADArc = CADArc;
window.CADWindow = CADWindow;
window.CADDoor = CADDoor;
window.CADBalcony = CADBalcony;
window.CADColumn = CADColumn;
window.CADSlab = CADSlab;
window.CADParapet = CADParapet;
window.CADStair = CADStair;
window.CADDimension = CADDimension;
window.CADText = CADText;
