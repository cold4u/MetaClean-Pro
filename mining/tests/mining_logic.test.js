const assert = require('assert');
const { MiningEngine } = require('../js/mining.js');

console.log("Running Deep Core: Nano Drill Unit Tests...");

// Mock Audio
const mockAudio = {
    drill: () => {},
    orePickup: () => {},
    thruster: () => {},
    sellOres: () => {},
    upgrade: () => {},
    warning: () => {},
    hullDamage: () => {},
    victory: () => {},
    emergencyTow: () => {}
};

// Test 1: World Generation
{
    const engine = new MiningEngine(null, mockAudio);
    assert.strictEqual(engine.grid.length, 32, "Grid should have 32 rows");
    assert.strictEqual(engine.grid[0].length, 16, "Grid should have 16 columns");
    assert.strictEqual(engine.grid[0][0], 0, "Row 0 should be surface air");
    assert.strictEqual(engine.grid[31][8], 9, "Core Crystal should be at bottom row 31");
    console.log("✔ Test 1: World grid generation passed");
}

// Test 2: Ore Drilling & Cargo Collection
{
    const engine = new MiningEngine(null, mockAudio);
    engine.grid[2][4] = 2; // Copper ore
    engine.player.targetBlock = { r: 2, c: 4, type: 2 };
    engine.player.cargo = [];

    engine.finishDrill();
    assert.strictEqual(engine.grid[2][4], 0, "Drilled block should turn into air");
    assert.strictEqual(engine.player.cargo.length, 1, "Ore should be placed in cargo");
    assert.strictEqual(engine.player.cargo[0].name, "Copper", "Cargo should be Copper");
    console.log("✔ Test 2: Ore drilling & cargo pickup passed");
}

// Test 3: Cargo Capacity Limit
{
    const engine = new MiningEngine(null, mockAudio);
    engine.player.maxCargo = 2;
    engine.player.cargo = [{ name: 'A', val: 10 }, { name: 'B', val: 10 }];

    engine.grid[2][4] = 3; // Silicon
    engine.player.targetBlock = { r: 2, c: 4, type: 3 };
    engine.finishDrill();
    assert.strictEqual(engine.player.cargo.length, 2, "Cargo should not exceed maxCargo");
    console.log("✔ Test 3: Cargo capacity limit passed");
}

// Test 4: Selling Cargo
{
    const engine = new MiningEngine(null, mockAudio);
    engine.player.cargo = [{ val: 50 }, { val: 70 }];
    engine.player.credits = 0;
    engine.sellCargo();
    assert.strictEqual(engine.player.credits, 120, "Credits should increase by total cargo value");
    assert.strictEqual(engine.player.cargo.length, 0, "Cargo should be empty after selling");
    console.log("✔ Test 4: Cargo selling passed");
}

// Test 5: Upgrade Purchasing
{
    const engine = new MiningEngine(null, mockAudio);
    engine.player.credits = 300;
    const cost = engine.upgrades.drill.cost;
    engine.buyUpgrade('drill');
    assert.strictEqual(engine.player.drillTier, 2, "Drill tier should increase to 2");
    assert.strictEqual(engine.player.credits, 300 - cost, "Credits should decrease by upgrade cost");
    console.log("✔ Test 5: Workshop upgrade purchase passed");
}

// Test 6: Emergency Tow Penalty
{
    const engine = new MiningEngine(null, mockAudio);
    engine.player.credits = 100;
    engine.player.x = 200;
    engine.player.y = 400; // Deep underground
    engine.triggerEmergencyTow("OUT OF FUEL");
    assert.strictEqual(engine.player.y, 0, "Player should be towed back to surface (y = 0)");
    assert.strictEqual(engine.player.credits, 50, "Tow fee should deduct 50 credits");
    console.log("✔ Test 6: Emergency tow logic passed");
}

console.log("All MiningEngine Unit Tests Passed Successfully!");
