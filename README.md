# Taj Mahal XR Demo — How It Works & How To Extend

This repo is a small React + Three.js + WebXR demo that runs in the browser (desktop and VR). Below is a concise guide to the concepts used here and how you can build a richer “lab” scene with multiple interactive objects (grab, pour, rotate, click actions, etc.).

## Stack & Key Concepts
- React + Vite for the app shell.
- react-three-fiber (R3F) to render Three.js with React components.
- @react-three/drei helpers (controls, loaders).
- @react-three/xr for WebXR session handling, controllers, hands, interaction events, and rays.
- GLB model loading via `useGLTF`.
- Interaction surfaces via `Interactive` wrapper (fires select/hover events from rays or clicks).

## How the current scene is built
File: `src/App.jsx`
- `VRButton` opens a WebXR session with `local-floor` reference space.
- `XR` wraps everything that should exist in XR; it supplies `controllers`, `player` (camera rig), and interaction state through `useXR`.
- `Controllers` draws controller rays; `Hands` renders tracked hands; a custom `GazeRay` shows a head-based pointer when no controllers exist; `HandRays` shows rays in hand-tracking mode.
- `TajMahalModel` loads `/models/taj-mahal.glb`, clones materials, enables shadows, and lets you select sub-meshes via `Interactive` onClick/onSelect.
- Camera & lights: a basic daylight rig with fog and shadow-casting.

## Running & testing
```bash
npm install
npm run dev
# open the shown localhost URL; click the “Enter VR” button in a WebXR-capable browser/headset
```

## Pattern: adding interactive lab objects
Goal: multiple objects you can grab, rotate, pour, or trigger actions.

1) **Model prep**
   - Keep each interactable as a separate mesh or named child inside the GLB (e.g., `Beaker`, `Valve`, `DoorHandle`).
   - Keep pivots sensible (rotation around the object’s center/hinge).

2) **Load & clone safely**
   - Use `useGLTF('/models/lab.glb')`.
   - When cloning, duplicate materials to avoid sharing state: similar to `cloneMaterial` used here.

3) **Attach interaction wrappers**
   - Wrap each interactive mesh in `<Interactive onSelect={...} onHover={...}>`.
   - Use `event.intersection.object` to know which mesh was hit.
   - Example:
   ```jsx
   function LabValve({ mesh, onTurn }) {
     return (
       <Interactive
         onSelect={() => onTurn(1)}          // controller/hand select or desktop click
         onHover={() => document.body.style.cursor = 'pointer'}
         onBlur={() => document.body.style.cursor = 'auto'}
       >
         <primitive object={mesh} />
       </Interactive>
     )
   }
   ```

4) **Grabbing & dragging**
   - Use `RayGrab` from `@react-three/xr` to allow picking up and moving objects.
   - Keep objects lightweight (use bounding boxes or simplified collision meshes).
   ```jsx
   import { RayGrab } from '@react-three/xr'

   function Grabbable({ mesh }) {
     return (
       <RayGrab>
         <primitive object={mesh} />
       </RayGrab>
     )
   }
   ```

5) **Pouring / continuous actions**
   - Detect tilt by reading object quaternion each frame (`useFrame`) while grabbed; when tilt passes a threshold, spawn a particle/mesh stream.
   ```jsx
   useFrame(() => {
     const up = new THREE.Vector3(0,1,0).applyQuaternion(mesh.quaternion)
     const tilt = up.angleTo(new THREE.Vector3(0,1,0))
     if (tilt > Math.PI / 4) startPour()
     else stopPour()
   })
   ```

6) **Rotating knobs/wheels**
   - Constrain rotation to one axis; update a value and drive visuals/sounds.
   - Store state in React (`useState`) and apply to mesh rotation inside `useFrame` or directly via props.

7) **Click-to-run actions (desktop & VR)**
   - `Interactive onSelect` is fired for controller trigger, hand pinch, and mouse click. Use it to toggle lights, open doors, trigger animations, or play sounds.
   - Keep actions side-effect free and idempotent where possible.

8) **Player / model positioning**
   - Use `useXR().player` to get the user rig. Offset your environment (e.g., move the GLB back) so the user spawns outside large models: `position={isPresenting ? [0,0,-12] : [0,0,0]}` as done for the Taj Mahal.

9) **Rays & affordances**
   - Controller rays are provided by `<Controllers>`; for hand-tracking, add a custom `Ray` (see `HandRays` in `App.jsx`) so users still see a pointer.
   - Optional: add hover highlights (`toggleMeshHighlight`) so users know what’s selectable.

10) **Physics (optional but common)**
    - For realistic grabbing, drop-in `@react-three/cannon` (or `rapier`) and wrap objects with physics bodies. Keep collider shapes simple (box/sphere/convex hull).

11) **Performance tips**
    - Use `draco`/`meshopt` compressed GLBs; keep draw calls low.
    - Limit shadows to important lights; avoid very high shadow map sizes.
    - Use `foveation` or lower `frameRate` if needed for mobile headsets.

12) **File organization suggestion**
    - `src/xr/controls/` for gaze/hand rays and player helpers.
    - `src/xr/interactions/` for `Interactive` wrappers (grab, pour, rotate).
    - `src/models/` for GLB loaders and material cloning.
    - `src/state/` for shared UI/logic (e.g., selected object, valve levels).

## Minimal snippet: interactive beaker you can grab & pour
```jsx
import { Interactive, RayGrab } from '@react-three/xr'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Beaker({ mesh, onPour }) {
  const ref = mesh
  useFrame(() => {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ref.quaternion)
    const tilt = up.angleTo(new THREE.Vector3(0, 1, 0))
    onPour(tilt > Math.PI / 3) // boolean pour state
  })
  return (
    <Interactive onSelect={() => onPour(true)}>
      <RayGrab>
        <primitive object={ref} />
      </RayGrab>
    </Interactive>
  )
}
```

## If you add more devices or inputs
- Desktop: clicks already work through `Interactive`.
- Controllers: `Controllers` rays + `onSelect`.
- Hands: keep `Hands` plus your `HandRays` fallback; gestures still trigger `onSelect`.
- Gaze-only: `GazeRay` shows a head pointer when no controllers are present.

## Troubleshooting checklist
- Rays missing? Ensure `Controllers` is inside `<XR>` and `hideRaysOnBlur={false}`; for hand-tracking, keep `HandRays` mounted.
- Model too close in VR? Offset the model (like `VR_MODEL_OFFSET`) or move the player rig with `player.position.set(...)` in `useEffect`.
- Click/Select not firing? Confirm the mesh is inside an `Interactive`; make sure it’s not `frustumCulled` off-screen and that it has geometry (non-zero scale).

That’s it—use this as a template to grow a fully interactive XR lab. Add more wrappers for custom logic, keep meshes named, and prefer simple, composable components for each interactive element.***
