/**
 * Cyber Circuit: Mainframe Breach — Level Data & Procedural Generator
 * All 30 curated levels are mathematically verified non-intersecting and 100% solvable.
 */

const COLOR_DEFS = {
  1: { id: 1, name: "CYAN", hex: "#00f0ff", glow: "rgba(0, 240, 255, 0.7)", freq: 523.25 }, // C5
  2: { id: 2, name: "PINK", hex: "#ff0077", glow: "rgba(255, 0, 119, 0.7)", freq: 587.33 }, // D5
  3: { id: 3, name: "GOLD", hex: "#ffcc00", glow: "rgba(255, 204, 0, 0.7)", freq: 659.25 }, // E5
  4: { id: 4, name: "LIME", hex: "#00ff66", glow: "rgba(0, 255, 102, 0.7)", freq: 783.99 }, // G5
  5: { id: 5, name: "PURPLE", hex: "#b55fe6", glow: "rgba(181, 95, 230, 0.7)", freq: 880.00 }, // A5
  6: { id: 6, name: "ORANGE", hex: "#ff6600", glow: "rgba(255, 102, 0, 0.7)", freq: 987.77 }, // B5
  7: { id: 7, name: "BLUE", hex: "#2979ff", glow: "rgba(41, 121, 255, 0.7)", freq: 1046.50 }, // C6
  8: { id: 8, name: "RED", hex: "#ff1744", glow: "rgba(255, 23, 68, 0.7)", freq: 1174.66 }  // D6
};

