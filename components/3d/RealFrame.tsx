"use client";

import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useTexture, Line } from "@react-three/drei";

interface RealFrameProps {
  width: number;
  height: number;
  frameWidth: number;
  frameDepth: number;
  textureUrl: string;
  sideTextureUrl?: string;
  artworkUrl?: string;
  backingTextureUrl?: string;
  imageInset?: number;
  hasGlass?: boolean;
  profile_normal_url?: string;
  profile_albedo_url?: string;
  profile_roughness_url?: string;
  profile_ao_url?: string;
  debug?: boolean;
  profilePoints: ProfilePoint[];
}

interface ProfilePoint {
  x: number;
  y: number;
  segment_type: string;
  control_points?: { x: number; y: number }[];
}

const expandProfilePoints = (profilePoints: ProfilePoint[]) => {
  const expanded: { x: number; y: number }[] = [];
  for (let i = 0; i < profilePoints.length; i++) {
    const p = profilePoints[i];
    if (i === 0) {
      expanded.push({ x: p.x, y: p.y });
      continue;
    }

    const prev = profilePoints[i - 1];
    if (p.segment_type === "bezier") {
      const steps = 32;
      const cpArray = Array.isArray(p.control_points)
        ? p.control_points
        : p.control_points
          ? [p.control_points]
          : [];

      const cp1 = cpArray[0];
      const cp2 = cpArray[1];

      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        let x, y;
        if (cp1 && cp2) {
          x =
            Math.pow(1 - t, 3) * prev.x +
            3 * Math.pow(1 - t, 2) * t * cp1.x +
            3 * (1 - t) * Math.pow(t, 2) * cp2.x +
            Math.pow(t, 3) * p.x;
          y =
            Math.pow(1 - t, 3) * prev.y +
            3 * Math.pow(1 - t, 2) * t * cp1.y +
            3 * (1 - t) * Math.pow(t, 2) * cp2.y +
            Math.pow(t, 3) * p.y;
        } else if (cp1) {
          x =
            Math.pow(1 - t, 2) * prev.x + 2 * (1 - t) * t * cp1.x + t * t * p.x;
          y =
            Math.pow(1 - t, 2) * prev.y + 2 * (1 - t) * t * cp1.y + t * t * p.y;
        } else {
          x = prev.x + (p.x - prev.x) * t;
          y = prev.y + (p.y - prev.y) * t;
        }
        expanded.push({ x, y });
      }
    }
    expanded.push({ x: p.x, y: p.y });
  }
  return expanded;
};

const getRabbitY = (profilePoints: ProfilePoint[]) => {
  if (profilePoints.length === 0) return 0;

  const EPS = 1e-6;
  const rabbitCandidates = profilePoints.filter((p) => Math.abs(p.x) <= EPS);
  if (rabbitCandidates.length > 0) {
    return rabbitCandidates.reduce((maxY, p) => Math.max(maxY, p.y), -Infinity);
  }

  let closest = profilePoints[0];
  let closestDist = Math.abs(profilePoints[0].x);
  for (let i = 1; i < profilePoints.length; i++) {
    const dist = Math.abs(profilePoints[i].x);
    if (dist < closestDist) {
      closest = profilePoints[i];
      closestDist = dist;
    }
  }
  return closest.y;
};

