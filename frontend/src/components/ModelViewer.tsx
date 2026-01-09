import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { useEffect, useState } from 'react';
import * as THREE from 'three';

interface ModelViewerProps {
  modelUrl: string;
}

function Model({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#3b82f6" />
    </mesh>
  );
}

export function ModelViewer({ modelUrl }: ModelViewerProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const loader = new STLLoader();
    loader.load(
      modelUrl,
      (loadedGeometry) => {
        loadedGeometry.center();
        setGeometry(loadedGeometry);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error loading STL:', err);
        setError('Failed to load 3D model');
        setLoading(false);
      }
    );
  }, [modelUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading 3D model...</p>
        </div>
      </div>
    );
  }

  if (error || !geometry) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center text-red-600">
          <p>{error || 'Failed to load model'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-96 bg-gray-900 rounded-lg shadow-lg">
      <Canvas camera={{ position: [50, 50, 50], fov: 50 }}>
        <Stage environment="city" intensity={0.6}>
          <Model geometry={geometry} />
        </Stage>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
