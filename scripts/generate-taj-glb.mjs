import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const outputFile = resolve(projectRoot, 'public/models/taj-mahal.glb')

const materials = [
  {
    key: 'sandstone',
    name: 'Sandstone',
    baseColorFactor: [0.83, 0.74, 0.58, 1],
    metallicFactor: 0.04,
    roughnessFactor: 0.95,
  },
  {
    key: 'marble',
    name: 'Marble',
    baseColorFactor: [0.96, 0.95, 0.92, 1],
    metallicFactor: 0.02,
    roughnessFactor: 0.6,
  },
  {
    key: 'accent',
    name: 'Accent',
    baseColorFactor: [0.18, 0.42, 0.47, 1],
    metallicFactor: 0.08,
    roughnessFactor: 0.52,
  },
  {
    key: 'gold',
    name: 'Gold',
    baseColorFactor: [0.84, 0.69, 0.22, 1],
    metallicFactor: 0.45,
    roughnessFactor: 0.38,
  },
]

const materialIndex = new Map(materials.map((material, index) => [material.key, index]))
const parts = []

function createPart(name, material) {
  const part = { material, name, normals: [], positions: [] }
  parts.push(part)
  return part
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function addTriangle(part, a, b, c) {
  const normal = normalize(cross(subtract(b, a), subtract(c, a)))

  part.positions.push(...a, ...b, ...c)
  part.normals.push(...normal, ...normal, ...normal)
}

function addQuad(part, a, b, c, d) {
  addTriangle(part, a, b, c)
  addTriangle(part, a, c, d)
}

function addBox(part, { center, depth, height, width }) {
  const [cx, cy, cz] = center
  const hx = width / 2
  const hy = height / 2
  const hz = depth / 2

  const v000 = [cx - hx, cy - hy, cz - hz]
  const v001 = [cx - hx, cy - hy, cz + hz]
  const v010 = [cx - hx, cy + hy, cz - hz]
  const v011 = [cx - hx, cy + hy, cz + hz]
  const v100 = [cx + hx, cy - hy, cz - hz]
  const v101 = [cx + hx, cy - hy, cz + hz]
  const v110 = [cx + hx, cy + hy, cz - hz]
  const v111 = [cx + hx, cy + hy, cz + hz]

  addQuad(part, v100, v110, v111, v101)
  addQuad(part, v000, v001, v011, v010)
  addQuad(part, v010, v011, v111, v110)
  addQuad(part, v000, v100, v101, v001)
  addQuad(part, v001, v101, v111, v011)
  addQuad(part, v000, v010, v110, v100)
}

function addCylinder(
  part,
  {
    capBottom = true,
    capTop = true,
    center,
    height,
    radialSegments = 20,
    radiusBottom,
    radiusTop,
  },
) {
  const [cx, cy, cz] = center
  const bottomY = cy - height / 2
  const topY = cy + height / 2

  for (let index = 0; index < radialSegments; index += 1) {
    const start = (index / radialSegments) * Math.PI * 2
    const end = ((index + 1) / radialSegments) * Math.PI * 2

    const bottomStart = [
      cx + Math.cos(start) * radiusBottom,
      bottomY,
      cz + Math.sin(start) * radiusBottom,
    ]
    const bottomEnd = [cx + Math.cos(end) * radiusBottom, bottomY, cz + Math.sin(end) * radiusBottom]
    const topStart = [cx + Math.cos(start) * radiusTop, topY, cz + Math.sin(start) * radiusTop]
    const topEnd = [cx + Math.cos(end) * radiusTop, topY, cz + Math.sin(end) * radiusTop]

    addQuad(part, bottomStart, bottomEnd, topEnd, topStart)

    if (capTop && radiusTop > 0) {
      addTriangle(part, [cx, topY, cz], topEnd, topStart)
    }

    if (capBottom && radiusBottom > 0) {
      addTriangle(part, [cx, bottomY, cz], bottomStart, bottomEnd)
    }
  }
}

function addDome(part, { baseY, centerX, centerZ, radialSegments = 24, radius, rings = 12, scaleY = 1.2 }) {
  const ringsData = []

  for (let ring = 0; ring <= rings; ring += 1) {
    const theta = (ring / rings) * (Math.PI / 2)
    const ringRadius = Math.sin(theta) * radius
    const y = baseY + Math.cos(theta) * radius * scaleY
    const points = []

    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2
      points.push([centerX + Math.cos(angle) * ringRadius, y, centerZ + Math.sin(angle) * ringRadius])
    }

    ringsData.push(points)
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const currentRing = ringsData[ring]
      const nextRing = ringsData[ring + 1]

      const a = currentRing[segment]
      const b = currentRing[segment + 1]
      const c = nextRing[segment + 1]
      const d = nextRing[segment]

      if (ring === 0) {
        addTriangle(part, a, c, d)
      } else {
        addQuad(part, a, b, c, d)
      }
    }
  }
}

