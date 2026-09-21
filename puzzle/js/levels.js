/**
 * Cyber Circuit: Mainframe Breach — Level Data & Procedural Level Generator
 */

const COLOR_DEFS = {
  1: { id: 1, name: 'CYAN', hex: '#00f0ff', glow: 'rgba(0, 240, 255, 0.65)', freq: 523.25 }, // C5
  2: { id: 2, name: 'PINK', hex: '#ff0077', glow: 'rgba(255, 0, 119, 0.65)', freq: 587.33 }, // D5
  3: { id: 3, name: 'GOLD', hex: '#ffcc00', glow: 'rgba(255, 204, 0, 0.65)', freq: 659.25 }, // E5
  4: { id: 4, name: 'LIME', hex: '#00ff66', glow: 'rgba(0, 255, 102, 0.65)', freq: 783.99 }, // G5
  5: { id: 5, name: 'PURPLE', hex: '#b55fe6', glow: 'rgba(181, 95, 230, 0.65)', freq: 880.00 }, // A5
  6: { id: 6, name: 'ORANGE', hex: '#ff6600', glow: 'rgba(255, 102, 0, 0.65)', freq: 987.77 }, // B5
  7: { id: 7, name: 'BLUE', hex: '#2979ff', glow: 'rgba(41, 121, 255, 0.65)', freq: 1046.50 }, // C6
  8: { id: 8, name: 'RED', hex: '#ff1744', glow: 'rgba(255, 23, 68, 0.65)', freq: 1174.66 }  // D6
};

