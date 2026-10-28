import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// A genuine navigable CSS 3D fallback for browsers without WebGL. It projects the
// same gallery geometry and camera; it is not a screenshot of the exhibition.
export function createCSSGalleryRenderer() {
  const css = new CSS3DRenderer(), scene = new THREE.Scene(), copies = [];
  let initialized = false, frame = 0;
  const textureSources = new Map();
  const spherePosition=new THREE.Vector3(),sphereRotation=new THREE.Quaternion(),sphereScale=new THREE.Vector3();
  function face(mesh, w, h, position, rotation) {
    const pixels=mesh.userData.cssPixelsPerUnit||100;
    const element = document.createElement('div');
    element.style.cssText = `width:${w * pixels}px;height:${h * pixels}px;background:${mesh.material.transparent?'transparent':mesh.material.color.getStyle()};backface-visibility:hidden;pointer-events:none;overflow:hidden;`;
    const object = new CSS3DObject(element);
    object.position.copy(position); object.rotation.set(...rotation); object.scale.setScalar(1/pixels); object.updateMatrix();
    object.matrixAutoUpdate = false;
    const local = object.matrix.clone(); scene.add(object);
    copies.push({ mesh, object, local, element, mapped: false });
  }
  function initialize(source) {
    source.traverse(mesh => {
      if (!mesh.isMesh || mesh.userData.skipCSS) return;
      const p = mesh.geometry.parameters;
      if (mesh.geometry.type === 'SphereGeometry') {
        face(mesh,p.radius*2,p.radius*2,new THREE.Vector3(),[0,0,0]);
        const copy=copies.at(-1);copy.sphere=true;copy.element.style.borderRadius='50%';copy.element.style.boxShadow='inset -25px -10px 35px #000b';
      }
      if (mesh.geometry.type === 'PlaneGeometry') face(mesh, p.width, p.height, new THREE.Vector3(), [0, 0, 0]);
      if (mesh.geometry.type === 'BoxGeometry') {
        const { width: w, height: h, depth: d } = p;
        face(mesh, w, h, new THREE.Vector3(0, 0, d / 2), [0, 0, 0]);
        face(mesh, w, h, new THREE.Vector3(0, 0, -d / 2), [0, Math.PI, 0]);
        face(mesh, d, h, new THREE.Vector3(w / 2, 0, 0), [0, Math.PI / 2, 0]);
        face(mesh, d, h, new THREE.Vector3(-w / 2, 0, 0), [0, -Math.PI / 2, 0]);
        face(mesh, w, d, new THREE.Vector3(0, h / 2, 0), [-Math.PI / 2, 0, 0]);
        face(mesh, w, d, new THREE.Vector3(0, -h / 2, 0), [Math.PI / 2, 0, 0]);
      }
    });
    initialized = true;
  }
  return {
    domElement: css.domElement, isCSSFallback: true,
    capabilities: { getMaxAnisotropy: () => 1 },
    xr: { enabled: false, isPresenting: false, setReferenceSpaceType() {} },
    setPixelRatio() {}, setSize: (w, h) => css.setSize(w, h),
    setClearColor(color, alpha) { css.domElement.style.background = alpha === 0 ? 'transparent' : new THREE.Color(color).getStyle(); },
    render(source, camera) {
      source.updateMatrixWorld(true); camera.updateMatrixWorld();
      if (!initialized) initialize(source);
      for (const copy of copies) {
        copy.object.matrix.multiplyMatrices(copy.mesh.matrixWorld, copy.local);
        if(copy.sphere){copy.object.matrix.decompose(spherePosition,sphereRotation,sphereScale);copy.object.matrix.compose(spherePosition,camera.quaternion,sphereScale);}
        copy.object.matrixWorldNeedsUpdate = true;
        let visible = true;
        for (let parent = copy.mesh; parent; parent = parent.parent) visible &&= parent.visible;
        copy.object.visible = visible;
        const image = copy.mesh.material.map?.image;
        // Procedural DataTextures have pixel buffers, not browser image URLs.
        // Keep the material colour in compatibility mode instead of requesting
        // an invalid "undefined" image for every architectural face.
        if (image && !image.data && !copy.mapped && (image.width || image.naturalWidth)) {
          let src = textureSources.get(image);
          if (!src) { src = image instanceof HTMLCanvasElement ? image.toDataURL() : image.src; textureSources.set(image, src); }
          const img = document.createElement('img'); img.src = src; img.alt = ''; img.draggable = false;
          img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;'; copy.element.appendChild(img); copy.mapped = true;
        }
      }
      css.render(scene, camera);
    },
    setAnimationLoop(callback) {
      cancelAnimationFrame(frame);
      if (callback) { const tick = time => { callback(time); frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); }
    },
    dispose() { cancelAnimationFrame(frame); copies.forEach(copy => copy.element.remove()); textureSources.clear(); css.domElement.remove(); },
  };
}
