"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { RealFrame } from "@/components/3d/RealFrame";

const PROFILE_POINTS = [
  {
    x: 0,
    y: 0,
    segment_type: "linear",
  },
  {
    x: 0,
    y: 2,
    segment_type: "linear",
  },
  {
    x: 0.15,
    y: 2,
    segment_type: "bezier",
    control_points: [
      {
        x: 0.4,
        y: 1.85,
      },
    ],
  },
  {
    x: 0.55,
    y: 1.3,
    segment_type: "bezier",
    control_points: [
      {
        x: 0.65,
        y: 1.1,
      },
    ],
  },
  {
    x: 0.75,
    y: 1.15,
    segment_type: "linear",
  },
  {
    x: 0.75,
    y: 1.05,
    segment_type: "linear",
  },
  {
    x: 0.85,
    y: 1.05,
    segment_type: "bezier",
    control_points: [
      {
        x: 1.2,
        y: 0.85,
      },
    ],
  },
  {
    x: 1.8,
    y: 0.55,
    segment_type: "bezier",
    control_points: [
      {
        x: 2.3,
        y: 0.35,
      },
    ],
  },
  {
    x: 2.35,
    y: 0.5,
    segment_type: "bezier",
    control_points: [
      {
        x: 2.4,
        y: 0.6,
      },
    ],
  },
  {
    x: 2.5,
    y: 0.85,
    segment_type: "linear",
  },
  {
    x: 2.625,
    y: 0.85,
    segment_type: "linear",
  },
  {
    x: 2.625,
    y: 0.625,
    segment_type: "linear",
  },
  {
    x: 3,
    y: 0.625,
    segment_type: "linear",
  },
  {
    x: 3,
    y: 0,
    segment_type: "linear",
  },
  {
    x: 0,
    y: 0,
    segment_type: "linear",
  },
];

// HMR update for texture loading fix  <<<<<<<
export default function Home() {
  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-2">
            3D Frame Viewer
          </h1>
          <p className="text-slate-300">
            Standalone demo of the RealFrame component with profile-based 3D
            geometry
          </p>
          <div className="mt-4 bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-2">
              Frame Details
            </h2>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Width: 16 inches</li>
              <li>• Height: 20 inches</li>
              <li>• Frame Width: 3 inches</li>
              <li>• Frame Depth: 2 inches</li>
              <li>• Profile Points: {PROFILE_POINTS.length} vertices</li>
              <li>• Bezier curves for smooth edges</li>
            </ul>
          </div>
          <div className="mt-4 text-sm text-slate-400">
            <p>💡 Use mouse to rotate, scroll to zoom</p>
          </div>
        </div>
      </div>

      <Canvas
        camera={{ position: [0, 0, 30], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#0f172a"]} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <spotLight
          position={[-10, 5, 10]}
          angle={0.3}
          penumbra={1}
          intensity={0.8}
          castShadow
        />

        <RealFrame
          width={16}
          height={20}
          frameWidth={3}
          frameDepth={2}
          textureUrl="/textures/edge.png"
          sideTextureUrl="/textures/side.png"
          artworkUrl="/artwork.png"
          backingTextureUrl="/frame-back.png"
          profilePoints={PROFILE_POINTS}
          hasGlass={true}
          imageInset={0.5}
          debug={false}
          profile_albedo_url="/textures/albedo.jpg"
          profile_normal_url="/textures/normal.jpg"
          profile_roughness_url="/textures/roughness.jpg"
          profile_ao_url="/textures/ao.jpg"
        />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          minDistance={15}
          maxDistance={60}
        />

        <Environment preset="studio" />
      </Canvas>
    </div>
  );
}