// 30 Progressive Curated Levels (Increasing grid size & difficulty)
const CURATED_LEVELS = [
  // ── Tier 1: System Boot (4x4 Grid - Warmup) ──
  {
    id: 1,
    name: 'Signal Handshake',
    tier: 'Tier 1: Junior Hacker',
    size: 4,
    pairs: [
      { color: 1, p1: [0, 0], p2: [2, 0] },
      { color: 2, p1: [0, 3], p2: [3, 2] },
      { color: 3, p1: [1, 1], p2: [2, 3] }
    ],
    blockers: [],
    optimalMoves: 3
  },
  {
    id: 2,
    name: 'Buffer Flush',
    tier: 'Tier 1: Junior Hacker',
    size: 4,
    pairs: [
      { color: 1, p1: [0, 0], p2: [0, 2] },
      { color: 2, p1: [1, 0], p2: [1, 3] },
      { color: 3, p1: [3, 0], p2: [3, 3] },
      { color: 4, p1: [2, 1], p2: [2, 2] }
    ],
    blockers: [],
    optimalMoves: 4
  },
  {
    id: 3,
    name: 'Kernel Probe',
    tier: 'Tier 1: Junior Hacker',
    size: 4,
    pairs: [
      { color: 1, p1: [0, 1], p2: [2, 0] },
      { color: 2, p1: [0, 3], p2: [3, 1] },
      { color: 3, p1: [1, 3], p2: [3, 3] }
    ],
    blockers: [],
    optimalMoves: 3
  },
  {
    id: 4,
    name: 'Port Scanner',
    tier: 'Tier 1: Junior Hacker',
    size: 4,
    pairs: [
      { color: 1, p1: [0, 0], p2: [3, 3] },
      { color: 2, p1: [1, 0], p2: [2, 3] },
      { color: 3, p1: [2, 0], p2: [3, 1] },
      { color: 4, p1: [0, 1], p2: [0, 3] }
    ],
    blockers: [],
    optimalMoves: 4
  },
  {
    id: 5,
    name: 'Gateway Bypass',
    tier: 'Tier 1: Junior Hacker',
    size: 4,
    pairs: [
      { color: 1, p1: [0, 0], p2: [3, 0] },
      { color: 2, p1: [0, 1], p2: [1, 3] },
      { color: 3, p1: [1, 1], p2: [3, 2] },
      { color: 4, p1: [2, 2], p2: [3, 3] }
    ],
    blockers: [],
    optimalMoves: 4
  },

  // ── Tier 2: Cyber Infiltration (5x5 Grid + Firewalls) ──
  {
    id: 6,
    name: 'Firewall Breach',
    tier: 'Tier 2: Infiltrator',
    size: 5,
    pairs: [
      { color: 1, p1: [0, 0], p2: [4, 0] },
      { color: 2, p1: [0, 1], p2: [3, 4] },
      { color: 3, p1: [1, 2], p2: [4, 2] },
      { color: 4, p1: [0, 4], p2: [4, 4] }
    ],
    blockers: [[2, 2]],
    optimalMoves: 4
  },
  {
    id: 7,
    name: 'Decryption Loop',
    tier: 'Tier 2: Infiltrator',
    size: 5,
    pairs: [
      { color: 1, p1: [0, 0], p2: [3, 1] },
      { color: 2, p1: [0, 4], p2: [2, 2] },
      { color: 3, p1: [1, 0], p2: [4, 3] },
      { color: 4, p1: [1, 4], p2: [4, 4] }
    ],
    blockers: [],
    optimalMoves: 4
  },
  {
    id: 8,
    name: 'Subnet Mask',
    tier: 'Tier 2: Infiltrator',
    size: 5,
    pairs: [
      { color: 1, p1: [0, 0], p2: [1, 4] },
      { color: 2, p1: [1, 1], p2: [4, 1] },
      { color: 3, p1: [2, 3], p2: [4, 4] },
      { color: 4, p1: [3, 2], p2: [4, 3] },
      { color: 5, p1: [0, 2], p2: [3, 0] }
    ],
    blockers: [],
    optimalMoves: 5
  },
  {
    id: 9,
    name: 'Cipher Leak',
    tier: 'Tier 2: Infiltrator',
    size: 5,
    pairs: [
      { color: 1, p1: [0, 1], p2: [4, 1] },
      { color: 2, p1: [0, 3], p2: [4, 3] },
      { color: 3, p1: [1, 0], p2: [1, 4] },
      { color: 4, p1: [3, 0], p2: [3, 4] },
      { color: 5, p1: [2, 2], p2: [4, 2] }
    ],
    blockers: [[2, 0], [2, 4]],
    optimalMoves: 5
  },
  {
    id: 10,
    name: 'Zero-Day Trace',
    tier: 'Tier 2: Infiltrator',
    size: 5,
    pairs: [
      { color: 1, p1: [0, 0], p2: [4, 4] },
      { color: 2, p1: [0, 2], p2: [2, 0] },
      { color: 3, p1: [1, 4], p2: [3, 2] },
      { color: 4, p1: [2, 4], p2: [4, 1] },
      { color: 5, p1: [3, 0], p2: [4, 3] }
    ],
    blockers: [],
    optimalMoves: 5
  },
  {
    id: 11,
    name: 'Proxy Cascade',
    tier: 'Tier 2: Infiltrator',
    size: 5,
    pairs: [
      { color: 1, p1: [0, 0], p2: [4, 0] },
      { color: 2, p1: [0, 4], p2: [4, 4] },
      { color: 3, p1: [1, 1], p2: [3, 3] },
      { color: 4, p1: [1, 3], p2: [3, 1] }
    ],
    blockers: [[2, 2]],
    optimalMoves: 4
  },
  {
    id: 12,
    name: 'Packet Storm',
    tier: 'Tier 2: Infiltrator',
    size: 5,
    pairs: [
      { color: 1, p1: [0, 1], p2: [3, 0] },
      { color: 2, p1: [0, 3], p2: [2, 4] },
      { color: 3, p1: [1, 2], p2: [4, 2] },
      { color: 4, p1: [2, 0], p2: [4, 4] },
      { color: 5, p1: [1, 0], p2: [4, 0] }
    ],
    blockers: [],
    optimalMoves: 5
  },

  // ── Tier 3: Security Specialist (6x6 Grid) ──
  {
    id: 13,
    name: 'Neural Node',
    tier: 'Tier 3: Security Specialist',
    size: 6,
    pairs: [
      { color: 1, p1: [0, 0], p2: [5, 0] },
      { color: 2, p1: [0, 1], p2: [2, 5] },
      { color: 3, p1: [0, 5], p2: [5, 5] },
      { color: 4, p1: [1, 2], p2: [4, 2] },
      { color: 5, p1: [3, 3], p2: [5, 3] }
    ],
    blockers: [[2, 2], [3, 2]],
    optimalMoves: 5
  },
  {
    id: 14,
    name: 'Dark Fiber',
    tier: 'Tier 3: Security Specialist',
    size: 6,
    pairs: [
      { color: 1, p1: [0, 0], p2: [0, 4] },
      { color: 2, p1: [1, 0], p2: [3, 5] },
      { color: 3, p1: [2, 1], p2: [5, 1] },
      { color: 4, p1: [3, 0], p2: [5, 4] },
      { color: 5, p1: [1, 5], p2: [4, 3] },
      { color: 6, p1: [4, 0], p2: [5, 5] }
    ],
    blockers: [],
    optimalMoves: 6
  },
  {
    id: 15,
    name: 'Logic Gate Relay',
    tier: 'Tier 3: Security Specialist',
    size: 6,
    pairs: [
      { color: 1, p1: [0, 2], p2: [4, 1] },
      { color: 2, p1: [0, 4], p2: [3, 5] },
      { color: 3, p1: [1, 0], p2: [5, 3] },
      { color: 4, p1: [2, 2], p2: [4, 4] },
      { color: 5, p1: [3, 1], p2: [5, 5] }
    ],
    blockers: [[1, 3], [4, 2]],
    optimalMoves: 5
  },
  {
    id: 16,
    name: 'Hash Collision',
    tier: 'Tier 3: Security Specialist',
    size: 6,
    pairs: [
      { color: 1, p1: [0, 1], p2: [5, 1] },
      { color: 2, p1: [0, 3], p2: [5, 3] },
      { color: 3, p1: [1, 0], p2: [4, 5] },
      { color: 4, p1: [1, 5], p2: [4, 0] },
      { color: 5, p1: [2, 2], p2: [3, 3] },
      { color: 6, p1: [0, 5], p2: [5, 5] }
    ],
    blockers: [],
    optimalMoves: 6
  },
  {
    id: 17,
    name: 'Data Pipeline',
    tier: 'Tier 3: Security Specialist',
    size: 6,
    pairs: [
      { color: 1, p1: [0, 0], p2: [3, 0] },
      { color: 2, p1: [0, 5], p2: [3, 5] },
      { color: 3, p1: [1, 2], p2: [5, 2] },
      { color: 4, p1: [1, 4], p2: [5, 4] },
      { color: 5, p1: [4, 0], p2: [5, 5] },
      { color: 6, p1: [2, 1], p2: [4, 3] }
    ],
    blockers: [[2, 3]],
    optimalMoves: 6
  },
  {
    id: 18,
    name: 'Ghost Cluster',
    tier: 'Tier 3: Security Specialist',
    size: 6,
    pairs: [
      { color: 1, p1: [0, 2], p2: [5, 0] },
      { color: 2, p1: [0, 4], p2: [3, 2] },
      { color: 3, p1: [1, 0], p2: [4, 4] },
      { color: 4, p1: [2, 5], p2: [5, 3] },
      { color: 5, p1: [3, 4], p2: [5, 5] }
    ],
    blockers: [[1, 2]],
    optimalMoves: 5
  },
  {
    id: 19,
    name: 'Quantum Entanglement',
    tier: 'Tier 3: Security Specialist',
    size: 6,
    pairs: [
      { color: 1, p1: [0, 0], p2: [5, 5] },
      { color: 2, p1: [0, 5], p2: [5, 0] },
      { color: 3, p1: [1, 2], p2: [4, 3] },
      { color: 4, p1: [1, 3], p2: [4, 2] },
      { color: 5, p1: [2, 0], p2: [3, 5] },
      { color: 6, p1: [0, 3], p2: [5, 2] }
    ],
    blockers: [],
    optimalMoves: 6
  },
  {
    id: 20,
    name: 'Rootkit Containment',
    tier: 'Tier 3: Security Specialist',
    size: 6,
    pairs: [
      { color: 1, p1: [0, 1], p2: [3, 1] },
      { color: 2, p1: [0, 3], p2: [4, 3] },
      { color: 3, p1: [1, 5], p2: [5, 1] },
      { color: 4, p1: [2, 0], p2: [5, 4] },
      { color: 5, p1: [2, 2], p2: [4, 5] },
      { color: 6, p1: [3, 4], p2: [5, 5] }
    ],
    blockers: [[1, 2], [3, 3]],
    optimalMoves: 6
  },

  // ── Tier 4: Master Cryptographer (7x7 & 8x8 Grid) ──
  {
    id: 21,
    name: 'Mainframe Core',
    tier: 'Tier 4: Master Cryptographer',
    size: 7,
    pairs: [
      { color: 1, p1: [0, 0], p2: [6, 0] },
      { color: 2, p1: [0, 6], p2: [6, 6] },
      { color: 3, p1: [1, 2], p2: [5, 2] },
      { color: 4, p1: [1, 4], p2: [5, 4] },
      { color: 5, p1: [2, 1], p2: [4, 5] },
      { color: 6, p1: [0, 3], p2: [6, 3] }
    ],
    blockers: [[3, 3]],
    optimalMoves: 6
  },
  {
    id: 22,
    name: 'Cyber Citadel',
    tier: 'Tier 4: Master Cryptographer',
    size: 7,
    pairs: [
      { color: 1, p1: [0, 1], p2: [6, 1] },
      { color: 2, p1: [0, 5], p2: [6, 5] },
      { color: 3, p1: [1, 0], p2: [4, 6] },
      { color: 4, p1: [2, 3], p2: [5, 3] },
      { color: 5, p1: [3, 0], p2: [5, 6] },
      { color: 6, p1: [1, 4], p2: [4, 2] },
      { color: 7, p1: [0, 3], p2: [6, 3] }
    ],
    blockers: [],
    optimalMoves: 7
  },
  {
    id: 23,
    name: 'Deep Web Node',
    tier: 'Tier 4: Master Cryptographer',
    size: 7,
    pairs: [
      { color: 1, p1: [0, 0], p2: [4, 2] },
      { color: 2, p1: [0, 4], p2: [6, 2] },
      { color: 3, p1: [1, 6], p2: [5, 0] },
      { color: 4, p1: [2, 1], p2: [6, 5] },
      { color: 5, p1: [3, 4], p2: [5, 6] },
      { color: 6, p1: [4, 5], p2: [6, 6] }
    ],
    blockers: [[2, 3], [4, 3]],
    optimalMoves: 6
  },
  {
    id: 24,
    name: 'Titanium Vault',
    tier: 'Tier 4: Master Cryptographer',
    size: 7,
    pairs: [
      { color: 1, p1: [0, 2], p2: [5, 1] },
      { color: 2, p1: [0, 5], p2: [6, 4] },
      { color: 3, p1: [1, 1], p2: [4, 6] },
      { color: 4, p1: [2, 4], p2: [6, 1] },
      { color: 5, p1: [3, 0], p2: [5, 5] },
      { color: 6, p1: [4, 2], p2: [6, 6] },
      { color: 7, p1: [1, 3], p2: [3, 5] }
    ],
    blockers: [[3, 3]],
    optimalMoves: 7
  },
  {
    id: 25,
    name: 'Hyper-Threading',
    tier: 'Tier 4: Master Cryptographer',
    size: 7,
    pairs: [
      { color: 1, p1: [0, 0], p2: [6, 6] },
      { color: 2, p1: [0, 6], p2: [6, 0] },
      { color: 3, p1: [1, 3], p2: [5, 3] },
      { color: 4, p1: [2, 1], p2: [4, 5] },
      { color: 5, p1: [2, 5], p2: [4, 1] },
      { color: 6, p1: [3, 0], p2: [3, 6] },
      { color: 7, p1: [0, 3], p2: [6, 3] }
    ],
    blockers: [],
    optimalMoves: 7
  },
  {
    id: 26,
    name: 'Synapse Overclock',
    tier: 'Tier 4: Master Cryptographer',
    size: 8,
    pairs: [
      { color: 1, p1: [0, 0], p2: [7, 0] },
      { color: 2, p1: [0, 7], p2: [7, 7] },
      { color: 3, p1: [1, 2], p2: [6, 2] },
      { color: 4, p1: [1, 5], p2: [6, 5] },
      { color: 5, p1: [2, 0], p2: [5, 7] },
      { color: 6, p1: [3, 3], p2: [4, 4] }
    ],
    blockers: [[2, 3], [2, 4], [5, 3], [5, 4]],
    optimalMoves: 6
  },
  {
    id: 27,
    name: 'Singularity Grid',
    tier: 'Tier 4: Master Cryptographer',
    size: 8,
    pairs: [
      { color: 1, p1: [0, 1], p2: [7, 1] },
      { color: 2, p1: [0, 6], p2: [7, 6] },
      { color: 3, p1: [1, 0], p2: [6, 7] },
      { color: 4, p1: [2, 3], p2: [5, 4] },
      { color: 5, p1: [3, 1], p2: [4, 6] },
      { color: 6, p1: [1, 5], p2: [6, 2] },
      { color: 7, p1: [0, 3], p2: [7, 4] }
    ],
    blockers: [],
    optimalMoves: 7
  },
  {
    id: 28,
    name: 'Dark Matter Matrix',
    tier: 'Tier 4: Master Cryptographer',
    size: 8,
    pairs: [
      { color: 1, p1: [0, 0], p2: [7, 2] },
      { color: 2, p1: [0, 4], p2: [5, 0] },
      { color: 3, p1: [1, 7], p2: [7, 5] },
      { color: 4, p1: [2, 2], p2: [6, 6] },
      { color: 5, p1: [3, 5], p2: [7, 7] },
      { color: 6, p1: [4, 1], p2: [6, 3] },
      { color: 7, p1: [2, 6], p2: [4, 4] },
      { color: 8, p1: [1, 3], p2: [5, 5] }
    ],
    blockers: [],
    optimalMoves: 8
  },
  {
    id: 29,
    name: 'Quantum Supercomputer',
    tier: 'Tier 4: Master Cryptographer',
    size: 8,
    pairs: [
      { color: 1, p1: [0, 2], p2: [7, 1] },
      { color: 2, p1: [0, 5], p2: [7, 6] },
      { color: 3, p1: [1, 0], p2: [6, 0] },
      { color: 4, p1: [1, 7], p2: [6, 7] },
      { color: 5, p1: [2, 3], p2: [5, 4] },
      { color: 6, p1: [3, 1], p2: [5, 6] },
      { color: 7, p1: [2, 5], p2: [4, 2] }
    ],
    blockers: [[3, 3], [4, 4]],
    optimalMoves: 7
  },
  {
    id: 30,
    name: 'THE OMEGA MAINFRAME',
    tier: 'Tier 4: Master Cryptographer',
    size: 8,
    pairs: [
      { color: 1, p1: [0, 0], p2: [7, 7] },
      { color: 2, p1: [0, 7], p2: [7, 0] },
      { color: 3, p1: [1, 2], p2: [6, 5] },
      { color: 4, p1: [1, 5], p2: [6, 2] },
      { color: 5, p1: [2, 0], p2: [5, 7] },
      { color: 6, p1: [2, 7], p2: [5, 0] },
      { color: 7, p1: [0, 3], p2: [7, 4] },
      { color: 8, p1: [3, 2], p2: [4, 5] }
    ],
    blockers: [[3, 3], [4, 4]],
    optimalMoves: 8
  }
];

