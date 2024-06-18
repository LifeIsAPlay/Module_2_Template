import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useLoader, useFrame, extend, useThree } from '@react-three/fiber';
import './App.css';
import { OrbitControls, Stats } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Raycaster, Vector2 } from 'three';
import { HexColorPicker } from 'react-colorful';
import * as THREE from 'three';


extend({ Raycaster });

function Model({ url, setHoveredObject }) {
  const gltf = useLoader(GLTFLoader, url);

  useEffect(() => {
    if (gltf) {
      console.log("Model hierarchy:");
      traverseHierarchy(gltf.scene, 0);
    }
  }, [gltf]);

  const traverseHierarchy = (node, level) => {
    const indent = ' '.repeat(level * 2);
    console.log(`${indent}${node.name || 'Unnamed node'} (${node.type})`);
    node.children.forEach(child => traverseHierarchy(child, level + 1));
  };

  return <primitive object={gltf.scene} />;
}

function App() {
  const [modelUrl, setModelUrl] = useState(null);
  const [hoveredObject, setHoveredObject] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [color, setColor] = useState('#ffffff');

  const handleModelUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setModelUrl(url);
    }
  };

  const handleDownload = () => {
    if (modelUrl) {
      const link = document.createElement('a');
      link.href = modelUrl;
      link.download = 'model.glb';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <>
      <Canvas camera={{ position: [-8, 5, 8] }}>
        <ambientLight intensity={0.5} />
        <directionalLight color="white" position={[5, 5, 5]} intensity={1} />
        <directionalLight color="white" position={[-5, -5, -5]} intensity={0.5} />
        <directionalLight color="white" position={[0, 5, 0]} intensity={0.5} />
        <directionalLight color="white" position={[0, -5, 0]} intensity={0.5} />
        {modelUrl && <Model url={modelUrl} setHoveredObject={setHoveredObject} />}
        <OrbitControls />
        <Stats className="stats-panel" />
        <HoverHighlight setHoveredObject={setHoveredObject} setSelectedObject={setSelectedObject} />
      </Canvas>
      <div className="upload-container">
        <input
          type="file"
          accept=".glb"
          onChange={handleModelUpload}
          className="upload-button"
        />
      </div>
      <div className="title">
        3D Model Viewer
      </div>
      {selectedObject && (
        <ColorPanel key={selectedObject.uuid} selectedObject={selectedObject} color={color} setColor={setColor} />
      )}
      <div className="download-container">
        <button onClick={handleDownload} className="download-button">
          Download GLB
        </button>
      </div>
    </>
  );
}

function HoverHighlight({ setHoveredObject, setSelectedObject }) {
  const { gl, scene, camera } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);
  const mouse = useRef(new Vector2());
  const previousHoveredObject = useRef(null);
  const originalColor = useRef(null);

  const onMouseMove = (event) => {
    mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };

  const onClick = (event) => {
    if (previousHoveredObject.current) {
      setSelectedObject(previousHoveredObject.current);
      console.log("Clicked Mesh:", previousHoveredObject.current.name);
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
    };
  }, []);

  useFrame(() => {
    raycaster.setFromCamera(mouse.current, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      setHoveredObject(object);

      if (previousHoveredObject.current && previousHoveredObject.current !== object) {
        previousHoveredObject.current.material.emissive.set(originalColor.current);
      }

      if (object.material) {
        if (previousHoveredObject.current !== object) {
          originalColor.current = object.material.emissive.getHex();
          previousHoveredObject.current = object;
        }
        object.material.emissive.set(0xaaaaaa);
      }
    } else {
      if (previousHoveredObject.current) {
        previousHoveredObject.current.material.emissive.set(originalColor.current);
        previousHoveredObject.current = null;
        originalColor.current = null;
      }
      setHoveredObject(null);
    }
  });

  return null;
}

function ColorPanel({ selectedObject, color, setColor }) {
  const [transparency, setTransparency] = useState(selectedObject.material.transparent);
  const [opacity, setOpacity] = useState(selectedObject.material.opacity);
  const [wireframe, setWireframe] = useState(selectedObject.material.wireframe);
  const [meshInfo, setMeshInfo] = useState({ vertices: 0, polygons: 0, triangles: 0 });

  const handleColorChange = (color) => {
    setColor(color);
    if (selectedObject && selectedObject.material) {
      selectedObject.material.color.set(color);
      console.log(`Changed color of ${selectedObject.name} to ${color}`);
    }
  };

  const handleCheckboxChange = (event) => {
    const isChecked = event.target.checked;
    setTransparency(isChecked);
    if (selectedObject && selectedObject.material) {
      selectedObject.material.transparent = isChecked;
      console.log(`Transparency mode for ${selectedObject.name}: ${isChecked}`);
    }
  };

  const handleWireframeChange = () => {
    const isChecked = !wireframe;
    setWireframe(isChecked);
    if (selectedObject && selectedObject.material) {
      selectedObject.material.wireframe = isChecked;
      console.log(`Wireframe mode for ${selectedObject.name}: ${isChecked}`);
    }
  };

  const handleOpacityChange = (event) => {
    const value = parseFloat(event.target.value);
    setOpacity(value);
    if (selectedObject && selectedObject.material) {
      selectedObject.material.opacity = value;
      console.log(`Changed opacity of ${selectedObject.name} to ${value}`);
    }
  };

  useEffect(() => {
    setTransparency(selectedObject.material.transparent);
    setOpacity(selectedObject.material.opacity);
    setWireframe(selectedObject.material.wireframe);

    // Calculate mesh info
    const geometry = selectedObject.geometry;
    if (geometry) {
      const vertices = geometry.attributes.position.count;
      const polygons = vertices / 3;
      const triangles = polygons * 2;
      setMeshInfo({ vertices, polygons, triangles });
    }
  }, [selectedObject]);

  if (!selectedObject) {
    return null; // If no mesh is selected, don't render the color panel
  }

  return (
    <div className="color-panel" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100 }}>
      <HexColorPicker color={color} onChange={handleColorChange} />
      <div style={{ marginTop: '10px' }}>
        <label>
          Wireframe Mode:
          <input
            type="checkbox"
            checked={wireframe}
            onChange={handleWireframeChange}
            style={{ marginLeft: '5px' }}
          />
        </label>
      </div>
      <div style={{ marginTop: '10px' }}>
        <label>
          Transparency:
          <input
            type="checkbox"
            checked={transparency}
            onChange={handleCheckboxChange}
            style={{ marginLeft: '5px' }}
          />
        </label>
      </div>
      <div style={{ marginTop: '10px' }}>
        <label>
          Opacity:
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={handleOpacityChange}
            style={{ marginLeft: '5px', width: '80px' }}
          />
        </label>
        <span style={{ marginLeft: '5px' }}>{opacity}</span>
      </div>
      <div style={{ marginTop: '10px' }}>
        <strong>Mesh Info:</strong>
        <div>Vertices: {meshInfo.vertices.toFixed(0)}</div>
        <div>Polygons: {meshInfo.polygons.toFixed(0)}</div>
        <div>Triangles: {meshInfo.triangles.toFixed(0)}</div>
      </div>
    </div>
  );
}

export default App;