function addMinaret(part, x, z) {
  addCylinder(part, {
    center: [x, 3.35, z],
    height: 5.9,
    radialSegments: 18,
    radiusBottom: 0.24,
    radiusTop: 0.2,
  })
  addCylinder(part, {
    center: [x, 5.78, z],
    height: 0.16,
    radialSegments: 18,
    radiusBottom: 0.4,
    radiusTop: 0.38,
  })
  addCylinder(part, {
    center: [x, 6.3, z],
    height: 0.42,
    radialSegments: 18,
    radiusBottom: 0.3,
    radiusTop: 0.28,
  })
  addDome(part, {
    baseY: 6.5,
    centerX: x,
    centerZ: z,
    radialSegments: 18,
    radius: 0.38,
    rings: 8,
    scaleY: 1.2,
  })
}

function addRoofPavilion(part, x, z) {
  addCylinder(part, {
    center: [x, 5.22, z],
    height: 0.65,
    radialSegments: 16,
    radiusBottom: 0.42,
    radiusTop: 0.36,
  })
  addDome(part, {
    baseY: 5.53,
    centerX: x,
    centerZ: z,
    radialSegments: 16,
    radius: 0.54,
    rings: 7,
    scaleY: 1.18,
  })
}

function addFinial(part, x, y, z, height) {
  addCylinder(part, {
    center: [x, y + height * 0.28, z],
    height: height * 0.56,
    radialSegments: 10,
    radiusBottom: 0.06,
    radiusTop: 0.045,
  })
  addCylinder(part, {
    center: [x, y + height * 0.72, z],
    height: height * 0.34,
    radialSegments: 10,
    radiusBottom: 0.04,
    radiusTop: 0.0,
  })
}

function buildTaj() {
  const plinth = createPart('Plinth', 'sandstone')
  addBox(plinth, { center: [0, 0.35, 0], depth: 13.2, height: 0.7, width: 13.2 })

  const terrace = createPart('Terrace', 'marble')
  addBox(terrace, { center: [0, 0.93, 0], depth: 10.8, height: 0.46, width: 10.8 })

  const mausoleum = createPart('Mausoleum', 'marble')
  addBox(mausoleum, { center: [0, 2.95, 0], depth: 5.6, height: 3.6, width: 5.6 })

  const frontIwan = createPart('FrontIwan', 'marble')
  addBox(frontIwan, { center: [0, 2.95, 3.13], depth: 0.72, height: 2.85, width: 2.35 })

  const backIwan = createPart('BackIwan', 'marble')
  addBox(backIwan, { center: [0, 2.95, -3.13], depth: 0.72, height: 2.85, width: 2.35 })

  const eastIwan = createPart('EastIwan', 'marble')
  addBox(eastIwan, { center: [3.13, 2.95, 0], depth: 2.35, height: 2.85, width: 0.72 })

  const westIwan = createPart('WestIwan', 'marble')
  addBox(westIwan, { center: [-3.13, 2.95, 0], depth: 2.35, height: 2.85, width: 0.72 })

  const frontDoor = createPart('FrontDoor', 'accent')
  addBox(frontDoor, { center: [0, 2.2, 3.52], depth: 0.12, height: 1.6, width: 1.05 })

  const backDoor = createPart('BackDoor', 'accent')
  addBox(backDoor, { center: [0, 2.2, -3.52], depth: 0.12, height: 1.6, width: 1.05 })

  const eastDoor = createPart('EastDoor', 'accent')
  addBox(eastDoor, { center: [3.52, 2.2, 0], depth: 1.05, height: 1.6, width: 0.12 })

  const westDoor = createPart('WestDoor', 'accent')
  addBox(westDoor, { center: [-3.52, 2.2, 0], depth: 1.05, height: 1.6, width: 0.12 })

  const domeDrum = createPart('DomeDrum', 'marble')
  addCylinder(domeDrum, {
    center: [0, 5.08, 0],
    height: 0.64,
    radialSegments: 24,
    radiusBottom: 1.82,
    radiusTop: 1.82,
  })

  const centralDome = createPart('CentralDome', 'marble')
  addDome(centralDome, {
    baseY: 5.4,
    centerX: 0,
    centerZ: 0,
    radialSegments: 24,
    radius: 2.06,
    rings: 12,
    scaleY: 1.3,
  })

  const roofPavilions = [
    ['RoofPavilionNE', 2.16, 2.16],
    ['RoofPavilionNW', -2.16, 2.16],
    ['RoofPavilionSE', 2.16, -2.16],
    ['RoofPavilionSW', -2.16, -2.16],
  ]

  roofPavilions.forEach(([name, x, z]) => {
    const pavilion = createPart(name, 'marble')
    addRoofPavilion(pavilion, x, z)
  })

  const minarets = [
    ['MinaretNE', 5.05, 5.05],
    ['MinaretNW', -5.05, 5.05],
    ['MinaretSE', 5.05, -5.05],
    ['MinaretSW', -5.05, -5.05],
  ]

  minarets.forEach(([name, x, z]) => {
    const minaret = createPart(name, 'marble')
    addMinaret(minaret, x, z)
  })

  const finials = createPart('Finials', 'gold')
  addFinial(finials, 0, 7.95, 0, 1.0)
  addFinial(finials, 2.16, 6.15, 2.16, 0.48)
  addFinial(finials, -2.16, 6.15, 2.16, 0.48)
  addFinial(finials, 2.16, 6.15, -2.16, 0.48)
  addFinial(finials, -2.16, 6.15, -2.16, 0.48)
  addFinial(finials, 5.05, 6.94, 5.05, 0.5)
  addFinial(finials, -5.05, 6.94, 5.05, 0.5)
  addFinial(finials, 5.05, 6.94, -5.05, 0.5)
  addFinial(finials, -5.05, 6.94, -5.05, 0.5)
}

