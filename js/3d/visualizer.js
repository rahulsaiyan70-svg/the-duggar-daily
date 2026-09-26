/**
 * RMA Front Elevation Designer - Three.js 3D Elevation Visualizer
 * Converts 2D CAD elevation geometry into interactive 3D extruded building models.
 */

class Elevation3DVisualizer {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.buildingGroup = null;
    this.isInitialized = false;

    // Architectural 3D Materials
    this.materials = {
      wall: new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.8 }),
      slab: new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.5 }),
      windowGlass: new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.9 }),
      windowFrame: new THREE.MeshStandardMaterial({ color: 0x212529, roughness: 0.4 }),
      doorWood: new THREE.MeshStandardMaterial({ color: 0x7f5539, roughness: 0.6 }),
      balconyGlass: new THREE.MeshPhysicalMaterial({ color: 0xb7e4c7, transparent: true, opacity: 0.5, roughness: 0.1 }),
      metalRail: new THREE.MeshStandardMaterial({ color: 0x1b4332, metalness: 0.8 }),
      ground: new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.9 })
    };
  }

  init() {
    if (this.isInitialized) return;

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 15, 60);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.target.set(0, 12, 0);
    }

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    dirLight.position.set(30, 50, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xbbe0ff, 0.4);
    fillLight.position.set(-30, 20, -20);
    this.scene.add(fillLight);

    // 6. Ground Plane
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const ground = new THREE.Mesh(groundGeo, this.materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Building Group Container
    this.buildingGroup = new THREE.Group();
    this.scene.add(this.buildingGroup);

    // Window Resize
    window.addEventListener('resize', () => this.onWindowResize());

    this.isInitialized = true;
    this.animate();
  }

  onWindowResize() {
    if (!this.renderer || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Convert 2D CAD objects to 3D Extrusions
  updateFrom2DCAD(cadObjects) {
    if (!this.isInitialized) this.init();

    // Clear previous 3D objects
    while (this.buildingGroup.children.length > 0) {
      const child = this.buildingGroup.children[0];
      this.buildingGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    const wallDepth = 30; // Default building depth in feet

    cadObjects.forEach(obj => {
      const b = obj.getBounds();
      const w = b.width;
      const h = b.height;
      const x = b.minX + w / 2;
      const y = b.minY + h / 2;

      switch (obj.type) {
        case 'wall':
        case 'parapet': {
          const geo = new THREE.BoxGeometry(w, h, wallDepth);
          const mesh = new THREE.Mesh(geo, this.materials.wall);
          mesh.position.set(x, y, -wallDepth / 2);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.buildingGroup.add(mesh);
          break;
        }

        case 'slab': {
          const proj = obj.projection || 1.5;
          const geo = new THREE.BoxGeometry(w + proj * 2, h, wallDepth + proj * 2);
          const mesh = new THREE.Mesh(geo, this.materials.slab);
          mesh.position.set(x, y, -wallDepth / 2 + proj);
          mesh.castShadow = true;
          this.buildingGroup.add(mesh);
          break;
        }

        case 'window': {
          // Glass Pane
          const glassGeo = new THREE.BoxGeometry(w * 0.9, h * 0.9, 0.2);
          const glassMesh = new THREE.Mesh(glassGeo, this.materials.windowGlass);
          glassMesh.position.set(x, y, 0.1);
          this.buildingGroup.add(glassMesh);

          // Frame
          const frameGeo = new THREE.BoxGeometry(w, h, 0.4);
          const frameMesh = new THREE.Mesh(frameGeo, this.materials.windowFrame);
          frameMesh.position.set(x, y, 0);
          this.buildingGroup.add(frameMesh);
          break;
        }

        case 'door': {
          const geo = new THREE.BoxGeometry(w, h, 0.5);
          const mesh = new THREE.Mesh(geo, this.materials.doorWood);
          mesh.position.set(x, y, 0.2);
          mesh.castShadow = true;
          this.buildingGroup.add(mesh);
          break;
        }

        case 'balcony': {
          const proj = obj.projection || 4;
          // Floor slab
          const floorGeo = new THREE.BoxGeometry(w, 0.5, proj);
          const floorMesh = new THREE.Mesh(floorGeo, this.materials.slab);
          floorMesh.position.set(x, b.minY + 0.25, proj / 2);
          this.buildingGroup.add(floorMesh);

          // Railing
          const railGeo = new THREE.BoxGeometry(w, h, 0.2);
          const mat = obj.railingType === 'Glass Railing' ? this.materials.balconyGlass : this.materials.metalRail;
          const railMesh = new THREE.Mesh(railGeo, mat);
          railMesh.position.set(x, y, proj);
          this.buildingGroup.add(railMesh);
          break;
        }

        case 'column': {
          const geo = new THREE.BoxGeometry(w, h, w);
          const mesh = new THREE.Mesh(geo, this.materials.slab);
          mesh.position.set(x, y, w / 2);
          mesh.castShadow = true;
          this.buildingGroup.add(mesh);
          break;
        }
      }
    });
  }

  setPresetView(preset) {
    if (!this.controls) return;
    switch (preset) {
      case 'front':
        this.camera.position.set(0, 15, 60);
        this.controls.target.set(0, 12, 0);
        break;
      case 'side':
        this.camera.position.set(60, 15, 0);
        this.controls.target.set(0, 12, 0);
        break;
      case 'perspective':
        this.camera.position.set(40, 30, 50);
        this.controls.target.set(0, 10, 0);
        break;
      case 'reset':
        this.camera.position.set(0, 15, 60);
        this.controls.target.set(0, 12, 0);
        break;
    }
    this.controls.update();
  }
}

window.Elevation3DVisualizer = Elevation3DVisualizer;
