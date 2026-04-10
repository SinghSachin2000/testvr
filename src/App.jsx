import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, createPortal, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Controllers, Hands, Interactive, Ray, VRButton, XR, useXR } from '@react-three/xr'
import * as THREE from 'three'

const MODEL_PATH = '/models/taj-mahal.glb'
const SELECT_EMISSIVE = new THREE.Color('#5fb7ff')
const VR_MODEL_OFFSET = [0, 0, -12]
const XR_SESSION_OPTIONS = {
  optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
}

useGLTF.preload(MODEL_PATH)

function cloneMaterial(material) {
  if (Array.isArray(material)) {
    return material.map((entry) => entry.clone())
  }

  return material.clone()
}

function toggleMeshHighlight(mesh, active) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

  materials.forEach((material) => {
    if (!material) {
      return
    }

    if ('emissive' in material) {
      if (!material.userData.baseEmissive) {
        material.userData.baseEmissive = material.emissive.clone()
      }

      material.emissive.copy(active ? SELECT_EMISSIVE : material.userData.baseEmissive)
      material.emissiveIntensity = active ? 0.7 : 0
    }
  })
}

function App() {
  const [selectedMesh, setSelectedMesh] = useState('CentralDome')
  const [xrState, setXrState] = useState({
    controllerCount: 0,
    isHandTracking: false,
    isPresenting: false,
  })

  return (
    <>
      <VRButton sessionInit={XR_SESSION_OPTIONS} />
      <div className="hud">
        <p className="eyebrow">React Three Fiber + WebXR</p>
        <h1>Taj Mahal XR Courtyard</h1>
        <p className="lede">
          Click any mesh in desktop mode, or use controller rays in VR, to highlight individual
          Taj Mahal elements.
        </p>
        <div className="hud__meta">
          <span>Selected: {selectedMesh}</span>
          <span>{xrState.isPresenting ? 'XR session active' : 'Desktop preview active'}</span>
          <span>
            {xrState.controllerCount} controllers {xrState.isHandTracking ? 'with hands' : 'detected'}
          </span>
        </div>
      </div>
      <Canvas
        camera={{ fov: 42, position: [11, 6, 14] }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        shadows
      >
        <color attach="background" args={['#dcecff']} />
        <fog attach="fog" args={['#dcecff', 20, 52]} />
        <Suspense fallback={null}>
          <Scene onMeshSelect={setSelectedMesh} onXrStateChange={setXrState} />
        </Suspense>
      </Canvas>
    </>
  )
}

function Scene({ onMeshSelect, onXrStateChange }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#b69f7d', 0.7]} />
      <directionalLight
        castShadow
        intensity={1.8}
        position={[10, 15, 6]}
        shadow-camera-bottom={-18}
        shadow-camera-far={40}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      <spotLight angle={0.42} castShadow intensity={0.65} penumbra={0.5} position={[-10, 12, 8]} />
      <OrbitControls enablePan={false} maxDistance={24} minDistance={8} target={[0, 3.5, 0]} />
      <XR referenceSpace="local-floor">
        <SceneStatus onChange={onXrStateChange} />
        <Controllers
          hideRaysOnBlur={false}
          rayMaterial={{ color: '#3ba7ff', opacity: 0.8, transparent: true }}
        />
        <HandRays />
        <GazeRay />
        <Hands />
        <Ground />
        <ReflectingPool />
        <TajMahalModel onMeshSelect={onMeshSelect} />
      </XR>
    </>
  )
}

function SceneStatus({ onChange }) {
  const { controllers, isHandTracking, isPresenting } = useXR()

  useEffect(() => {
    onChange({
      controllerCount: controllers.length,
      isHandTracking,
      isPresenting,
    })
  }, [controllers.length, isHandTracking, isPresenting, onChange])

  return null
}

function Ground() {
  return (
    <>
      <mesh position={[0, -0.02, 0]} receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#d4c3a5" roughness={0.98} />
      </mesh>
      <mesh position={[0, 0.005, 0]} receiveShadow rotation-x={-Math.PI / 2}>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#ddcfb5" roughness={1} />
      </mesh>
    </>
  )
}

