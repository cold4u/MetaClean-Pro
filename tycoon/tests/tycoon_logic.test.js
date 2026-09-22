const assert = require('assert');
const { TycoonEngine, BUILDINGS } = require('../js/tycoon.js');

console.log("Running Cyber City: Power Grid Builder Unit Tests...");

// Mock Audio
const mockAudio = {
    build: () => {},
    power: () => {},
    blackout: () => {},
    revenue: () => {},
    milestone: () => {}
};

// Test 1: Grid & Resources Initialization
{
    const engine = new TycoonEngine(null, mockAudio);
    assert.strictEqual(engine.cols, 12, "Must have 12 columns");
    assert.strictEqual(engine.rows, 9, "Must have 9 rows");
    assert.strictEqual(engine.credits, 750, "Should start with 750 Credits");
    assert.strictEqual(engine.satisfaction, 100, "Should start with 100% satisfaction");
    console.log("✔ Test 1: Grid and resources initialization passed");
}

// Test 2: Construction Mechanics & Constraints
{
    const engine = new TycoonEngine(null, mockAudio);
    const initialCredits = engine.credits;

    // Build solar at (2, 2)
    const built = engine.buildAt(2, 2, 'solar');
    assert.strictEqual(built, true, "Should successfully build solar farm");
    assert.strictEqual(engine.credits, initialCredits - BUILDINGS.solar.cost, "Credits should deduct 150");
    assert.strictEqual(engine.grid[2][2].building.type, 'solar');

    // Cannot build on top of existing building
    const doubleBuild = engine.buildAt(2, 2, 'fusion');
    assert.strictEqual(doubleBuild, false, "Cannot build on occupied tile");

    // Cannot build in river
    const riverBuild = engine.buildAt(6, 3, 'solar');
    assert.strictEqual(riverBuild, false, "Cannot build in river");
    console.log("✔ Test 2: Construction mechanics and constraints passed");
}

// Test 3: Power Grid BFS Connectivity
{
    const engine = new TycoonEngine(null, mockAudio);
    engine.dayTime = 12.0; // Noon peak sun

    // Build solar at col 2, row 2, and residential at col 3, row 2 (adjacent)
    engine.buildAt(2, 2, 'solar');
    engine.buildAt(3, 2, 'residential');

    engine.calculatePowerGrid();
    assert.strictEqual(engine.grid[2][2].building.type, 'solar');
    assert.strictEqual(engine.grid[2][2].building.powered, true, "Solar farm should be active");
    assert.strictEqual(engine.grid[2][3].building.type, 'residential');
    assert.strictEqual(engine.grid[2][3].building.powered, true, "Adjacent residential block should be powered");
    console.log("✔ Test 3: Power grid BFS connectivity passed");
}

// Test 4: Sunlight Factor Day/Night
{
    const engine = new TycoonEngine(null, mockAudio);
    engine.dayTime = 12.0; // Noon
    const noonSun = engine.getSunlightFactor();
    assert(noonSun > 1.0, "Noon sunlight factor should be peak (> 1.0)");

    engine.dayTime = 2.0; // 2:00 AM Night
    const nightSun = engine.getSunlightFactor();
    assert.strictEqual(nightSun, 0, "Night sunlight factor should be 0");
    console.log("✔ Test 4: Sunlight factor cycle passed");
}

// Test 5: Tax Revenue Collection
{
    const engine = new TycoonEngine(null, mockAudio);
    engine.dayTime = 12.0;
    engine.buildAt(1, 1, 'solar');
    engine.buildAt(2, 1, 'residential');
    engine.calculatePowerGrid();

    const creditsBeforeTick = engine.credits;
    engine.simulationTick();
    assert(engine.credits > creditsBeforeTick, "Powered residential building should produce tax revenue");
    console.log("✔ Test 5: Tax revenue collection passed");
}

// Test 6: Battery Storage Charging & Capacity
{
    const engine = new TycoonEngine(null, mockAudio);
    engine.dayTime = 12.0;
    engine.credits = 1000;
    engine.buildAt(1, 1, 'fusion');
    engine.buildAt(2, 1, 'battery');
    engine.calculatePowerGrid();

    assert.strictEqual(engine.maxBatteryCapacity, 250, "Battery bank should add 250 MWh capacity");
    assert.strictEqual(engine.batteryCharge, 0, "Initially 0 charge");

    // Run tick with surplus power (140 MW generation, 0 demand)
    engine.simulationTick();
    assert(engine.batteryCharge > 0, "Surplus generation should charge battery");
    console.log("✔ Test 6: Battery storage charging passed");
}

console.log("\nALL CYBER CITY TYCOON UNIT TESTS PASSED (6/6)!\n");