function padChunk(buffer, padValue) {
  const remainder = buffer.length % 4

  if (remainder === 0) {
    return buffer
  }

  return Buffer.concat([buffer, Buffer.alloc(4 - remainder, padValue)])
}

function addBinarySection(state, typedArray, { componentType, target, type }) {
  const buffer = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
  const alignedOffset = (state.binaryLength + 3) & ~3

  if (alignedOffset !== state.binaryLength) {
    state.binaryChunks.push(Buffer.alloc(alignedOffset - state.binaryLength))
    state.binaryLength = alignedOffset
  }

  const bufferViewIndex = state.bufferViews.length
  state.bufferViews.push({
    buffer: 0,
    byteLength: buffer.length,
    byteOffset: alignedOffset,
    target,
  })
  state.binaryChunks.push(buffer)
  state.binaryLength += buffer.length

  const accessor = {
    bufferView: bufferViewIndex,
    componentType,
    count: typedArray.length / (type === 'VEC3' ? 3 : 1),
    type,
  }

  if (type === 'VEC3') {
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]

    for (let index = 0; index < typedArray.length; index += 3) {
      min[0] = Math.min(min[0], typedArray[index])
      min[1] = Math.min(min[1], typedArray[index + 1])
      min[2] = Math.min(min[2], typedArray[index + 2])
      max[0] = Math.max(max[0], typedArray[index])
      max[1] = Math.max(max[1], typedArray[index + 1])
      max[2] = Math.max(max[2], typedArray[index + 2])
    }

    accessor.min = min
    accessor.max = max
  }

  const accessorIndex = state.accessors.length
  state.accessors.push(accessor)
  return accessorIndex
}

function buildGlb() {
  const state = {
    accessors: [],
    binaryChunks: [],
    binaryLength: 0,
    bufferViews: [],
  }

  const meshes = []
  const nodes = []

  parts.forEach((part) => {
    const positionAccessor = addBinarySection(state, new Float32Array(part.positions), {
      componentType: 5126,
      target: 34962,
      type: 'VEC3',
    })
    const normalAccessor = addBinarySection(state, new Float32Array(part.normals), {
      componentType: 5126,
      target: 34962,
      type: 'VEC3',
    })
    const meshIndex = meshes.length

    meshes.push({
      name: part.name,
      primitives: [
        {
          attributes: {
            NORMAL: normalAccessor,
            POSITION: positionAccessor,
          },
          material: materialIndex.get(part.material),
        },
      ],
    })

    nodes.push({
      mesh: meshIndex,
      name: part.name,
    })
  })

  const binaryBuffer = padChunk(Buffer.concat(state.binaryChunks), 0)
  const json = {
    accessors: state.accessors,
    asset: {
      generator: 'codex taj mahal glb generator',
      version: '2.0',
    },
    bufferViews: state.bufferViews,
    buffers: [{ byteLength: binaryBuffer.length }],
    materials: materials.map(({ key, name, ...pbrMetallicRoughness }) => ({
      name,
      pbrMetallicRoughness,
    })),
    meshes,
    nodes,
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
  }

  const jsonBuffer = padChunk(Buffer.from(JSON.stringify(json), 'utf8'), 0x20)
  const header = Buffer.alloc(12)
  const jsonHeader = Buffer.alloc(8)
  const binHeader = Buffer.alloc(8)
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binaryBuffer.length

  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(totalLength, 8)

  jsonHeader.writeUInt32LE(jsonBuffer.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)

  binHeader.writeUInt32LE(binaryBuffer.length, 0)
  binHeader.writeUInt32LE(0x004e4942, 4)

  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binaryBuffer])
}

buildTaj()
mkdirSync(dirname(outputFile), { recursive: true })
const glb = buildGlb()
writeFileSync(outputFile, glb)

console.log(`Generated ${outputFile}`)
console.log(`Meshes: ${parts.length}`)
console.log(`Bytes: ${glb.length}`)
