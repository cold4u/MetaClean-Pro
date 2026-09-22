const assert = require('assert');
const { MatchEngine } = require('../js/match.js');

console.log("Running Neon Alchemist: Spell Matrix Unit Tests...");

// Mock Audio
const mockAudio = {
    swap: () => {},
    match: () => {},
    heal: () => {},
    shield: () => {},
    fireSpell: () => {},
    bossAttack: () => {},
    bossHurt: () => {},
    victory: () => {},
    defeat: () => {}
};

// Test 1: Grid Initialization
{
    const engine = new MatchEngine(null, mockAudio);
    assert.strictEqual(engine.grid.length, 8, "Grid should have 8 rows");
    assert.strictEqual(engine.grid[0].length, 8, "Grid should have 8 columns");
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            assert(engine.grid[r][c].type >= 0 && engine.grid[r][c].type <= 5, "Tile types must be between 0 and 5");
        }
    }
    console.log("✔ Test 1: Grid initialization passed");
}

// Test 2: Match detection
{
    const engine = new MatchEngine(null, mockAudio);
    // Artificially construct a 3-match horizontally
    engine.grid[3][2].type = 1;
    engine.grid[3][3].type = 1;
    engine.grid[3][4].type = 1;

    const matches = engine.findMatches();
    const hasRow3 = matches.some(m => m.r === 3 && m.c === 2) &&
                    matches.some(m => m.r === 3 && m.c === 3) &&
                    matches.some(m => m.r === 3 && m.c === 4);
    assert.strictEqual(hasRow3, true, "Should detect horizontal 3-match");
    console.log("✔ Test 2: Horizontal match detection passed");
}

// Test 3: Shield absorption and Player HP damage
{
    const engine = new MatchEngine(null, mockAudio);
    engine.playerHp = 100;
    engine.playerShield = 15;
    engine.takeDamage(10);
    assert.strictEqual(engine.playerShield, 5, "Shield should absorb all 10 damage");
    assert.strictEqual(engine.playerHp, 100, "HP should remain 100");

    engine.takeDamage(15);
    assert.strictEqual(engine.playerShield, 0, "Shield should be exhausted");
    assert.strictEqual(engine.playerHp, 90, "Remaining 10 damage should pierce to HP (100 - 10 = 90)");
    console.log("✔ Test 3: Shield absorption and HP mechanics passed");
}

// Test 4: Boss Damage & Stage Advancement
{
    const engine = new MatchEngine(null, mockAudio);
    const startHp = engine.currentBoss.hp;
    engine.damageBoss(40);
    assert.strictEqual(engine.currentBoss.hp, startHp - 40, "Boss HP should decrease by 40");

    // Defeat first boss
    engine.damageBoss(9999);
    assert.strictEqual(engine.stageIndex, 1, "Should advance to stage 2 boss after defeat");
    assert.strictEqual(engine.currentBoss.name, "Cyber Drake", "Next boss should be Cyber Drake");
    console.log("✔ Test 4: Boss damage & stage progression passed");
}

// Test 5: Spell Casting System
{
    const engine = new MatchEngine(null, mockAudio);
    engine.playerMana = 40;
    // Cast Flame Lance (cost 25, 35 damage)
    const bossHpBefore = engine.currentBoss.hp;
    engine.castSpell(0);
    assert.strictEqual(engine.playerMana, 15, "Mana should decrease by 25 (40 - 25 = 15)");
    assert.strictEqual(engine.currentBoss.hp, bossHpBefore - 35, "Boss HP should decrease by 35");

    // Try casting when not enough mana
    engine.castSpell(0); // Cost 25, only 15 left
    assert.strictEqual(engine.playerMana, 15, "Mana should not decrease when insufficient");
    console.log("✔ Test 5: Spell casting & mana mechanics passed");
}

// Test 6: Boss Timer & Attack Turn
{
    const engine = new MatchEngine(null, mockAudio);
    engine.playerShield = 0;
    engine.playerHp = 100;
    engine.currentBoss.timer = 0.1;
    engine.currentBoss.attack = 20;
    engine.update(0.15); // Timer elapses
    assert.strictEqual(engine.playerHp, 80, "Player should take 20 damage when boss timer elapses");
    console.log("✔ Test 6: Boss attack timer loop passed");
}

console.log("All MatchEngine Unit Tests Passed Successfully!");
