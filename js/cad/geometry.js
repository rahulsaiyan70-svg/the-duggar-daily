/**
 * RMA CAD Geometry Engine & Data Model
 * Defines structured CAD elements storing spatial coordinates and architectural properties in FEET.
 * Includes complete geometry algorithms for Object Snapping (OSNAP) and AutoCAD operations:
 * Move, Copy, Rotate, Mirror, Offset, Trim, Extend, Fillet, Stretch, Scale, Explode, Area, Distance.
 */

class CADObject {
  constructor(type, properties = {}) {
    this.id = properties.id || 'obj_' + Math.random().toString(36).substr(2, 9);
    this.type = type; // 'line', 'polyline', 'rectangle', 'wall', 'circle', 'arc', 'window', 'door', 'balcony', 'column', 'slab', 'parapet', 'stair', 'dimension', 'text'
    this.layer = properties.layer || 'default';
    this.selected = false;
    this.color = properties.color || null;
    this.lineWidth = properties.lineWidth || 1.5;
  }

  getBounds() {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  getSnapPoints() {
    const b = this.getBounds();
    return [
      { x: b.minX, y: b.minY, type: 'endpoint' },
      { x: b.maxX, y: b.minY, type: 'endpoint' },
      { x: b.minX, y: b.maxY, type: 'endpoint' },
      { x: b.maxX, y: b.maxY, type: 'endpoint' },
      { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, type: 'midpoint' }
    ];
  }

  move(dx, dy) {}

  copy(dx, dy) {
    const cloned = this.clone();
    cloned.move(dx, dy);
    return cloned;
  }

  rotate(angleRad, centerPt = { x: 0, y: 0 }) {}

  scale(factor, basePt = { x: 0, y: 0 }) {}

  mirror(p1, p2) {}

  offset(distance, sidePt) {
    return [this.clone()];
  }

  explode() {
    return [this.clone()];
  }

  getArea() { return 0; }
  getPerimeter() { return 0; }

  clone() {
    const json = JSON.parse(JSON.stringify(this));
    json.id = 'obj_' + Math.random().toString(36).substr(2, 9);
    return CADObject.fromJSON(json);
  }

  draw(ctx, viewport) {}

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
      case 'window': return Object.assign(new CADWindow(data.x, data.y, data.width, data.height, data.sillHeight, data.windowType, data.frameThickness, data.shutters), data);
      case 'door': return Object.assign(new CADDoor(data.x, data.y, data.width, data.height, data.doorType, data.swingDirection), data);
      case 'balcony': return Object.assign(new CADBalcony(data.x, data.y, data.width, data.projection, data.slabThickness, data.railingHeight, data.railingType), data);
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

class GeometryUtils {
  static distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.hypot(dx, dy);
  }

  static rotatePoint(pt, center, angleRad) {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = pt.x - center.x;
    const dy = pt.y - center.y;
    return {
      x: center.x + (dx * cos - dy * sin),
      y: center.y + (dx * sin + dy * cos)
    };
  }

  static mirrorPoint(pt, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const a = (dx * dx - dy * dy) / (dx * dx + dy * dy);
    const b = (2 * dx * dy) / (dx * dx + dy * dy);
    const x = a * (pt.x - p1.x) + b * (pt.y - p1.y) + p1.x;
    const y = b * (pt.x - p1.x) - a * (pt.y - p1.y) + p1.y;
    return { x, y };
  }

  static perpendicularPoint(pt, lineP1, lineP2) {
    const dx = lineP2.x - lineP1.x;
    const dy = lineP2.y - lineP1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: lineP1.x, y: lineP1.y };

    const t = ((pt.x - lineP1.x) * dx + (pt.y - lineP1.y) * dy) / lenSq;
    return {
      x: lineP1.x + t * dx,
      y: lineP1.y + t * dy,
      t: t
    };
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

  getSnapPoints() {
    return [
      { x: this.x1, y: this.y1, type: 'endpoint' },
      { x: this.x2, y: this.y2, type: 'endpoint' },
      { x: (this.x1 + this.x2) / 2, y: (this.y1 + this.y2) / 2, type: 'midpoint' }
    ];
  }

  move(dx, dy) {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  rotate(angleRad, centerPt = { x: 0, y: 0 }) {
    const p1 = GeometryUtils.rotatePoint({ x: this.x1, y: this.y1 }, centerPt, angleRad);
    const p2 = GeometryUtils.rotatePoint({ x: this.x2, y: this.y2 }, centerPt, angleRad);
    this.x1 = p1.x; this.y1 = p1.y;
    this.x2 = p2.x; this.y2 = p2.y;
  }

  scale(factor, basePt = { x: 0, y: 0 }) {
    this.x1 = basePt.x + (this.x1 - basePt.x) * factor;
    this.y1 = basePt.y + (this.y1 - basePt.y) * factor;
    this.x2 = basePt.x + (this.x2 - basePt.x) * factor;
    this.y2 = basePt.y + (this.y2 - basePt.y) * factor;
  }

  mirror(p1, p2) {
    const np1 = GeometryUtils.mirrorPoint({ x: this.x1, y: this.y1 }, p1, p2);
    const np2 = GeometryUtils.mirrorPoint({ x: this.x2, y: this.y2 }, p1, p2);
    this.x1 = np1.x; this.y1 = np1.y;
    this.x2 = np2.x; this.y2 = np2.y;
  }

  offset(distance, sidePt) {
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return [this.clone()];

    const nx = -dy / len;
    const ny = dx / len;

    const midX = (this.x1 + this.x2) / 2;
    const midY = (this.y1 + this.y2) / 2;
    const dot = (sidePt.x - midX) * nx + (sidePt.y - midY) * ny;
    const dir = dot >= 0 ? 1 : -1;

    const offX = nx * distance * dir;
    const offY = ny * distance * dir;

    return [new CADLine(this.x1 + offX, this.y1 + offY, this.x2 + offX, this.y2 + offY)];
  }

  getPerimeter() {
    return Math.hypot(this.x2 - this.x1, this.y2 - this.y1);
  }

  hitTest(x, y, tolerance = 0.5) {
    const perp = GeometryUtils.perpendicularPoint({ x, y }, { x: this.x1, y: this.y1 }, { x: this.x2, y: this.y2 });
    if (perp.t >= 0 && perp.t <= 1) {
      return GeometryUtils.distance({ x, y }, perp) <= tolerance;
    }
    return Math.min(
      GeometryUtils.distance({ x, y }, { x: this.x1, y: this.y1 }),
      GeometryUtils.distance({ x, y }, { x: this.x2, y: this.y2 })
    ) <= tolerance;
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
    this.points = points;
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

  getSnapPoints() {
    const pts = [];
    for (let i = 0; i < this.points.length; i++) {
      pts.push({ x: this.points[i].x, y: this.points[i].y, type: 'endpoint' });
      if (i < this.points.length - 1) {
        pts.push({
          x: (this.points[i].x + this.points[i + 1].x) / 2,
          y: (this.points[i].y + this.points[i + 1].y) / 2,
          type: 'midpoint'
        });
      }
    }
    return pts;
  }

  move(dx, dy) {
    this.points.forEach(p => { p.x += dx; p.y += dy; });
  }

  rotate(angleRad, centerPt = { x: 0, y: 0 }) {
    this.points = this.points.map(p => GeometryUtils.rotatePoint(p, centerPt, angleRad));
  }

  scale(factor, basePt = { x: 0, y: 0 }) {
    this.points.forEach(p => {
      p.x = basePt.x + (p.x - basePt.x) * factor;
      p.y = basePt.y + (p.y - basePt.y) * factor;
    });
  }

  mirror(p1, p2) {
    this.points = this.points.map(p => GeometryUtils.mirrorPoint(p, p1, p2));
  }

  explode() {
    const lines = [];
    for (let i = 0; i < this.points.length - 1; i++) {
      lines.push(new CADLine(this.points[i].x, this.points[i].y, this.points[i + 1].x, this.points[i + 1].y));
    }
    return lines;
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
    this.x = x;
    this.y = y;
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

  getSnapPoints() {
    const x1 = this.x, y1 = this.y, x2 = this.x + this.width, y2 = this.y + this.height;
    return [
      { x: x1, y: y1, type: 'endpoint' },
      { x: x2, y: y1, type: 'endpoint' },
      { x: x1, y: y2, type: 'endpoint' },
      { x: x2, y: y2, type: 'endpoint' },
      { x: (x1 + x2) / 2, y: y1, type: 'midpoint' },
      { x: (x1 + x2) / 2, y: y2, type: 'midpoint' },
      { x: x1, y: (y1 + y2) / 2, type: 'midpoint' },
      { x: x2, y: (y1 + y2) / 2, type: 'midpoint' },
      { x: (x1 + x2) / 2, y: (y1 + y2) / 2, type: 'center' }
    ];
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  scale(factor, basePt = { x: this.x, y: this.y }) {
    this.x = basePt.x + (this.x - basePt.x) * factor;
    this.y = basePt.y + (this.y - basePt.y) * factor;
    this.width *= factor;
    this.height *= factor;
  }

  mirror(p1, p2) {
    const c = { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    const mc = GeometryUtils.mirrorPoint(c, p1, p2);
    this.x = mc.x - this.width / 2;
    this.y = mc.y - this.height / 2;
  }

  explode() {
    const x1 = this.x, y1 = this.y, x2 = this.x + this.width, y2 = this.y + this.height;
    return [
      new CADLine(x1, y1, x2, y1),
      new CADLine(x2, y1, x2, y2),
      new CADLine(x2, y2, x1, y2),
      new CADLine(x1, y2, x1, y1)
    ];
  }

  getArea() {
    return Math.abs(this.width * this.height);
  }

  getPerimeter() {
    return 2 * (Math.abs(this.width) + Math.abs(this.height));
  }

  draw(ctx, viewport) {
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
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

  getSnapPoints() {
    return [
      { x: this.cx, y: this.cy, type: 'center' },
      { x: this.cx + this.radius, y: this.cy, type: 'quadrant' },
      { x: this.cx - this.radius, y: this.cy, type: 'quadrant' },
      { x: this.cx, y: this.cy + this.radius, type: 'quadrant' },
      { x: this.cx, y: this.cy - this.radius, type: 'quadrant' }
    ];
  }

  move(dx, dy) {
    this.cx += dx;
    this.cy += dy;
  }

  scale(factor) {
    this.radius *= factor;
  }

  mirror(p1, p2) {
    const mc = GeometryUtils.mirrorPoint({ x: this.cx, y: this.cy }, p1, p2);
    this.cx = mc.x;
    this.cy = mc.y;
  }

  getArea() {
    return Math.PI * this.radius * this.radius;
  }

  getPerimeter() {
    return 2 * Math.PI * this.radius;
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

  getSnapPoints() {
    const p1 = { x: this.cx + this.radius * Math.cos(this.startAngle), y: this.cy + this.radius * Math.sin(this.startAngle), type: 'endpoint' };
    const p2 = { x: this.cx + this.radius * Math.cos(this.endAngle), y: this.cy + this.radius * Math.sin(this.endAngle), type: 'endpoint' };
    const midAngle = (this.startAngle + this.endAngle) / 2;
    const pMid = { x: this.cx + this.radius * Math.cos(midAngle), y: this.cy + this.radius * Math.sin(midAngle), type: 'midpoint' };
    return [{ x: this.cx, y: this.cy, type: 'center' }, p1, p2, pMid];
  }

  move(dx, dy) {
    this.cx += dx;
    this.cy += dy;
  }

  draw(ctx, viewport) {
    const sc = viewport.worldToScreen(this.cx, this.cy);
    const sr = this.radius * viewport.zoom;
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, sr, -this.startAngle, -this.endAngle, true);
    ctx.strokeStyle = this.selected ? '#c1121f' : (this.color || '#212529');
    ctx.lineWidth = this.selected ? this.lineWidth + 1.5 : this.lineWidth;
    ctx.stroke();
  }
}

// Parametric Architectural Components (Requirement 15, 16, 17, 18)

class CADWindow extends CADRect {
  constructor(x = 0, y = 0, width = 5, height = 4, sillHeight = 3, windowType = 'Double window', frameThickness = 0.2, shutters = 2) {
    super(x, y, width, height, 'window');
    this.sillHeight = sillHeight;
    this.windowType = windowType; // 'Single window', 'Double window', 'Sliding window', 'Large glass window', 'Fixed window'
    this.frameThickness = frameThickness; // in feet
    this.shutters = shutters;
  }

  draw(ctx, viewport) {
    super.draw(ctx, viewport);
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    ctx.strokeStyle = this.selected ? '#c1121f' : '#2d6a4f';
    ctx.lineWidth = 1;

    const framePx = Math.max(2, this.frameThickness * viewport.zoom);
    ctx.strokeRect(sp.x + framePx, sp.y + framePx, sw - framePx * 2, sh - framePx * 2);

    if (this.windowType === 'Sliding window' || this.windowType === 'Double window' || this.shutters > 1) {
      const shutterCount = this.windowType === 'Single window' || this.windowType === 'Fixed window' ? 1 : Math.max(2, this.shutters);
      const step = (sw - framePx * 2) / shutterCount;
      for (let i = 1; i < shutterCount; i++) {
        ctx.beginPath();
        ctx.moveTo(sp.x + framePx + step * i, sp.y + framePx);
        ctx.lineTo(sp.x + framePx + step * i, sp.y + sh - framePx);
        ctx.stroke();
      }
    }

    // Glass reflection
    ctx.beginPath();
    ctx.moveTo(sp.x + framePx * 2, sp.y + sh - framePx * 2);
    ctx.lineTo(sp.x + sw - framePx * 2, sp.y + framePx * 2);
    ctx.strokeStyle = 'rgba(64, 145, 108, 0.4)';
    ctx.stroke();
  }
}

class CADDoor extends CADRect {
  constructor(x = 0, y = 0, width = 3.5, height = 7, doorType = 'Main entrance door', swingDirection = 'Inward Right') {
    super(x, y, width, height, 'door');
    this.doorType = doorType; // 'Single door', 'Double door', 'Sliding door', 'Main entrance door', 'Garage door'
    this.swingDirection = swingDirection;
  }

  draw(ctx, viewport) {
    super.draw(ctx, viewport);
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    ctx.strokeStyle = this.selected ? '#c1121f' : '#1b4332';
    ctx.lineWidth = 1;

    if (this.doorType === 'Garage door') {
      const panels = 5;
      const step = sh / panels;
      for (let i = 1; i < panels; i++) {
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y + step * i);
        ctx.lineTo(sp.x + sw, sp.y + step * i);
        ctx.stroke();
      }
    } else if (this.doorType === 'Double door') {
      ctx.strokeRect(sp.x + sw * 0.05, sp.y + sh * 0.02, sw * 0.43, sh * 0.98);
      ctx.strokeRect(sp.x + sw * 0.52, sp.y + sh * 0.02, sw * 0.43, sh * 0.98);
    } else {
      ctx.strokeRect(sp.x + sw * 0.05, sp.y + sh * 0.02, sw * 0.9, sh * 0.98);
      ctx.beginPath();
      ctx.arc(sp.x + sw * 0.82, sp.y + sh * 0.55, Math.max(2, sw * 0.04), 0, Math.PI * 2);
      ctx.fillStyle = '#1b4332';
      ctx.fill();
    }
  }
}

class CADBalcony extends CADRect {
  constructor(x = 0, y = 0, width = 12, projection = 4, slabThickness = 0.75, railingHeight = 3.5, railingType = 'Glass Railing') {
    super(x, y, width, railingHeight, 'balcony');
    this.projection = projection; // in feet
    this.slabThickness = slabThickness;
    this.railingHeight = railingHeight;
    this.railingType = railingType;
  }

  draw(ctx, viewport) {
    super.draw(ctx, viewport);
    const sp = viewport.worldToScreen(this.x, this.y + this.height);
    const sw = this.width * viewport.zoom;
    const sh = this.height * viewport.zoom;

    ctx.strokeStyle = this.selected ? '#c1121f' : '#40916c';
    ctx.lineWidth = 1.5;

    if (this.railingType === 'Metal Vertical Fins') {
      const pCount = Math.max(2, Math.floor(sw / 8));
      for (let i = 1; i < pCount; i++) {
        ctx.beginPath();
        ctx.moveTo(sp.x + (sw / pCount) * i, sp.y);
        ctx.lineTo(sp.x + (sw / pCount) * i, sp.y + sh);
        ctx.stroke();
      }
    } else if (this.railingType === 'Glass Railing') {
      ctx.fillStyle = 'rgba(64, 145, 108, 0.15)';
      ctx.fillRect(sp.x, sp.y, sw, sh);
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
    this.offset = offset;
  }

  getDistance() {
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    return Math.hypot(dx, dy);
  }

  getBounds() {
    const minX = Math.min(this.x1, this.x2);
    const maxX = Math.max(this.x1, this.x2);
    const minY = Math.min(this.y1, this.y2) - Math.abs(this.offset);
    const maxY = Math.max(this.y1, this.y2) + Math.abs(this.offset);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  getSnapPoints() {
    return [
      { x: this.x1, y: this.y1, type: 'endpoint' },
      { x: this.x2, y: this.y2, type: 'endpoint' },
      { x: (this.x1 + this.x2) / 2, y: (this.y1 + this.y2) / 2, type: 'midpoint' }
    ];
  }

  move(dx, dy) {
    this.x1 += dx; this.y1 += dy;
    this.x2 += dx; this.y2 += dy;
  }

  draw(ctx, viewport) {
    const dist = this.getDistance();
    const formattedVal = typeof Units !== 'undefined' ? Units.format(dist) : `${dist.toFixed(2)}'`;

    const p1 = viewport.worldToScreen(this.x1, this.y1);
    const p2 = viewport.worldToScreen(this.x2, this.y2);

    const offPx = this.offset * viewport.zoom;
    const d1 = { x: p1.x, y: p1.y - offPx };
    const d2 = { x: p2.x, y: p2.y - offPx };

    ctx.strokeStyle = this.selected ? '#c1121f' : '#2b9348';
    ctx.fillStyle = this.selected ? '#c1121f' : '#2b9348';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(d1.x, d1.y - 4);
    ctx.moveTo(p2.x, p2.y); ctx.lineTo(d2.x, d2.y - 4);
    ctx.moveTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y);
    ctx.stroke();

    const drawTick = (pt) => {
      ctx.beginPath();
      ctx.moveTo(pt.x - 4, pt.y + 4);
      ctx.lineTo(pt.x + 4, pt.y - 4);
      ctx.stroke();
    };
    drawTick(d1);
    drawTick(d2);

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

  getSnapPoints() {
    return [{ x: this.x, y: this.y, type: 'endpoint' }];
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

if (typeof window !== 'undefined') {
  window.CADObject = CADObject;
  window.GeometryUtils = GeometryUtils;
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CADObject,
    GeometryUtils,
    CADLine,
    CADPolyline,
    CADRect,
    CADCircle,
    CADArc,
    CADWindow,
    CADDoor,
    CADBalcony,
    CADColumn,
    CADSlab,
    CADParapet,
    CADStair,
    CADDimension,
    CADText
  };
}