const createMiteredProfileGeometry = (
  innerLength: number,
  frameWidth: number,
  frameDepth: number,
  profilePoints: ProfilePoint[],
) => {
  const geometry = new THREE.BufferGeometry();

  const expanded = expandProfilePoints(profilePoints);

  const minX = Math.min(...expanded.map((p) => p.x));
  const maxX = Math.max(...expanded.map((p) => p.x));
  const minY = Math.min(...expanded.map((p) => p.y));
  const maxY = Math.max(...expanded.map((p) => p.y));

  const scaleX = frameWidth / (maxX - minX || 1);
  const scaleY = frameDepth / (maxY - minY || 1);

  const arc: number[] = [0];
  for (let i = 1; i < expanded.length; i++) {
    const dx = (expanded[i].x - expanded[i - 1].x) * scaleX;
    const dy = (expanded[i].y - expanded[i - 1].y) * scaleY;
    arc[i] = arc[i - 1] + Math.sqrt(dx * dx + dy * dy);
  }
  const totalArc = arc[arc.length - 1] || 1;

  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const TILE_FACTOR = 2;
  const segmentMaterialIndices: number[] = [];

  for (let i = 0; i < expanded.length; i++) {
    const p = expanded[i];
    const yPos = p.x * scaleX;
    const zPos = (p.y - minY) * scaleY - frameDepth / 2;

    const currentLength = innerLength + 2 * yPos;

    vertices.push(-currentLength / 2, yPos, zPos);
    vertices.push(currentLength / 2, yPos, zPos);

    const uLeft = -currentLength / 2 / TILE_FACTOR;
    const uRight = currentLength / 2 / TILE_FACTOR;
    const v = arc[i] / totalArc;

    uvs.push(uLeft, v, uRight, v);

    if (i < expanded.length - 1) {
      const p1 = expanded[i];
      const p2 = expanded[i + 1];
      const isOuterWall =
        Math.abs(p1.x - maxX) < 0.001 && Math.abs(p2.x - maxX) < 0.001;
      segmentMaterialIndices.push(isOuterWall ? 2 : 0);
    }
  }

  let currentMatIndex = -1;
  let groupStart = 0;

  for (let i = 0; i < expanded.length - 1; i++) {
    const matIndex = segmentMaterialIndices[i];
    if (matIndex !== currentMatIndex) {
      if (currentMatIndex !== -1) {
        geometry.addGroup(
          groupStart * 6,
          (i - groupStart) * 6,
          currentMatIndex,
        );
      }
      currentMatIndex = matIndex;
      groupStart = i;
    }

    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  geometry.addGroup(
    groupStart * 6,
    (expanded.length - 1 - groupStart) * 6,
    currentMatIndex,
  );

  const shape = new THREE.Shape();
  expanded.forEach((p, i) => {
    const y = p.x * scaleX;
    const z = (p.y - minY) * scaleY - frameDepth / 2;
    if (i === 0) shape.moveTo(y, z);
    else shape.lineTo(y, z);
  });
  const capGeo = new THREE.ShapeGeometry(shape);
  const capVerts = capGeo.getAttribute("position").array;
  const capIndices = capGeo.index?.array;
  const capUVs = capGeo.getAttribute("uv").array;

  if (capIndices) {
    const capStartIdx = vertices.length / 3;
    const indicesStart = indices.length;

    for (let i = 0; i < capVerts.length; i += 3) {
      const yLocal = capVerts[i];
      const zLocal = capVerts[i + 1];
      const currentLength = innerLength + 2 * yLocal;
      vertices.push(-currentLength / 2, yLocal, zLocal);
      uvs.push(capUVs[(i / 3) * 2], capUVs[(i / 3) * 2 + 1]);
    }
    for (let i = 0; i < capIndices.length; i += 3) {
      indices.push(
        capStartIdx + capIndices[i],
        capStartIdx + capIndices[i + 2],
        capStartIdx + capIndices[i + 1],
      );
    }

    const rightCapStartIdx = vertices.length / 3;
    for (let i = 0; i < capVerts.length; i += 3) {
      const yLocal = capVerts[i];
      const zLocal = capVerts[i + 1];
      const currentLength = innerLength + 2 * yLocal;
      vertices.push(currentLength / 2, yLocal, zLocal);
      uvs.push(capUVs[(i / 3) * 2], capUVs[(i / 3) * 2 + 1]);
    }
    for (let i = 0; i < capIndices.length; i += 3) {
      indices.push(
        rightCapStartIdx + capIndices[i],
        rightCapStartIdx + capIndices[i + 1],
        rightCapStartIdx + capIndices[i + 2],
      );
    }
    geometry.addGroup(indicesStart, indices.length - indicesStart, 2);
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("uv2", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  return geometry;
};

const ProfileFrameSide = ({
  innerLength,
  frameWidth,
  frameDepth,
  textureUrl,
  sideTextureUrl,
  position,
  rotation,
  profilePoints,
  profile_normal_url,
  profile_albedo_url,
  profile_roughness_url,
  profile_ao_url,
  debug = false,
}: {
  innerLength: number;
  frameWidth: number;
  frameDepth: number;
  textureUrl: string;
  sideTextureUrl?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  profilePoints: ProfilePoint[];
  profile_normal_url?: string;
  profile_albedo_url?: string;
  profile_roughness_url?: string;
  profile_ao_url?: string;
  debug?: boolean;
}) => {
  const mapUrl = profile_albedo_url;
  const map = useTexture(
    mapUrl && mapUrl !== "" ? mapUrl : textureUrl || "/textures/edge.png",
  );

  const resolvedSide =
    sideTextureUrl && sideTextureUrl !== "" && sideTextureUrl !== "undefined"
      ? sideTextureUrl
      : "/textures/side.png";
  const sideMap = useTexture(resolvedSide);

  const nUrl = profile_normal_url;
  const normalMap = nUrl && nUrl !== "" ? useTexture(nUrl) : null;

  const rUrl = profile_roughness_url;
  const roughnessMap = rUrl && rUrl !== "" ? useTexture(rUrl) : null;

  const aoUrl = profile_ao_url;
  const aoMap = aoUrl && aoUrl !== "" ? useTexture(aoUrl) : null;

  useEffect(() => {
    [map, sideMap, normalMap, roughnessMap, aoMap].forEach((t) => {
      if (t) {
        t.anisotropy = 16;
        t.needsUpdate = true;
      }
    });
  }, [map, sideMap, normalMap, roughnessMap, aoMap]);

  const textureMaps = useMemo(() => {
    return {
      map,
      sideMap,
      normalMap,
      roughnessMap,
      aoMap,
    };
  }, [map, sideMap, normalMap, roughnessMap, aoMap]);

  const materials = useMemo(() => {
    const outerLength = innerLength + 2 * frameWidth;
    const repeatX = outerLength / (frameWidth || 1);

    Object.values(textureMaps).forEach((t) => {
      if (!t) return;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 1);
      t.anisotropy = 16;
      t.needsUpdate = true;
    });

    textureMaps.map.colorSpace = THREE.SRGBColorSpace;
    if (textureMaps.normalMap)
      textureMaps.normalMap.colorSpace = THREE.NoColorSpace;
    if (textureMaps.roughnessMap)
      textureMaps.roughnessMap.colorSpace = THREE.NoColorSpace;
    if (textureMaps.aoMap) textureMaps.aoMap.colorSpace = THREE.NoColorSpace;

    const mat = new THREE.MeshPhysicalMaterial({
      map: textureMaps.map,
      normalMap: textureMaps.normalMap || null,
      roughnessMap: textureMaps.roughnessMap || null,
      aoMap: textureMaps.aoMap || null,
      roughness: profile_roughness_url ? 1.0 : 0.5,
      metalness: 0.05,
      clearcoat: 0.2,
      clearcoatRoughness: 0.1,
      envMapIntensity: 2.0,
      aoMapIntensity: 0.7,
      normalScale: new THREE.Vector2(1.5, 1.5),
      transparent: false,
      side: THREE.DoubleSide,
    });

    const sideTexture = textureMaps.sideMap;
    sideTexture.wrapS = sideTexture.wrapT = THREE.RepeatWrapping;

    const wallMat = new THREE.MeshPhysicalMaterial({
      map: sideTexture,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    return [mat, mat, wallMat];
  }, [
    textureMaps,
    innerLength,
    frameWidth,
    profile_normal_url,
    profile_roughness_url,
    profile_ao_url,
    sideTextureUrl,
  ]);

  const geometry = useMemo(
    () =>
      createMiteredProfileGeometry(
        innerLength,
        frameWidth,
        frameDepth,
        profilePoints,
      ),
    [innerLength, frameWidth, frameDepth, profilePoints],
  );

  const debugPoints = useMemo(() => {
    const minX = Math.min(...profilePoints.map((p: ProfilePoint) => p.x));
    const maxX = Math.max(...profilePoints.map((p: ProfilePoint) => p.x));
    const minY = Math.min(...profilePoints.map((p: ProfilePoint) => p.y));
    const maxY = Math.max(...profilePoints.map((p: ProfilePoint) => p.y));

    const scaleX = frameWidth / (maxX - minX || 1);
    const scaleY = frameDepth / (maxY - minY || 1);

    return profilePoints.map(
      (p) =>
        new THREE.Vector3(
          0,
          p.x * scaleX,
          (p.y - minY) * scaleY - frameDepth / 2,
        ),
    );
  }, [profilePoints, frameWidth, frameDepth]);

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry} material={materials} castShadow receiveShadow />
      {debug && <Line points={debugPoints} color="red" lineWidth={2} />}
    </group>
  );
};

const WorkMesh = ({
  url,
  transparent = true,
}: {
  url?: string;
  transparent?: boolean;
}) => {
  const texture = useTexture(url || "/logo.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  return (
    <meshBasicMaterial
      map={texture}
      toneMapped={false}
      transparent={transparent}
      side={THREE.DoubleSide}
    />
  );
};

const HangingSystem = ({
  width,
  height,
  frameDepth,
}: {
  width: number;
  height: number;
  frameDepth: number;
}) => {
  const curve = useMemo(() => {
    const startX = -width / 2 + 1;
    const endX = width / 2 - 1;
    const peakY = width / 6;

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(startX, 0, 0),
      new THREE.Vector3(0, peakY, 0),
      new THREE.Vector3(endX, 0, 0),
    );
    return curve;
  }, [width]);

  const tubeGeo = useMemo(() => {
    return new THREE.TubeGeometry(curve, 64, 0.02, 8, false);
  }, [curve]);

  return (
    <group
      position={[0, height / 4, -frameDepth / 2 - 0.2]}
      rotation={[0, Math.PI, 0]}
    >
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial
          color="#C0C0C0"
          metalness={0.8}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group position={[-width / 2 + 1, 0, 0]} rotation={[0, 0, -Math.PI / 6]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.03, 8, 16]} />
          <meshStandardMaterial
            color="#A0A0A0"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[0.2, 0.4, 0.02]} />
          <meshStandardMaterial
            color="#A0A0A0"
            metalness={0.5}
            roughness={0.5}
          />
        </mesh>
      </group>

      <group position={[width / 2 - 1, 0, 0]} rotation={[0, 0, Math.PI / 6]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.03, 8, 16]} />
          <meshStandardMaterial
            color="#A0A0A0"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[0.2, 0.4, 0.02]} />
          <meshStandardMaterial
            color="#A0A0A0"
            metalness={0.5}
            roughness={0.5}
          />
        </mesh>
      </group>
    </group>
  );
};