function ReflectingPool() {
  return (
    <group position={[0, 0.03, 4.7]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.08, 11.5]} />
        <meshStandardMaterial color="#71b6d8" metalness={0.08} roughness={0.16} />
      </mesh>
      <mesh castShadow position={[-2.2, 0.02, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.04, 11.8]} />
        <meshStandardMaterial color="#e9dec7" roughness={0.92} />
      </mesh>
      <mesh castShadow position={[2.2, 0.02, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.04, 11.8]} />
        <meshStandardMaterial color="#e9dec7" roughness={0.92} />
      </mesh>
    </group>
  )
}

function TajMahalModel({ onMeshSelect }) {
  const { scene } = useGLTF(MODEL_PATH)
  const { isPresenting } = useXR()
  const activeMeshRef = useRef(null)

  const clonedScene = useMemo(() => {
    let fallbackIndex = 1
    const clone = scene.clone(true)

    clone.traverse((child) => {
      if (!child.isMesh) {
        return
      }

      if (!child.name) {
        child.name = `Mesh_${fallbackIndex}`
        fallbackIndex += 1
      }

      child.castShadow = true
      child.receiveShadow = true
      child.material = cloneMaterial(child.material)
    })

    return clone
  }, [scene])

  useEffect(() => {
    const initialMesh = clonedScene.getObjectByName('CentralDome')

    if (initialMesh?.isMesh) {
      toggleMeshHighlight(initialMesh, true)
      activeMeshRef.current = initialMesh
      onMeshSelect(initialMesh.name)
    }

    return () => {
      if (activeMeshRef.current) {
        toggleMeshHighlight(activeMeshRef.current, false)
      }
    }
  }, [clonedScene, onMeshSelect])

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [])

  function selectMesh(target) {
    if (!target?.isMesh) {
      return
    }

    if (activeMeshRef.current && activeMeshRef.current !== target) {
      toggleMeshHighlight(activeMeshRef.current, false)
    }

    toggleMeshHighlight(target, true)
    activeMeshRef.current = target
    onMeshSelect(target.name)
  }

  function handleActivate(event) {
    event.stopPropagation?.()

    // R3F click events are resolved through three.js raycasting, so event.object is the hit mesh.
    const targetMesh = event.intersection?.object ?? event.object ?? event.target
    selectMesh(targetMesh)
  }

  return (
    <Interactive onSelect={handleActivate}>
      <group
        position={isPresenting ? VR_MODEL_OFFSET : [0, 0, 0]}
        onClick={handleActivate}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer'
        }}
      >
        <primitive dispose={null} object={clonedScene} />
      </group>
    </Interactive>
  )
}

function GazeRay() {
  const { controllers, isPresenting, player } = useXR()
  const lineRef = useRef(null)
  const geometryRef = useRef(null)

  useFrame(() => {
    if (!lineRef.current || !geometryRef.current) {
      return
    }

    // Only show the fallback head-based ray when in VR and no controllers are present.
    if (!isPresenting || controllers.length > 0) {
      lineRef.current.visible = false
      return
    }

    lineRef.current.visible = true

    const start = new THREE.Vector3()
    player.getWorldPosition(start)

    const end = start
      .clone()
      .add(new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion).multiplyScalar(12))

    const positions = geometryRef.current.attributes.position.array
    positions[0] = start.x
    positions[1] = start.y
    positions[2] = start.z
    positions[3] = end.x
    positions[4] = end.y
    positions[5] = end.z
    geometryRef.current.attributes.position.needsUpdate = true
  })

  return (
    <line ref={lineRef} visible={false}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" array={new Float32Array(6)} count={2} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#3ba7ff" linewidth={2} transparent opacity={0.8} />
    </line>
  )
}

// Quest hand-tracking hides default controller rays; this keeps a visible pointer tied to each hand source.
function HandRays() {
  const { controllers, isHandTracking } = useXR()

  if (!isHandTracking || controllers.length === 0) {
    return null
  }

  return controllers.map((target, i) =>
    createPortal(
      <Ray
        key={i}
        target={target}
        visible
        material-color="#3ba7ff"
        material-opacity={0.9}
        material-transparent
      />,
      target.controller
    )
  )
}

export default App
