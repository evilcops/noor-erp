/** Central dispatch tuning — adjust weights here without touching engine logic */
export const DISPATCH_CONFIG = {
  /** Warehouse packing / prep before dispatch (minutes) */
  prepMinutes: 30,
  /** Customer-facing delivery promise window length */
  promiseWindowMinutes: 45,
  /** Average time at each customer stop (minutes) */
  avgStopServiceMinutes: 12,
  /** Fallback road speed for ETA when OSRM unavailable (m/s) */
  avgSpeedMps: 8,
  /** Orders above this value may get a dedicated run */
  highValueThreshold: 40_000,
  /** Low-value orders bundle onto existing cluster runs */
  lowValueThreshold: 1_500,
  /** Prefer riders within this radius of warehouse (km) */
  warehouseNearRadiusKm: 3,
  warehouseProximityBonusMax: 45,
  /** Penalty per existing scheduled stop when scoring riders */
  loadPenaltyPerStop: 8,
  /** Max stops added per rider per optimise pass */
  maxStopsPerOptimisePass: 10,
  /** Default rider capacity when not set on rider record */
  defaultVehicleCapacity: 8,
  /** Bonus when rider is on shift with fresh GPS near warehouse */
  onShiftBonus: 25,
  /** High-value solo order prefers empty rider */
  highValueEmptyRiderBonus: 25,
  /** Same-cluster bundling bonus */
  sameClusterBonus: 15,
  /** Max age of rider GPS for proximity scoring (ms) */
  riderLocationMaxAgeMs: 30 * 60 * 1000,
  /** If ETAs are within this many minutes, higher order value wins */
  etaTieBreakMinutes: 8,
  /** Debounce rapid optimise triggers (ms) */
  optimiseDebounceMs: 4_000,
  /** Background auto-optimise interval when server is active (ms) */
  backgroundOptimiseIntervalMs: 90_000,
  priorityWeights: {
    eta: 0.45,
    value: 0.3,
    waiting: 0.25,
  },
} as const;