// 30 Progressive Curated Levels (100% Verified Solvable)
const CURATED_LEVELS = [
  {
    "id": 1,
    "name": "Signal Handshake",
    "tier": "Tier 1: Junior Hacker",
    "size": 4,
    "pairs": [
      {
        "color": 1,
        "p1": [
          0,
          0
        ],
        "p2": [
          2,
          2
        ],
        "solutionPath": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            2,
            1
          ],
          [
            2,
            2
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          3,
          0
        ],
        "p2": [
          2,
          3
        ],
        "solutionPath": [
          [
            3,
            0
          ],
          [
            3,
            1
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ],
          [
            2,
            3
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          1,
          1
        ],
        "p2": [
          0,
          3
        ],
        "solutionPath": [
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            1,
            2
          ],
          [
            1,
            3
          ],
          [
            0,
            3
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 3
  },
  {
    "id": 2,
    "name": "Buffer Flush",
    "tier": "Tier 1: Junior Hacker",
    "size": 4,
    "pairs": [
      {
        "color": 1,
        "p1": [
          3,
          2
        ],
        "p2": [
          3,
          3
        ],
        "solutionPath": [
          [
            3,
            2
          ],
          [
            2,
            2
          ],
          [
            1,
            2
          ],
          [
            1,
            3
          ],
          [
            2,
            3
          ],
          [
            3,
            3
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          1
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            2,
            1
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          1,
          1
        ],
        "p2": [
          0,
          3
        ],
        "solutionPath": [
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 3
  },
  {
    "id": 3,
    "name": "Kernel Probe",
    "tier": "Tier 1: Junior Hacker",
    "size": 4,
    "pairs": [
      {
        "color": 1,
        "p1": [
          3,
          3
        ],
        "p2": [
          0,
          3
        ],
        "solutionPath": [
          [
            3,
            3
          ],
          [
            2,
            3
          ],
          [
            1,
            3
          ],
          [
            1,
            2
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          0
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          2,
          2
        ],
        "p2": [
          0,
          1
        ],
        "solutionPath": [
          [
            2,
            2
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          3,
          2
        ],
        "p2": [
          3,
          0
        ],
        "solutionPath": [
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 4
  },
  {
    "id": 4,
    "name": "Port Scanner",
    "tier": "Tier 1: Junior Hacker",
    "size": 4,
    "pairs": [
      {
        "color": 1,
        "p1": [
          1,
          3
        ],
        "p2": [
          0,
          2
        ],
        "solutionPath": [
          [
            1,
            3
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          1
        ],
        "p2": [
          3,
          3
        ],
        "solutionPath": [
          [
            2,
            1
          ],
          [
            3,
            1
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          3,
          0
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            3,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          2,
          3
        ],
        "p2": [
          1,
          2
        ],
        "solutionPath": [
          [
            2,
            3
          ],
          [
            2,
            2
          ],
          [
            1,
            2
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 4
  },
  {
    "id": 5,
    "name": "Gateway Bypass",
    "tier": "Tier 1: Junior Hacker",
    "size": 4,
    "pairs": [
      {
        "color": 1,
        "p1": [
          2,
          0
        ],
        "p2": [
          3,
          2
        ],
        "solutionPath": [
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            3,
            1
          ],
          [
            3,
            2
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          1,
          1
        ],
        "p2": [
          1,
          0
        ],
        "solutionPath": [
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ],
          [
            1,
            0
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          1,
          2
        ],
        "p2": [
          1,
          3
        ],
        "solutionPath": [
          [
            1,
            2
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          2,
          1
        ],
        "p2": [
          3,
          3
        ],
        "solutionPath": [
          [
            2,
            1
          ],
          [
            2,
            2
          ],
          [
            2,
            3
          ],
          [
            3,
            3
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 4
  },
  {
    "id": 6,
    "name": "Firewall Breach",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          2,
          1
        ],
        "p2": [
          0,
          1
        ],
        "solutionPath": [
          [
            2,
            1
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          4,
          2
        ],
        "p2": [
          4,
          0
        ],
        "solutionPath": [
          [
            4,
            2
          ],
          [
            4,
            1
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          0,
          4
        ],
        "p2": [
          0,
          2
        ],
        "solutionPath": [
          [
            0,
            4
          ],
          [
            1,
            4
          ],
          [
            2,
            4
          ],
          [
            2,
            3
          ],
          [
            1,
            3
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          1,
          2
        ],
        "p2": [
          3,
          4
        ],
        "solutionPath": [
          [
            1,
            2
          ],
          [
            2,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            4,
            4
          ],
          [
            3,
            4
          ]
        ]
      }
    ],
    "blockers": [
      [
        1,
        1
      ]
    ],
    "optimalMoves": 4
  },
  {
    "id": 7,
    "name": "Decryption Loop",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          4,
          0
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            4,
            0
          ],
          [
            3,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          0,
          1
        ],
        "p2": [
          0,
          4
        ],
        "solutionPath": [
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ],
          [
            1,
            4
          ],
          [
            0,
            4
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          2,
          3
        ],
        "p2": [
          2,
          4
        ],
        "solutionPath": [
          [
            2,
            3
          ],
          [
            3,
            3
          ],
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            4,
            4
          ],
          [
            3,
            4
          ],
          [
            2,
            4
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          1,
          1
        ],
        "p2": [
          1,
          2
        ],
        "solutionPath": [
          [
            1,
            1
          ],
          [
            2,
            1
          ],
          [
            2,
            2
          ],
          [
            1,
            2
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 4
  },
  {
    "id": 8,
    "name": "Subnet Mask",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          2,
          3
        ],
        "p2": [
          4,
          1
        ],
        "solutionPath": [
          [
            2,
            3
          ],
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            4,
            2
          ],
          [
            4,
            1
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          1
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            2,
            1
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          2,
          2
        ],
        "p2": [
          4,
          0
        ],
        "solutionPath": [
          [
            2,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          4,
          4
        ],
        "p2": [
          0,
          2
        ],
        "solutionPath": [
          [
            4,
            4
          ],
          [
            3,
            4
          ],
          [
            2,
            4
          ],
          [
            1,
            4
          ],
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          1,
          2
        ],
        "p2": [
          0,
          1
        ],
        "solutionPath": [
          [
            1,
            2
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ]
      }
    ],
    "blockers": [
      [
        1,
        3
      ]
    ],
    "optimalMoves": 5
  },
  {
    "id": 9,
    "name": "Cipher Leak",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          2,
          4
        ],
        "p2": [
          0,
          4
        ],
        "solutionPath": [
          [
            2,
            4
          ],
          [
            1,
            4
          ],
          [
            1,
            3
          ],
          [
            0,
            3
          ],
          [
            0,
            4
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          3,
          4
        ],
        "p2": [
          4,
          4
        ],
        "solutionPath": [
          [
            3,
            4
          ],
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            4,
            4
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          4,
          1
        ],
        "p2": [
          4,
          0
        ],
        "solutionPath": [
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          2,
          3
        ],
        "p2": [
          0,
          2
        ],
        "solutionPath": [
          [
            2,
            3
          ],
          [
            2,
            2
          ],
          [
            1,
            2
          ],
          [
            0,
            2
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          2,
          0
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        2,
        1
      ]
    ],
    "optimalMoves": 5
  },
  {
    "id": 10,
    "name": "Zero-Day Trace",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          0,
          1
        ],
        "p2": [
          2,
          0
        ],
        "solutionPath": [
          [
            0,
            1
          ],
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            2,
            1
          ],
          [
            2,
            0
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          0,
          4
        ],
        "p2": [
          2,
          2
        ],
        "solutionPath": [
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ],
          [
            1,
            2
          ],
          [
            2,
            2
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          2,
          4
        ],
        "p2": [
          4,
          1
        ],
        "solutionPath": [
          [
            2,
            4
          ],
          [
            3,
            4
          ],
          [
            4,
            4
          ],
          [
            4,
            3
          ],
          [
            4,
            2
          ],
          [
            4,
            1
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          4,
          0
        ],
        "p2": [
          3,
          1
        ],
        "solutionPath": [
          [
            4,
            0
          ],
          [
            3,
            0
          ],
          [
            3,
            1
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          3,
          2
        ],
        "p2": [
          1,
          4
        ],
        "solutionPath": [
          [
            3,
            2
          ],
          [
            3,
            3
          ],
          [
            2,
            3
          ],
          [
            1,
            3
          ],
          [
            1,
            4
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 5
  },
  {
    "id": 11,
    "name": "Proxy Cascade",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          4,
          3
        ],
        "p2": [
          2,
          3
        ],
        "solutionPath": [
          [
            4,
            3
          ],
          [
            4,
            4
          ],
          [
            3,
            4
          ],
          [
            2,
            4
          ],
          [
            2,
            3
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          2
        ],
        "p2": [
          0,
          4
        ],
        "solutionPath": [
          [
            2,
            2
          ],
          [
            1,
            2
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ],
          [
            1,
            4
          ],
          [
            0,
            4
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          1,
          0
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            3,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          3,
          2
        ],
        "p2": [
          4,
          0
        ],
        "solutionPath": [
          [
            3,
            2
          ],
          [
            4,
            2
          ],
          [
            4,
            1
          ],
          [
            4,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        3,
        3
      ]
    ],
    "optimalMoves": 4
  },
  {
    "id": 12,
    "name": "Packet Storm",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          2,
          1
        ],
        "p2": [
          3,
          3
        ],
        "solutionPath": [
          [
            2,
            1
          ],
          [
            3,
            1
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          0,
          4
        ],
        "p2": [
          1,
          1
        ],
        "solutionPath": [
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          4,
          1
        ],
        "p2": [
          3,
          4
        ],
        "solutionPath": [
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            4,
            4
          ],
          [
            3,
            4
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          1,
          3
        ],
        "p2": [
          2,
          2
        ],
        "solutionPath": [
          [
            1,
            3
          ],
          [
            1,
            4
          ],
          [
            2,
            4
          ],
          [
            2,
            3
          ],
          [
            2,
            2
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          0,
          0
        ],
        "p2": [
          4,
          0
        ],
        "solutionPath": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        1,
        2
      ]
    ],
    "optimalMoves": 5
  },
  {
    "id": 13,
    "name": "Cryptographic Key",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          4,
          0
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            4,
            0
          ],
          [
            3,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          2
        ],
        "p2": [
          0,
          1
        ],
        "solutionPath": [
          [
            2,
            2
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          1,
          4
        ],
        "p2": [
          3,
          4
        ],
        "solutionPath": [
          [
            1,
            4
          ],
          [
            1,
            3
          ],
          [
            2,
            3
          ],
          [
            2,
            4
          ],
          [
            3,
            4
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          0,
          4
        ],
        "p2": [
          1,
          2
        ],
        "solutionPath": [
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ],
          [
            1,
            2
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          4,
          4
        ],
        "p2": [
          3,
          1
        ],
        "solutionPath": [
          [
            4,
            4
          ],
          [
            4,
            3
          ],
          [
            3,
            3
          ],
          [
            3,
            2
          ],
          [
            4,
            2
          ],
          [
            4,
            1
          ],
          [
            3,
            1
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 5
  },
  {
    "id": 14,
    "name": "Token Hijack",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          4,
          0
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            4,
            0
          ],
          [
            3,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          4,
          2
        ],
        "p2": [
          4,
          1
        ],
        "solutionPath": [
          [
            4,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            4,
            1
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          4,
          3
        ],
        "p2": [
          4,
          4
        ],
        "solutionPath": [
          [
            4,
            3
          ],
          [
            3,
            3
          ],
          [
            3,
            4
          ],
          [
            4,
            4
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          1,
          2
        ],
        "p2": [
          0,
          4
        ],
        "solutionPath": [
          [
            1,
            2
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            0,
            4
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          2,
          1
        ],
        "p2": [
          1,
          4
        ],
        "solutionPath": [
          [
            2,
            1
          ],
          [
            2,
            2
          ],
          [
            2,
            3
          ],
          [
            2,
            4
          ],
          [
            1,
            4
          ]
        ]
      }
    ],
    "blockers": [
      [
        1,
        3
      ]
    ],
    "optimalMoves": 5
  },
  {
    "id": 15,
    "name": "Trojan Echo",
    "tier": "Tier 2: Infiltrator",
    "size": 5,
    "pairs": [
      {
        "color": 1,
        "p1": [
          3,
          0
        ],
        "p2": [
          4,
          0
        ],
        "solutionPath": [
          [
            3,
            0
          ],
          [
            4,
            0
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          3,
          1
        ],
        "p2": [
          3,
          4
        ],
        "solutionPath": [
          [
            3,
            1
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ],
          [
            3,
            4
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          4,
          4
        ],
        "p2": [
          4,
          1
        ],
        "solutionPath": [
          [
            4,
            4
          ],
          [
            4,
            3
          ],
          [
            4,
            2
          ],
          [
            4,
            1
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          2,
          0
        ],
        "p2": [
          0,
          3
        ],
        "solutionPath": [
          [
            2,
            0
          ],
          [
            2,
            1
          ],
          [
            2,
            2
          ],
          [
            2,
            3
          ],
          [
            2,
            4
          ],
          [
            1,
            4
          ],
          [
            0,
            4
          ],
          [
            0,
            3
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          1,
          3
        ],
        "p2": [
          0,
          2
        ],
        "solutionPath": [
          [
            1,
            3
          ],
          [
            1,
            2
          ],
          [
            1,
            1
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 5
  },
  {
    "id": 16,
    "name": "Neural Node",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          5,
          0
        ],
        "p2": [
          5,
          5
        ],
        "solutionPath": [
          [
            5,
            0
          ],
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            5,
            4
          ],
          [
            5,
            5
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          0,
          3
        ],
        "p2": [
          0,
          5
        ],
        "solutionPath": [
          [
            0,
            3
          ],
          [
            0,
            4
          ],
          [
            0,
            5
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          1,
          1
        ],
        "p2": [
          2,
          1
        ],
        "solutionPath": [
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            1,
            2
          ],
          [
            2,
            2
          ],
          [
            2,
            1
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          3,
          4
        ],
        "p2": [
          4,
          2
        ],
        "solutionPath": [
          [
            3,
            4
          ],
          [
            2,
            4
          ],
          [
            1,
            4
          ],
          [
            1,
            5
          ],
          [
            2,
            5
          ],
          [
            3,
            5
          ],
          [
            4,
            5
          ],
          [
            4,
            4
          ],
          [
            4,
            3
          ],
          [
            4,
            2
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          2,
          3
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            2,
            3
          ],
          [
            3,
            3
          ],
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        1,
        3
      ]
    ],
    "optimalMoves": 5
  },
  {
    "id": 17,
    "name": "Dark Fiber",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          5,
          5
        ],
        "p2": [
          4,
          3
        ],
        "solutionPath": [
          [
            5,
            5
          ],
          [
            4,
            5
          ],
          [
            4,
            4
          ],
          [
            4,
            3
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          4,
          0
        ],
        "p2": [
          3,
          0
        ],
        "solutionPath": [
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            4,
            1
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          5,
          4
        ],
        "p2": [
          4,
          2
        ],
        "solutionPath": [
          [
            5,
            4
          ],
          [
            5,
            3
          ],
          [
            5,
            2
          ],
          [
            4,
            2
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          2,
          3
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            2,
            3
          ],
          [
            3,
            3
          ],
          [
            3,
            2
          ],
          [
            2,
            2
          ],
          [
            2,
            1
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          0,
          2
        ],
        "p2": [
          1,
          5
        ],
        "solutionPath": [
          [
            0,
            2
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ],
          [
            1,
            2
          ],
          [
            1,
            3
          ],
          [
            0,
            3
          ],
          [
            0,
            4
          ],
          [
            0,
            5
          ],
          [
            1,
            5
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          1,
          4
        ],
        "p2": [
          2,
          5
        ],
        "solutionPath": [
          [
            1,
            4
          ],
          [
            2,
            4
          ],
          [
            3,
            4
          ],
          [
            3,
            5
          ],
          [
            2,
            5
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 6
  },
  {
    "id": 18,
    "name": "Logic Gate Relay",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          0,
          5
        ],
        "p2": [
          4,
          1
        ],
        "solutionPath": [
          [
            0,
            5
          ],
          [
            1,
            5
          ],
          [
            1,
            4
          ],
          [
            1,
            3
          ],
          [
            2,
            3
          ],
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            4,
            2
          ],
          [
            4,
            1
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          4
        ],
        "p2": [
          5,
          5
        ],
        "solutionPath": [
          [
            2,
            4
          ],
          [
            2,
            5
          ],
          [
            3,
            5
          ],
          [
            4,
            5
          ],
          [
            4,
            4
          ],
          [
            5,
            4
          ],
          [
            5,
            5
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          4,
          0
        ],
        "p2": [
          0,
          4
        ],
        "solutionPath": [
          [
            4,
            0
          ],
          [
            3,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            0,
            4
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          2,
          2
        ],
        "p2": [
          1,
          1
        ],
        "solutionPath": [
          [
            2,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          5,
          3
        ],
        "p2": [
          5,
          0
        ],
        "solutionPath": [
          [
            5,
            3
          ],
          [
            5,
            2
          ],
          [
            5,
            1
          ],
          [
            5,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        3,
        4
      ],
      [
        1,
        2
      ]
    ],
    "optimalMoves": 5
  },
  {
    "id": 19,
    "name": "Hash Collision",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          3,
          3
        ],
        "p2": [
          4,
          3
        ],
        "solutionPath": [
          [
            3,
            3
          ],
          [
            3,
            2
          ],
          [
            4,
            2
          ],
          [
            4,
            1
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            4,
            3
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          2
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            2,
            2
          ],
          [
            2,
            1
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          0,
          3
        ],
        "p2": [
          1,
          1
        ],
        "solutionPath": [
          [
            0,
            3
          ],
          [
            0,
            2
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          5,
          5
        ],
        "p2": [
          4,
          5
        ],
        "solutionPath": [
          [
            5,
            5
          ],
          [
            5,
            4
          ],
          [
            4,
            4
          ],
          [
            3,
            4
          ],
          [
            2,
            4
          ],
          [
            2,
            5
          ],
          [
            3,
            5
          ],
          [
            4,
            5
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          1,
          5
        ],
        "p2": [
          1,
          2
        ],
        "solutionPath": [
          [
            1,
            5
          ],
          [
            0,
            5
          ],
          [
            0,
            4
          ],
          [
            1,
            4
          ],
          [
            1,
            3
          ],
          [
            1,
            2
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          5,
          0
        ],
        "p2": [
          3,
          0
        ],
        "solutionPath": [
          [
            5,
            0
          ],
          [
            4,
            0
          ],
          [
            3,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        3,
        1
      ],
      [
        2,
        3
      ]
    ],
    "optimalMoves": 6
  },
  {
    "id": 20,
    "name": "Data Pipeline",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          1,
          0
        ],
        "p2": [
          4,
          1
        ],
        "solutionPath": [
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            4,
            1
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          4,
          4
        ],
        "p2": [
          2,
          2
        ],
        "solutionPath": [
          [
            4,
            4
          ],
          [
            3,
            4
          ],
          [
            2,
            4
          ],
          [
            2,
            3
          ],
          [
            2,
            2
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          5,
          2
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            5,
            2
          ],
          [
            4,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          4,
          5
        ],
        "p2": [
          0,
          5
        ],
        "solutionPath": [
          [
            4,
            5
          ],
          [
            3,
            5
          ],
          [
            2,
            5
          ],
          [
            1,
            5
          ],
          [
            0,
            5
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          3,
          3
        ],
        "p2": [
          5,
          5
        ],
        "solutionPath": [
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            5,
            3
          ],
          [
            5,
            4
          ],
          [
            5,
            5
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          1,
          2
        ],
        "p2": [
          0,
          4
        ],
        "solutionPath": [
          [
            1,
            2
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ],
          [
            1,
            4
          ],
          [
            0,
            4
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 6
  },
  {
    "id": 21,
    "name": "Ghost Cluster",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          0,
          5
        ],
        "p2": [
          1,
          0
        ],
        "solutionPath": [
          [
            0,
            5
          ],
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ],
          [
            1,
            0
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          4,
          3
        ],
        "p2": [
          5,
          5
        ],
        "solutionPath": [
          [
            4,
            3
          ],
          [
            5,
            3
          ],
          [
            5,
            4
          ],
          [
            5,
            5
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          4,
          5
        ],
        "p2": [
          2,
          3
        ],
        "solutionPath": [
          [
            4,
            5
          ],
          [
            4,
            4
          ],
          [
            3,
            4
          ],
          [
            2,
            4
          ],
          [
            2,
            3
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          1,
          2
        ],
        "p2": [
          5,
          0
        ],
        "solutionPath": [
          [
            1,
            2
          ],
          [
            2,
            2
          ],
          [
            3,
            2
          ],
          [
            4,
            2
          ],
          [
            5,
            2
          ],
          [
            5,
            1
          ],
          [
            5,
            0
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          2,
          0
        ],
        "p2": [
          1,
          1
        ],
        "solutionPath": [
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            3,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          1,
          4
        ],
        "p2": [
          3,
          5
        ],
        "solutionPath": [
          [
            1,
            4
          ],
          [
            1,
            5
          ],
          [
            2,
            5
          ],
          [
            3,
            5
          ]
        ]
      }
    ],
    "blockers": [
      [
        1,
        3
      ],
      [
        3,
        3
      ]
    ],
    "optimalMoves": 6
  },
  {
    "id": 22,
    "name": "Quantum Entanglement",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          1,
          5
        ],
        "p2": [
          0,
          5
        ],
        "solutionPath": [
          [
            1,
            5
          ],
          [
            0,
            5
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          1
        ],
        "p2": [
          4,
          2
        ],
        "solutionPath": [
          [
            2,
            1
          ],
          [
            1,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            4,
            2
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          1,
          4
        ],
        "p2": [
          0,
          4
        ],
        "solutionPath": [
          [
            1,
            4
          ],
          [
            0,
            4
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          3,
          1
        ],
        "p2": [
          0,
          3
        ],
        "solutionPath": [
          [
            3,
            1
          ],
          [
            3,
            2
          ],
          [
            2,
            2
          ],
          [
            2,
            3
          ],
          [
            1,
            3
          ],
          [
            0,
            3
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          5,
          5
        ],
        "p2": [
          4,
          4
        ],
        "solutionPath": [
          [
            5,
            5
          ],
          [
            5,
            4
          ],
          [
            5,
            3
          ],
          [
            4,
            3
          ],
          [
            3,
            3
          ],
          [
            3,
            4
          ],
          [
            2,
            4
          ],
          [
            2,
            5
          ],
          [
            3,
            5
          ],
          [
            4,
            5
          ],
          [
            4,
            4
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          1,
          2
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            1,
            2
          ],
          [
            0,
            2
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        4,
        1
      ]
    ],
    "optimalMoves": 6
  },
  {
    "id": 23,
    "name": "Rootkit Containment",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          1,
          5
        ],
        "p2": [
          1,
          2
        ],
        "solutionPath": [
          [
            1,
            5
          ],
          [
            1,
            4
          ],
          [
            1,
            3
          ],
          [
            2,
            3
          ],
          [
            2,
            2
          ],
          [
            1,
            2
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          5
        ],
        "p2": [
          5,
          1
        ],
        "solutionPath": [
          [
            2,
            5
          ],
          [
            3,
            5
          ],
          [
            3,
            4
          ],
          [
            3,
            3
          ],
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          4,
          5
        ],
        "p2": [
          4,
          3
        ],
        "solutionPath": [
          [
            4,
            5
          ],
          [
            5,
            5
          ],
          [
            5,
            4
          ],
          [
            4,
            4
          ],
          [
            4,
            3
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          5,
          3
        ],
        "p2": [
          4,
          2
        ],
        "solutionPath": [
          [
            5,
            3
          ],
          [
            5,
            2
          ],
          [
            4,
            2
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          0,
          5
        ],
        "p2": [
          0,
          0
        ],
        "solutionPath": [
          [
            0,
            5
          ],
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          1,
          1
        ],
        "p2": [
          1,
          0
        ],
        "solutionPath": [
          [
            1,
            1
          ],
          [
            2,
            1
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        4,
        1
      ],
      [
        2,
        4
      ]
    ],
    "optimalMoves": 6
  },
  {
    "id": 24,
    "name": "Mainframe Core",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          3,
          1
        ],
        "p2": [
          1,
          0
        ],
        "solutionPath": [
          [
            3,
            1
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ],
          [
            0,
            0
          ],
          [
            1,
            0
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          2,
          2
        ],
        "p2": [
          2,
          3
        ],
        "solutionPath": [
          [
            2,
            2
          ],
          [
            1,
            2
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ],
          [
            2,
            3
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          5,
          5
        ],
        "p2": [
          4,
          5
        ],
        "solutionPath": [
          [
            5,
            5
          ],
          [
            5,
            4
          ],
          [
            5,
            3
          ],
          [
            4,
            3
          ],
          [
            4,
            4
          ],
          [
            4,
            5
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          3,
          5
        ],
        "p2": [
          5,
          2
        ],
        "solutionPath": [
          [
            3,
            5
          ],
          [
            3,
            4
          ],
          [
            3,
            3
          ],
          [
            3,
            2
          ],
          [
            4,
            2
          ],
          [
            5,
            2
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          1,
          4
        ],
        "p2": [
          0,
          4
        ],
        "solutionPath": [
          [
            1,
            4
          ],
          [
            2,
            4
          ],
          [
            2,
            5
          ],
          [
            1,
            5
          ],
          [
            0,
            5
          ],
          [
            0,
            4
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          2,
          0
        ],
        "p2": [
          5,
          0
        ],
        "solutionPath": [
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            5,
            1
          ],
          [
            5,
            0
          ]
        ]
      }
    ],
    "blockers": [],
    "optimalMoves": 6
  },
  {
    "id": 25,
    "name": "Cyber Citadel",
    "tier": "Tier 3: Security Specialist",
    "size": 6,
    "pairs": [
      {
        "color": 1,
        "p1": [
          3,
          4
        ],
        "p2": [
          5,
          5
        ],
        "solutionPath": [
          [
            3,
            4
          ],
          [
            4,
            4
          ],
          [
            4,
            5
          ],
          [
            5,
            5
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          1,
          2
        ],
        "p2": [
          0,
          1
        ],
        "solutionPath": [
          [
            1,
            2
          ],
          [
            2,
            2
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          5,
          0
        ],
        "p2": [
          2,
          0
        ],
        "solutionPath": [
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            4,
            2
          ],
          [
            4,
            1
          ],
          [
            4,
            0
          ],
          [
            3,
            0
          ],
          [
            2,
            0
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          0,
          5
        ],
        "p2": [
          3,
          5
        ],
        "solutionPath": [
          [
            0,
            5
          ],
          [
            1,
            5
          ],
          [
            2,
            5
          ],
          [
            3,
            5
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          2,
          3
        ],
        "p2": [
          0,
          2
        ],
        "solutionPath": [
          [
            2,
            3
          ],
          [
            2,
            4
          ],
          [
            1,
            4
          ],
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          5,
          4
        ],
        "p2": [
          3,
          2
        ],
        "solutionPath": [
          [
            5,
            4
          ],
          [
            5,
            3
          ],
          [
            4,
            3
          ],
          [
            3,
            3
          ],
          [
            3,
            2
          ]
        ]
      }
    ],
    "blockers": [
      [
        1,
        3
      ],
      [
        3,
        1
      ]
    ],
    "optimalMoves": 6
  },
  {
    "id": 26,
    "name": "Deep Web Node",
    "tier": "Tier 4: Master Hacker",
    "size": 7,
    "pairs": [
      {
        "color": 1,
        "p1": [
          5,
          2
        ],
        "p2": [
          3,
          2
        ],
        "solutionPath": [
          [
            5,
            2
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            3,
            3
          ],
          [
            3,
            2
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          0,
          0
        ],
        "p2": [
          0,
          6
        ],
        "solutionPath": [
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            0,
            4
          ],
          [
            0,
            5
          ],
          [
            0,
            6
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          1,
          6
        ],
        "p2": [
          1,
          1
        ],
        "solutionPath": [
          [
            1,
            6
          ],
          [
            2,
            6
          ],
          [
            2,
            5
          ],
          [
            2,
            4
          ],
          [
            2,
            3
          ],
          [
            1,
            3
          ],
          [
            1,
            2
          ],
          [
            1,
            1
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          6,
          6
        ],
        "p2": [
          5,
          3
        ],
        "solutionPath": [
          [
            6,
            6
          ],
          [
            5,
            6
          ],
          [
            4,
            6
          ],
          [
            3,
            6
          ],
          [
            3,
            5
          ],
          [
            3,
            4
          ],
          [
            4,
            4
          ],
          [
            5,
            4
          ],
          [
            5,
            3
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          4,
          5
        ],
        "p2": [
          5,
          0
        ],
        "solutionPath": [
          [
            4,
            5
          ],
          [
            5,
            5
          ],
          [
            6,
            5
          ],
          [
            6,
            4
          ],
          [
            6,
            3
          ],
          [
            6,
            2
          ],
          [
            6,
            1
          ],
          [
            6,
            0
          ],
          [
            5,
            0
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          5,
          1
        ],
        "p2": [
          1,
          0
        ],
        "solutionPath": [
          [
            5,
            1
          ],
          [
            4,
            1
          ],
          [
            4,
            0
          ],
          [
            3,
            0
          ],
          [
            3,
            1
          ],
          [
            2,
            1
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        2,
        2
      ],
      [
        1,
        5
      ],
      [
        1,
        4
      ]
    ],
    "optimalMoves": 6
  },
  {
    "id": 27,
    "name": "Titanium Vault",
    "tier": "Tier 4: Master Hacker",
    "size": 7,
    "pairs": [
      {
        "color": 1,
        "p1": [
          2,
          5
        ],
        "p2": [
          0,
          2
        ],
        "solutionPath": [
          [
            2,
            5
          ],
          [
            2,
            4
          ],
          [
            1,
            4
          ],
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            0,
            2
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          6,
          0
        ],
        "p2": [
          5,
          2
        ],
        "solutionPath": [
          [
            6,
            0
          ],
          [
            5,
            0
          ],
          [
            4,
            0
          ],
          [
            3,
            0
          ],
          [
            3,
            1
          ],
          [
            4,
            1
          ],
          [
            5,
            1
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            5,
            2
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          4,
          6
        ],
        "p2": [
          2,
          6
        ],
        "solutionPath": [
          [
            4,
            6
          ],
          [
            4,
            5
          ],
          [
            3,
            5
          ],
          [
            3,
            6
          ],
          [
            2,
            6
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          3,
          4
        ],
        "p2": [
          3,
          3
        ],
        "solutionPath": [
          [
            3,
            4
          ],
          [
            4,
            4
          ],
          [
            5,
            4
          ],
          [
            5,
            3
          ],
          [
            4,
            3
          ],
          [
            4,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          0,
          6
        ],
        "p2": [
          0,
          5
        ],
        "solutionPath": [
          [
            0,
            6
          ],
          [
            1,
            6
          ],
          [
            1,
            5
          ],
          [
            0,
            5
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          6,
          6
        ],
        "p2": [
          6,
          3
        ],
        "solutionPath": [
          [
            6,
            6
          ],
          [
            5,
            6
          ],
          [
            5,
            5
          ],
          [
            6,
            5
          ],
          [
            6,
            4
          ],
          [
            6,
            3
          ]
        ]
      },
      {
        "color": 7,
        "p1": [
          0,
          0
        ],
        "p2": [
          2,
          3
        ],
        "solutionPath": [
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            1,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            2,
            1
          ],
          [
            2,
            2
          ],
          [
            2,
            3
          ]
        ]
      }
    ],
    "blockers": [
      [
        1,
        2
      ],
      [
        1,
        3
      ]
    ],
    "optimalMoves": 7
  },
  {
    "id": 28,
    "name": "Hyper-Threading",
    "tier": "Tier 4: Master Hacker",
    "size": 7,
    "pairs": [
      {
        "color": 1,
        "p1": [
          2,
          3
        ],
        "p2": [
          0,
          6
        ],
        "solutionPath": [
          [
            2,
            3
          ],
          [
            1,
            3
          ],
          [
            0,
            3
          ],
          [
            0,
            4
          ],
          [
            0,
            5
          ],
          [
            1,
            5
          ],
          [
            2,
            5
          ],
          [
            2,
            6
          ],
          [
            1,
            6
          ],
          [
            0,
            6
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          1,
          4
        ],
        "p2": [
          4,
          4
        ],
        "solutionPath": [
          [
            1,
            4
          ],
          [
            2,
            4
          ],
          [
            3,
            4
          ],
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            4,
            4
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          6,
          0
        ],
        "p2": [
          6,
          2
        ],
        "solutionPath": [
          [
            6,
            0
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          2,
          0
        ],
        "p2": [
          1,
          1
        ],
        "solutionPath": [
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            1,
            2
          ],
          [
            1,
            1
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          3,
          0
        ],
        "p2": [
          2,
          1
        ],
        "solutionPath": [
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            3,
            1
          ],
          [
            3,
            2
          ],
          [
            2,
            2
          ],
          [
            2,
            1
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          4,
          6
        ],
        "p2": [
          4,
          5
        ],
        "solutionPath": [
          [
            4,
            6
          ],
          [
            3,
            6
          ],
          [
            3,
            5
          ],
          [
            4,
            5
          ]
        ]
      },
      {
        "color": 7,
        "p1": [
          6,
          3
        ],
        "p2": [
          6,
          5
        ],
        "solutionPath": [
          [
            6,
            3
          ],
          [
            6,
            4
          ],
          [
            5,
            4
          ],
          [
            5,
            5
          ],
          [
            5,
            6
          ],
          [
            6,
            6
          ],
          [
            6,
            5
          ]
        ]
      }
    ],
    "blockers": [
      [
        5,
        2
      ],
      [
        5,
        3
      ],
      [
        4,
        2
      ]
    ],
    "optimalMoves": 7
  },
  {
    "id": 29,
    "name": "Quantum Overdrive",
    "tier": "Tier 4: Master Hacker",
    "size": 8,
    "pairs": [
      {
        "color": 1,
        "p1": [
          0,
          2
        ],
        "p2": [
          6,
          6
        ],
        "solutionPath": [
          [
            0,
            2
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ],
          [
            2,
            3
          ],
          [
            2,
            4
          ],
          [
            3,
            4
          ],
          [
            4,
            4
          ],
          [
            5,
            4
          ],
          [
            5,
            5
          ],
          [
            6,
            5
          ],
          [
            7,
            5
          ],
          [
            7,
            6
          ],
          [
            7,
            7
          ],
          [
            6,
            7
          ],
          [
            6,
            6
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          4,
          5
        ],
        "p2": [
          1,
          6
        ],
        "solutionPath": [
          [
            4,
            5
          ],
          [
            3,
            5
          ],
          [
            2,
            5
          ],
          [
            1,
            5
          ],
          [
            1,
            6
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          0,
          1
        ],
        "p2": [
          6,
          4
        ],
        "solutionPath": [
          [
            0,
            1
          ],
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            1,
            2
          ],
          [
            2,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ],
          [
            4,
            3
          ],
          [
            5,
            3
          ],
          [
            6,
            3
          ],
          [
            7,
            3
          ],
          [
            7,
            4
          ],
          [
            6,
            4
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          2,
          1
        ],
        "p2": [
          3,
          1
        ],
        "solutionPath": [
          [
            2,
            1
          ],
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            5,
            1
          ],
          [
            4,
            1
          ],
          [
            3,
            1
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          1,
          4
        ],
        "p2": [
          3,
          6
        ],
        "solutionPath": [
          [
            1,
            4
          ],
          [
            0,
            4
          ],
          [
            0,
            5
          ],
          [
            0,
            6
          ],
          [
            0,
            7
          ],
          [
            1,
            7
          ],
          [
            2,
            7
          ],
          [
            3,
            7
          ],
          [
            3,
            6
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          4,
          7
        ],
        "p2": [
          4,
          6
        ],
        "solutionPath": [
          [
            4,
            7
          ],
          [
            5,
            7
          ],
          [
            5,
            6
          ],
          [
            4,
            6
          ]
        ]
      },
      {
        "color": 7,
        "p1": [
          7,
          0
        ],
        "p2": [
          5,
          2
        ],
        "solutionPath": [
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            6,
            2
          ],
          [
            5,
            2
          ]
        ]
      }
    ],
    "blockers": [
      [
        2,
        6
      ],
      [
        4,
        2
      ]
    ],
    "optimalMoves": 7
  },
  {
    "id": 30,
    "name": "Singularity Breach",
    "tier": "Tier 4: Master Hacker",
    "size": 8,
    "pairs": [
      {
        "color": 1,
        "p1": [
          1,
          7
        ],
        "p2": [
          1,
          2
        ],
        "solutionPath": [
          [
            1,
            7
          ],
          [
            0,
            7
          ],
          [
            0,
            6
          ],
          [
            0,
            5
          ],
          [
            0,
            4
          ],
          [
            0,
            3
          ],
          [
            1,
            3
          ],
          [
            2,
            3
          ],
          [
            2,
            2
          ],
          [
            2,
            1
          ],
          [
            1,
            1
          ],
          [
            1,
            2
          ]
        ]
      },
      {
        "color": 2,
        "p1": [
          6,
          4
        ],
        "p2": [
          7,
          5
        ],
        "solutionPath": [
          [
            6,
            4
          ],
          [
            6,
            3
          ],
          [
            6,
            2
          ],
          [
            6,
            1
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ],
          [
            7,
            4
          ],
          [
            7,
            5
          ]
        ]
      },
      {
        "color": 3,
        "p1": [
          3,
          7
        ],
        "p2": [
          3,
          6
        ],
        "solutionPath": [
          [
            3,
            7
          ],
          [
            2,
            7
          ],
          [
            2,
            6
          ],
          [
            3,
            6
          ]
        ]
      },
      {
        "color": 4,
        "p1": [
          5,
          5
        ],
        "p2": [
          7,
          7
        ],
        "solutionPath": [
          [
            5,
            5
          ],
          [
            6,
            5
          ],
          [
            6,
            6
          ],
          [
            7,
            6
          ],
          [
            7,
            7
          ]
        ]
      },
      {
        "color": 5,
        "p1": [
          5,
          3
        ],
        "p2": [
          0,
          2
        ],
        "solutionPath": [
          [
            5,
            3
          ],
          [
            5,
            2
          ],
          [
            4,
            2
          ],
          [
            3,
            2
          ],
          [
            3,
            1
          ],
          [
            3,
            0
          ],
          [
            2,
            0
          ],
          [
            1,
            0
          ],
          [
            0,
            0
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ]
        ]
      },
      {
        "color": 6,
        "p1": [
          4,
          4
        ],
        "p2": [
          1,
          5
        ],
        "solutionPath": [
          [
            4,
            4
          ],
          [
            4,
            5
          ],
          [
            3,
            5
          ],
          [
            3,
            4
          ],
          [
            2,
            4
          ],
          [
            1,
            4
          ],
          [
            1,
            5
          ]
        ]
      },
      {
        "color": 7,
        "p1": [
          6,
          7
        ],
        "p2": [
          5,
          6
        ],
        "solutionPath": [
          [
            6,
            7
          ],
          [
            5,
            7
          ],
          [
            4,
            7
          ],
          [
            4,
            6
          ],
          [
            5,
            6
          ]
        ]
      },
      {
        "color": 8,
        "p1": [
          5,
          1
        ],
        "p2": [
          7,
          0
        ],
        "solutionPath": [
          [
            5,
            1
          ],
          [
            5,
            0
          ],
          [
            6,
            0
          ],
          [
            7,
            0
          ]
        ]
      }
    ],
    "blockers": [
      [
        1,
        6
      ],
      [
        2,
        5
      ],
      [
        4,
        3
      ],
      [
        4,
        1
      ],
      [
        5,
        4
      ],
      [
        3,
        3
      ],
      [
        4,
        0
      ]
    ],
    "optimalMoves": 8
  }
];

class ProceduralLevelGenerator {
  static generate(levelNumber) {
    let size = 5;
    let numColors = 4;
    let numBlockers = 1;
    if (levelNumber > 35) { size = 6; numColors = 5; numBlockers = 2; }
    if (levelNumber > 50) { size = 7; numColors = 6; numBlockers = 2; }
    if (levelNumber > 75) { size = 8; numColors = 7; numBlockers = 3; }

    const colors = [1, 2, 3, 4, 5, 6, 7, 8].slice(0, numColors);

    for (let attempt = 0; attempt < 50; attempt++) {
      const grid = Array.from({ length: size }, () => Array(size).fill(0));
      const blockers = [];

      // Interior blockers
      if (numBlockers > 0 && size >= 5) {
        const interior = [];
        for (let r = 1; r < size - 1; r++) {
          for (let c = 1; c < size - 1; c++) interior.push([r, c]);
        }
        interior.sort(() => Math.random() - 0.5);
        for (let b = 0; b < numBlockers; b++) {
          if (interior[b]) {
            grid[interior[b][0]][interior[b][1]] = -1;
            blockers.push(interior[b]);
          }
        }
      }

      const unassigned = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (grid[r][c] === 0) unassigned.push([r, c]);
        }
      }
      unassigned.sort(() => Math.random() - 0.5);

      if (unassigned.length < numColors * 2) continue;

      const paths = [];
      for (let c = 0; c < numColors; c++) {
        const start = unassigned.pop();
        grid[start[0]][start[1]] = colors[c];
        paths.push([start]);
      }

      let changed = true;
      while (changed && unassigned.length > 0) {
        changed = false;
        paths.sort((a, b) => a.length - b.length);
        for (let i = 0; i < paths.length; i++) {
          const path = paths[i];
          const color = colors[i];
          const ends = [[path[path.length - 1], true], [path[0], false]];
          ends.sort(() => Math.random() - 0.5);

          for (const [curr, isTail] of ends) {
            const [r, c] = curr;
            const nbrs = [
              [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
            ].filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === 0);

            if (nbrs.length > 0) {
              const nxt = nbrs[Math.floor(Math.random() * nbrs.length)];
              grid[nxt[0]][nxt[1]] = color;
              if (isTail) path.push(nxt);
              else path.unshift(nxt);
              const uIdx = unassigned.findIndex(([ur, uc]) => ur === nxt[0] && uc === nxt[1]);
              if (uIdx !== -1) unassigned.splice(uIdx, 1);
              changed = true; // wait, in JS: changed = true
              break;
            }
          }
        }
      }

      if (paths.some(p => p.length < 2)) continue;

      // Add leftover unassigned as blockers
      unassigned.forEach(([r, c]) => {
        grid[r][c] = -1;
        blockers.push([r, c]);
      });

      const pairs = paths.map((p, i) => ({
        color: colors[i],
        p1: p[0],
        p2: p[p.length - 1],
        solutionPath: p
      }));

      return {
        id: levelNumber,
        name: `Sector #${levelNumber}`,
        tier: "Endless Protocol",
        size,
        pairs,
        blockers,
        optimalMoves: pairs.length,
        isProcedural: true
      };
    }

    // Fallback to a curated level template scaled
    const base = CURATED_LEVELS[(levelNumber % CURATED_LEVELS.length)];
    return {
      ...base,
      id: levelNumber,
      name: `Sector #${levelNumber}`,
      tier: "Endless Protocol",
      isProcedural: true
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { COLOR_DEFS, CURATED_LEVELS, ProceduralLevelGenerator };
}