export const RealFrame = (props: RealFrameProps) => {
  const {
    width = 16,
    height = 20,
    frameWidth = 3,
    frameDepth = 2,
    textureUrl = "/textures/edge.png",
    sideTextureUrl = "/textures/side.png",
    artworkUrl = "/art.png",
    backingTextureUrl = "/textures/frame-back.png",
    imageInset = 0.5,
    hasGlass = true,
    profilePoints,
    profile_normal_url,
    profile_albedo_url,
    profile_roughness_url,
    profile_ao_url,
    debug = false,
  } = props;

  const profileBounds = useMemo(() => {
    if (profilePoints.length === 0)
      return {
        width: 1,
        depth: 1,
        minX: 0,
        maxX: 1,
        minY: 0,
        maxY: 1,
        rabbitY: 0.25,
      };
    const expanded = expandProfilePoints(profilePoints);
    const xs = expanded.map((p) => p.x);
    const ys = expanded.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rabbitY = getRabbitY(profilePoints);

    return {
      width: maxX - minX || 1,
      depth: maxY - minY || 1,
      minX,
      maxX,
      minY,
      maxY,
      rabbitY,
    };
  }, [profilePoints]);

  const resolvedFrameWidth = frameWidth;
  const resolvedFrameDepth = frameDepth;

  const rabbitToOuterDist =
    profileBounds.maxX * (resolvedFrameWidth / profileBounds.width);
  const outerWidth = width;
  const outerHeight = height;

  const cleanWidth = Math.max(0.1, outerWidth - 2 * rabbitToOuterDist);
  const cleanHeight = Math.max(0.1, outerHeight - 2 * rabbitToOuterDist);

  const computedInset =
    (profileBounds.maxY - profileBounds.rabbitY) *
    (resolvedFrameDepth / profileBounds.depth);
  const cleanImageInset = imageInset !== undefined ? imageInset : computedInset;

  const topPos: [number, number, number] = [0, cleanHeight / 2, 0];
  const bottomPos: [number, number, number] = [0, -cleanHeight / 2, 0];
  const leftPos: [number, number, number] = [-cleanWidth / 2, 0, 0];
  const rightPos: [number, number, number] = [cleanWidth / 2, 0, 0];

  return (
    <group>
      <ProfileFrameSide
        innerLength={cleanWidth}
        frameWidth={resolvedFrameWidth}
        frameDepth={resolvedFrameDepth}
        textureUrl={textureUrl}
        sideTextureUrl={sideTextureUrl}
        position={topPos}
        rotation={[0, 0, 0]}
        profilePoints={profilePoints}
        profile_normal_url={profile_normal_url}
        profile_albedo_url={profile_albedo_url}
        profile_roughness_url={profile_roughness_url}
        profile_ao_url={profile_ao_url}
        debug={debug}
      />
      <ProfileFrameSide
        innerLength={cleanWidth}
        frameWidth={resolvedFrameWidth}
        frameDepth={resolvedFrameDepth}
        textureUrl={textureUrl}
        sideTextureUrl={sideTextureUrl}
        position={bottomPos}
        rotation={[0, 0, Math.PI]}
        profilePoints={profilePoints}
        profile_normal_url={profile_normal_url}
        profile_albedo_url={profile_albedo_url}
        profile_roughness_url={profile_roughness_url}
        profile_ao_url={profile_ao_url}
        debug={debug}
      />
      <ProfileFrameSide
        innerLength={cleanHeight}
        frameWidth={resolvedFrameWidth}
        frameDepth={resolvedFrameDepth}
        textureUrl={textureUrl}
        sideTextureUrl={sideTextureUrl}
        position={leftPos}
        rotation={[0, 0, Math.PI / 2]}
        profilePoints={profilePoints}
        profile_normal_url={profile_normal_url}
        profile_albedo_url={profile_albedo_url}
        profile_roughness_url={profile_roughness_url}
        profile_ao_url={profile_ao_url}
        debug={debug}
      />
      <ProfileFrameSide
        innerLength={cleanHeight}
        frameWidth={resolvedFrameWidth}
        frameDepth={resolvedFrameDepth}
        textureUrl={textureUrl}
        sideTextureUrl={sideTextureUrl}
        position={rightPos}
        rotation={[0, 0, -Math.PI / 2]}
        profilePoints={profilePoints}
        profile_normal_url={profile_normal_url}
        profile_albedo_url={profile_albedo_url}
        profile_roughness_url={profile_roughness_url}
        profile_ao_url={profile_ao_url}
        debug={debug}
      />

      <group>
        <mesh
          position={[0, 0, -resolvedFrameDepth / 2 - 0.02]}
          rotation={[0, Math.PI, 0]}
        >
          <planeGeometry args={[outerWidth, outerHeight]} />
          <WorkMesh url={backingTextureUrl} transparent={false} />
        </mesh>

        <HangingSystem
          width={cleanWidth}
          height={cleanHeight}
          frameDepth={resolvedFrameDepth}
        />

        <mesh
          position={[
            -outerWidth / 2 + 0.5,
            -outerHeight / 2 + 0.5,
            -resolvedFrameDepth / 2 - 0.02,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
        <mesh
          position={[
            outerWidth / 2 - 0.5,
            -outerHeight / 2 + 0.5,
            -resolvedFrameDepth / 2 - 0.02,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
      </group>

      <group>
        <mesh
          position={[
            0,
            0,
            resolvedFrameDepth / 2 -
              Math.max(
                0.01,
                Math.min(resolvedFrameDepth - 0.05, cleanImageInset),
              ),
          ]}
        >
          <planeGeometry args={[cleanWidth, cleanHeight]} />
          <WorkMesh url={artworkUrl} transparent={false} />
        </mesh>

        {hasGlass && (
          <mesh
            position={[
              0,
              0,
              cleanImageInset !== undefined
                ? resolvedFrameDepth / 2 - cleanImageInset + 0.05
                : resolvedFrameDepth / 4 + 0.05,
            ]}
          >
            <planeGeometry args={[cleanWidth, cleanHeight]} />
            <meshPhysicalMaterial
              roughness={0}
              clearcoat={1}
              transmission={0.9}
              thickness={0.05}
              ior={1.5}
              color="#ffffff"
              transparent
              opacity={0.15}
            />
          </mesh>
        )}
      </group>
    </group>
  );
};