/**
 * Procedural Solvable Level Generator (for Endless Mode)
 */
class ProceduralLevelGenerator {
  static generate(levelNumber = 31) {
    let size = 4;
    let numColors = 3;
    if (levelNumber > 10) { size = 5; numColors = 4; }
    if (levelNumber > 25) { size = 6; numColors = 5; }
    if (levelNumber > 50) { size = 7; numColors = 6; }
    if (levelNumber > 100) { size = 8; numColors = 7; }

    const grid = Array.from({ length: size }, () => Array(size).fill(0));
    const pairs = [];
    const availableColors = [1, 2, 3, 4, 5, 6, 7, 8].slice(0, numColors);

    const unvisited = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) unvisited.push([r, c]);
    }

    for (const color of availableColors) {
      if (unvisited.length < 2) break;
      const startIdx = Math.floor(Math.random() * unvisited.length);
      const start = unvisited.splice(startIdx, 1)[0];

      const path = [start];
      grid[start[0]][start[1]] = color;

      const pathLen = Math.floor(Math.random() * 3) + 3;
      let curr = start;

      for (let step = 0; step < pathLen; step++) {
        const neighbors = [
          [curr[0] - 1, curr[0] ? curr[1] : 0], // temp
          [curr[0] - 1, curr[1]],
          [curr[0] + 1, curr[1]],
          [curr[0], curr[1] - 1],
          [curr[0], curr[1] + 1]
        ].filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size && grid[r][c] === 0);

        if (!neighbors.length) break;
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        grid[next[0]][next[1]] = color;
        path.push(next);
        const uIdx = unvisited.findIndex(([r, c]) => r === next[0] && c === next[1]);
        if (uIdx !== -1) unvisited.splice(uIdx, 1);
        curr = next;
      }

      if (path.length >= 2) {
        pairs.push({
          color,
          p1: path[0],
          p2: path[path.length - 1],
          solutionPath: path
        });
      }
    }

    const blockers = unvisited.filter(() => Math.random() < 0.5);

    return {
      id: levelNumber,
      name: `Sector #${levelNumber}`,
      tier: 'Endless Protocol',
      size,
      pairs: pairs.length >= 2 ? pairs : CURATED_LEVELS[(levelNumber % CURATED_LEVELS.length)].pairs,
      blockers,
      optimalMoves: pairs.length,
      isProcedural: true
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COLOR_DEFS, CURATED_LEVELS, ProceduralLevelGenerator };
}
