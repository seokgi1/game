const GAME_WIDTH = 900;
const GAME_HEIGHT = 700;
const GAME_VERSION = 'v0.2.7';
const STAGE_ROWS = [
  [1, 1, 1, 1],
  [2, 1, 1, 1],
  [2, 2, 1, 1],
  [2, 2, 2, 1],
  [2, 2, 2, 2],
  [3, 2, 2, 2],
  [3, 3, 2, 2],
  [3, 3, 3, 2],
  [3, 3, 3, 3],
];
const BOSS_STAGE = 10;
const ITEM_DROP_RATES = {
  shield: 0.03,
  power: 0.05,
  life: 0.01,
};

const State = {
  BOOT: 'boot',
  READY: 'ready',
  PLAYING: 'playing',
  BOSS: 'boss',
  VICTORY: 'victory',
  GAME_OVER: 'game_over',
};

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#030712',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: {
    preload,
    create,
    update,
  },
};

new Phaser.Game(config);

let sceneState = State.BOOT;
let cursors;
let keys;
let enterKey;

let player;
let playerBullets;
let enemyBullets;
let enemies;
let enemyFormation;
let powerUps;
let particles;

let starsFar;
let starsMid;
let starsNear;

let score = 0;
let bestScore = 0;
let lives = 3;
let level = 1;
let waveEnemiesRemaining = 0;
let shield = 0;
let powerLevel = 1;
let rapidUntil = 0;
let stageTransitionPending = false;

let scoreText;
let livesText;
let levelText;
let powerText;
let bestText;
let versionText;
let centerText;
let helperText;
let waveText;
let bossBarLabel;
let bossBarBg;
let bossBarFill;

let lastFired = 0;
let nextFormationAt = 0;
let formationFireAt = 0;
let boss = null;
let bossMaxHp = 0;
let bossFireAt = 0;
let bossPatternAt = 0;
let bossDirection = 1;
let invulnerableUntil = 0;
let bossHitOverlap = null;
let bossDamageCooldownUntil = 0;
let touchTargetX = null;
let bossBattleStarted = false;

function preload() {
  createTextures(this);
}

function create() {
  loadBestScore();

  this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg').setDepth(-10);

  starsFar = createStarLayer(this, 60, 0.35, 'starSmall');
  starsMid = createStarLayer(this, 45, 0.65, 'starMedium');
  starsNear = createStarLayer(this, 24, 1.1, 'starBig');

  particles = this.add.particles(0, 0, 'spark', {
    lifespan: 400,
    speed: { min: 40, max: 180 },
    scale: { start: 1, end: 0 },
    quantity: 0,
    emitting: false,
  });

  playerBullets = this.physics.add.group({
    classType: Phaser.Physics.Arcade.Image,
    maxSize: 80,
    runChildUpdate: false,
  });

  enemyBullets = this.physics.add.group({
    classType: Phaser.Physics.Arcade.Image,
    maxSize: 160,
    runChildUpdate: false,
  });

  enemies = this.physics.add.group({
    classType: Phaser.Physics.Arcade.Image,
    maxSize: 80,
    runChildUpdate: false,
  });

  enemyFormation = this.add.container(0, 0).setDepth(2);
  powerUps = this.physics.add.group({
    classType: Phaser.Physics.Arcade.Image,
    maxSize: 10,
    runChildUpdate: false,
  });

  player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 78, 'player');
  player.setDepth(4);
  player.setCollideWorldBounds(true);
  player.setImmovable(true);

  scoreText = makeUIText(this, 20, 18, 'SCORE: 0', 24, '#ffffff', true);
  bestText = makeUIText(this, 20, 48, `BEST: ${bestScore}`, 18, '#a5d8ff');
  livesText = makeUIText(this, 20, 72, 'LIVES: 3', 18, '#ffd6d6');
  levelText = makeUIText(this, GAME_WIDTH - 170, 18, 'STAGE: 1', 20, '#d6ecff', true);
  powerText = makeUIText(this, GAME_WIDTH - 160, 48, 'POWER: 1', 18, '#fff3b0');
  versionText = makeUIText(this, 20, GAME_HEIGHT - 34, `VER ${GAME_VERSION}`, 14, '#7dd3fc');

  centerText = this.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2 - 70,
    'GALAXY DEFENDER\nTAP OR PRESS ENTER',
    {
      fontSize: '42px',
      align: 'center',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 7,
      lineSpacing: 10,
    }
  ).setOrigin(0.5).setDepth(20);

  helperText = this.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2 + 35,
    'MOVE: LEFT / RIGHT or A / D\nAUTO FIRE ENABLED\nCOLLECT P / S / L ITEMS',
    {
      fontSize: '19px',
      align: 'center',
      color: '#cfe7ff',
      stroke: '#000000',
      strokeThickness: 4,
      lineSpacing: 9,
    }
  ).setOrigin(0.5).setDepth(20);

  waveText = this.add.text(GAME_WIDTH / 2, 110, '', {
    fontSize: '28px',
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 5,
  }).setOrigin(0.5).setDepth(20).setAlpha(0);

  bossBarLabel = makeUIText(this, GAME_WIDTH / 2 - 178, 18, 'BOSS', 18, '#ffd6d6', true).setVisible(false);
  bossBarBg = this.add.rectangle(GAME_WIDTH / 2 + 18, 29, 268, 20, 0x2b0b12, 0.95)
    .setOrigin(0.5)
    .setStrokeStyle(2, 0xffd6d6, 0.75)
    .setDepth(20)
    .setVisible(false);
  bossBarFill = this.add.rectangle(GAME_WIDTH / 2 + 18, 29, 258, 12, 0xfb7185, 1)
    .setOrigin(0.5)
    .setDepth(21)
    .setVisible(false);

  cursors = this.input.keyboard.createCursorKeys();
  keys = this.input.keyboard.addKeys('A,D,SPACE');
  enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

  this.input.on('pointerdown', (pointer) => {
    touchTargetX = pointer.worldX;
  });
  this.input.on('pointermove', (pointer) => {
    if (pointer.isDown) {
      touchTargetX = pointer.worldX;
    }
  });
  this.input.on('pointerup', () => {
    touchTargetX = null;
  });

  this.physics.add.overlap(playerBullets, enemies, onBulletHitEnemy, null, this);
  this.physics.add.overlap(enemyBullets, player, onEnemyBulletHitPlayer, null, this);
  this.physics.add.overlap(enemies, player, onEnemyCrashPlayer, null, this);
  this.physics.add.overlap(powerUps, player, onPickupPowerUp, null, this);

  resetRun.call(this, true);
}

function update(time, delta) {
  scrollStars(starsFar, delta);
  scrollStars(starsMid, delta);
  scrollStars(starsNear, delta);
  bobStars(starsNear, time);

  if (sceneState === State.READY || sceneState === State.GAME_OVER || sceneState === State.VICTORY) {
    if (Phaser.Input.Keyboard.JustDown(enterKey) || this.input.activePointer.justDown) {
      startNewGame.call(this);
    }
    return;
  }

  handlePlayerMovement();
  handlePlayerFiring.call(this, time);
  updatePlayerVisuals.call(this, time);

  cleanupGroup(playerBullets, -40, 'y', true);
  cleanupGroup(enemyBullets, GAME_HEIGHT + 40, 'y', false);
  cleanupGroup(powerUps, GAME_HEIGHT + 40, 'y', false);
  cleanupEnemies(enemies);

  if (sceneState === State.PLAYING) {
    runFormationPhase.call(this, time);
  } else if (sceneState === State.BOSS) {
    runBossPhase.call(this, time);
  }
}

function handlePlayerMovement() {
  player.setVelocityX(0);
  if (touchTargetX !== null) {
    const deltaX = touchTargetX - player.x;
    if (Math.abs(deltaX) > 12) {
      player.setVelocityX(Phaser.Math.Clamp(deltaX * 5.5, -430, 430));
    }
    return;
  }
  if (cursors.left.isDown || keys.A.isDown) {
    player.setVelocityX(-390);
  } else if (cursors.right.isDown || keys.D.isDown) {
    player.setVelocityX(390);
  }
}

function handlePlayerFiring(time) {
  const baseGap = Math.max(80, 170 - (powerLevel - 1) * 7);
  const fireGap = time < rapidUntil ? Math.max(55, baseGap - 30) : baseGap;
  if (time > lastFired) {
    firePlayerBullets.call(this);
    lastFired = time + fireGap;
  }
}

function runFormationPhase(time) {
  if (level >= BOSS_STAGE && !bossBattleStarted) {
    startBossBattle.call(this);
    return;
  }

  if (stageTransitionPending && time >= nextFormationAt && countLivingEnemies() === 0) {
    stageTransitionPending = false;
    spawnFormation.call(this);
    return;
  }

  updateFormationMovement(time);

  if (time > formationFireAt && countLivingEnemies() > 0) {
    formationFireAt = time + Math.max(320, 900 - level * 35);
    fireFromFormation.call(this);
  }

  if (!stageTransitionPending && waveEnemiesRemaining === 0 && countLivingEnemies() === 0) {
    enemyFormation.removeAll();
    if (level === BOSS_STAGE - 1) {
      level = BOSS_STAGE;
      updateHud();
      startBossBattle.call(this);
    } else {
      level += 1;
      updateHud();
      announce.call(this, `STAGE ${level}`);
      nextFormationAt = time + 1200;
      stageTransitionPending = true;
    }
  }
}

function runBossPhase(time) {
  if (!boss || !boss.active) return;

  boss.x += bossDirection * 3.6;
  if (boss.x < 100 || boss.x > GAME_WIDTH - 100) {
    bossDirection *= -1;
  }

  if (time > bossPatternAt) {
    bossPatternAt = time + 1400;
    boss.y = Phaser.Math.Clamp(boss.y + Phaser.Math.Between(-18, 22), 110, 220);
  }

  if (time > bossFireAt) {
    bossFireAt = time + 360;
    bossFire.call(this);
  }

  updateBossBar();
}

function startNewGame() {
  resetRun.call(this, false);
  sceneState = State.PLAYING;
  centerText.setVisible(false);
  helperText.setVisible(false);
  announce.call(this, 'STAGE 1');
  nextFormationAt = 300;
  stageTransitionPending = true;
}

function resetRun(showReady) {
  score = 0;
  lives = 3;
  level = 1;
  waveEnemiesRemaining = 0;
  shield = 0;
  powerLevel = 1;
  rapidUntil = 0;
  stageTransitionPending = false;
  lastFired = 0;
  nextFormationAt = 0;
  formationFireAt = 0;
  bossMaxHp = 0;
  bossFireAt = 0;
  bossPatternAt = 0;
  bossDirection = 1;
  bossDamageCooldownUntil = 0;
  invulnerableUntil = 0;
  touchTargetX = null;
  bossBattleStarted = false;

  clearGroup(playerBullets);
  clearGroup(enemyBullets);
  clearGroup(enemies);
  clearGroup(powerUps);
  enemyFormation.removeAll(true);
  if (boss) {
    boss.destroy();
    boss = null;
  }
  if (bossHitOverlap) {
    bossHitOverlap.destroy();
    bossHitOverlap = null;
  }
  setBossBarVisible(false);

  player.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 78);
  player.setAlpha(1);
  player.clearTint();
  player.setActive(true).setVisible(true);
  player.body.enable = true;

  updateHud();

  if (showReady) {
    sceneState = State.READY;
    centerText.setText('GALAXY DEFENDER\nTAP OR PRESS ENTER').setVisible(true);
    helperText.setText('MOVE: LEFT / RIGHT or A / D\nAUTO FIRE ENABLED\nCOLLECT P / S / L ITEMS').setVisible(true);
  }
}

function spawnFormation() {
  enemyFormation.removeAll();
  stageTransitionPending = false;

  const rows = STAGE_ROWS[level - 1];
  if (!rows) return;
  const cols = 7;
  const startX = 165;
  const startY = 110;
  const spacingX = 82;
  const spacingY = 58;

  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const tier = rows[r];
      const enemy = enemies.get(startX + c * spacingX, startY + r * spacingY, `enemy${tier}`);
      if (!enemy) continue;
      enemy.setTexture(`enemy${tier}`);
      enemy.setActive(true).setVisible(true);
      enemy.body.enable = true;
      enemy.setDepth(3);
      enemy.baseX = startX + c * spacingX;
      enemy.baseY = startY + r * spacingY;
      enemy.row = r;
      enemy.col = c;
      enemy.tier = tier;
      enemy.hp = tier;
      enemy.inFormation = true;
      enemy.diving = false;
      enemy.angleOffset = (c * 0.55) + (r * 0.25);
      enemy.rotation = 0;
      enemy.clearTint();
      enemyFormation.add(enemy);
    }
  }

  waveEnemiesRemaining = rows.length * cols;
  formationFireAt = 1200;
}

function updateFormationMovement(time) {
  const amplitudeX = 78 + Math.min(level * 4, 45);
  const amplitudeY = 14;
  const phase = time * 0.0013;

  enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;

    if (enemy.inFormation) {
      enemy.x = enemy.baseX + Math.sin(phase + enemy.row * 0.45) * amplitudeX;
      enemy.y = enemy.baseY + Math.cos(phase * 1.4 + enemy.col * 0.35) * amplitudeY;
    } else if (enemy.diving) {
      enemy.y += enemy.diveSpeedY;
      enemy.x += enemy.diveSpeedX;
      enemy.rotation += enemy.spinSpeed;
      if (enemy.y > GAME_HEIGHT + 40 || enemy.x < -80 || enemy.x > GAME_WIDTH + 80) {
        resetDivingEnemy(enemy);
      }
    }
  });
}

function fireFromFormation() {
  const shooters = [];
  enemies.children.iterate((enemy) => {
    if (enemy && enemy.active && enemy.inFormation && !enemy.diving) shooters.push(enemy);
  });
  if (shooters.length === 0) return;

  const shooter = Phaser.Utils.Array.GetRandom(shooters);

  if (Math.random() < 0.16) {
    startDive(shooter);
  } else {
    const bullet = enemyBullets.get(shooter.x, shooter.y + 12, 'enemyBullet');
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    bullet.body.enable = true;
    bullet.setDepth(2);
    this.physics.moveTo(bullet, player.x, player.y, 260 + Math.min(level, 9) * 14);
  }
}

function startDive(enemy) {
  if (!enemy || !enemy.active || enemy.diving) return;
  enemy.inFormation = false;
  enemy.diving = true;
  enemy.diveSpeedY = 2.2 + level * 0.18;
  enemy.diveSpeedX = Phaser.Math.Clamp((player.x - enemy.x) * 0.007, -1.6, 1.6);
  enemy.spinSpeed = Phaser.Math.FloatBetween(-0.02, 0.02);
  enemyFormation.remove(enemy);
}

function resetDivingEnemy(enemy) {
  if (!enemy || !enemy.active) return;
  enemy.inFormation = true;
  enemy.diving = false;
  enemy.rotation = 0;
  enemy.x = enemy.baseX;
  enemy.y = enemy.baseY;
  enemy.body.velocity.set(0, 0);
  if (!enemyFormation.list.includes(enemy)) {
    enemyFormation.add(enemy);
  }
}

function startBossBattle() {
  if (bossBattleStarted) return;

  sceneState = State.BOSS;
  bossBattleStarted = true;
  waveEnemiesRemaining = 0;
  stageTransitionPending = false;
  enemyFormation.removeAll();
  clearGroup(enemies);
  clearGroup(enemyBullets);
  announce.call(this, 'STAGE 10 BOSS');

  if (boss) {
    boss.destroy();
    boss = null;
  }
  if (bossHitOverlap) {
    bossHitOverlap.destroy();
    bossHitOverlap = null;
  }

  boss = this.physics.add.image(GAME_WIDTH / 2, 84, 'boss');
  boss.setDepth(4);
  boss.setScale(1.35);
  boss.setAlpha(1);
  boss.setActive(true).setVisible(true);
  boss.body.enable = true;
  boss.hp = 120;
  bossMaxHp = boss.hp;
  bossDamageCooldownUntil = 0;
  boss.body.setSize(128, 72);
  bossHitOverlap = this.physics.add.overlap(playerBullets, boss, onBulletHitEnemy, null, this);
  setBossBarVisible(true);
  updateBossBar();
}

function bossFire() {
  if (!boss || !boss.active) return;

  const spread = [-0.2, -0.07, 0.07, 0.2];
  const count = 4;
  const selected = spread.slice(0, count).map((v, idx, arr) => spread[Math.floor((spread.length - count) / 2) + idx]);

  selected.forEach((offset) => {
    const bullet = enemyBullets.get(boss.x, boss.y + 34, 'enemyBullet');
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    bullet.body.enable = true;
    bullet.setDepth(2);
    bullet.body.velocity.x = offset * 760;
    bullet.body.velocity.y = 340;
  });
}

function firePlayerBullets() {
  const shotConfig = getPlayerShotConfig();
  shotConfig.offsets.forEach((offset, idx) => {
    const bullet = playerBullets.get(player.x + offset, player.y - 28, 'bullet');
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    bullet.body.enable = true;
    bullet.setDepth(2);
    bullet.setTint(shotConfig.tint);
    bullet.setScale(shotConfig.scale);
    bullet.setVelocity(shotConfig.spread[idx] || 0, -shotConfig.speed);
  });
}

function onBulletHitEnemy(bullet, enemy) {
  bullet.disableBody(true, true);

  if (enemy === boss) {
    if (this.time.now < bossDamageCooldownUntil) return;
    bossDamageCooldownUntil = this.time.now + 90;
    boss.hp -= 1;
    emitBurst.call(this, enemy.x, enemy.y, 8);
    updateBossBar();
    if (boss.hp <= 0) {
      score += 1500;
      emitBurst.call(this, enemy.x, enemy.y, 28);
      boss.destroy();
      boss = null;
      bossMaxHp = 0;
      bossBattleStarted = false;
      if (bossHitOverlap) {
        bossHitOverlap.destroy();
        bossHitOverlap = null;
      }
      setBossBarVisible(false);
      updateHud();
      triggerVictory.call(this);
    } else {
      score += 30;
      updateHud();
    }
    return;
  }

  enemy.hp -= 1;
  if (enemy.hp > 0) {
    enemy.setTint(0xffffff);
    this.time.delayedCall(70, () => enemy.clearTint());
    score += 15;
    updateHud();
    return;
  }

  emitBurst.call(this, enemy.x, enemy.y, 12);
  maybeDropEnemyItem.call(this, enemy.x, enemy.y);
  waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);
  enemyFormation.remove(enemy);
  enemy.destroy();
  score += 100;
  updateHud();
}

function onEnemyBulletHitPlayer(playerObj, bullet) {
  bullet.disableBody(true, true);
  damagePlayer.call(this);
}

function onEnemyCrashPlayer(playerObj, enemy) {
  emitBurst.call(this, enemy.x, enemy.y, 10);
  waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);
  enemyFormation.remove(enemy);
  enemy.destroy();
  damagePlayer.call(this);
}

function damagePlayer() {
  if (this.time.now < invulnerableUntil) return;

  if (shield > 0) {
    shield -= 1;
    announce.call(this, 'SHIELD BLOCK');
    invulnerableUntil = this.time.now + 500;
    return;
  }

  lives -= 1;
  invulnerableUntil = this.time.now + 1400;
  emitBurst.call(this, player.x, player.y, 18);

  if (lives <= 0) {
    triggerGameOver.call(this);
  } else {
    powerLevel = Math.max(1, powerLevel - 1);
    updateHud();
  }
}

function onPickupPowerUp(playerObj, item) {
  const kind = item.texture.key;
  item.disableBody(true, true);

  if (kind === 'powerUpP') {
    powerLevel = Math.min(10, powerLevel + 1);
    rapidUntil = this.time.now + 5500;
    announce.call(this, 'POWER UP');
  } else if (kind === 'powerUpS') {
    shield = Math.min(2, shield + 1);
    announce.call(this, 'SHIELD +1');
  } else if (kind === 'powerUpL') {
    lives += 1;
    announce.call(this, 'LIFE +1');
  }
  updateHud();
}

function maybeDropEnemyItem(x, y) {
  const roll = Math.random();
  if (roll < ITEM_DROP_RATES.life) {
    spawnPowerUp.call(this, x, y, 'powerUpL');
    return;
  }
  if (roll < ITEM_DROP_RATES.life + ITEM_DROP_RATES.shield) {
    spawnPowerUp.call(this, x, y, 'powerUpS');
    return;
  }
  if (roll < ITEM_DROP_RATES.life + ITEM_DROP_RATES.shield + ITEM_DROP_RATES.power) {
    spawnPowerUp.call(this, x, y, 'powerUpP');
  }
}

function spawnPowerUp(x, y, key) {
  const item = powerUps.get(x, y, key);
  if (!item) return;
  item.setTexture(key);
  item.setActive(true).setVisible(true);
  item.body.enable = true;
  item.setDepth(2);
  item.setVelocity(0, 110);
}

function triggerGameOver() {
  sceneState = State.GAME_OVER;
  centerText.setText('GAME OVER\nTAP OR PRESS ENTER').setVisible(true);
  helperText.setText(`FINAL SCORE: ${score}`).setVisible(true);
  setBossBarVisible(false);

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('galaxyDefenderBest', String(bestScore));
  }
  updateHud();
}

function triggerVictory() {
  sceneState = State.VICTORY;
  centerText.setText('YOU WIN\nTAP OR PRESS ENTER').setVisible(true);
  helperText.setText(`FINAL SCORE: ${score}`).setVisible(true);
  setBossBarVisible(false);

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('galaxyDefenderBest', String(bestScore));
  }
  updateHud();
}

function updateHud() {
  scoreText.setText(`SCORE: ${score}`);
  bestText.setText(`BEST: ${bestScore}`);
  livesText.setText(`LIVES: ${lives}${shield > 0 ? `  SHIELD:${shield}` : ''}`);
  levelText.setText(`STAGE: ${level}`);
  powerText.setText(`POWER: ${powerLevel}${rapidUntil > 0 ? ' +' : ''}`);
}

function getPlayerShotConfig() {
  if (powerLevel >= 10) {
    return { offsets: [-30, -18, -8, 0, 8, 18, 30], spread: [-150, -90, -35, 0, 35, 90, 150], speed: 740, tint: 0xfef08a, scale: 1.35 };
  }
  if (powerLevel >= 8) {
    return { offsets: [-24, -12, 0, 12, 24], spread: [-120, -55, 0, 55, 120], speed: 710, tint: 0x93c5fd, scale: 1.25 };
  }
  if (powerLevel >= 6) {
    return { offsets: [-20, -10, 0, 10, 20], spread: [-80, -30, 0, 30, 80], speed: 680, tint: 0x67e8f9, scale: 1.18 };
  }
  if (powerLevel >= 4) {
    return { offsets: [-16, 0, 16], spread: [-45, 0, 45], speed: 650, tint: 0xc4b5fd, scale: 1.1 };
  }
  if (powerLevel >= 2) {
    return { offsets: [-10, 10], spread: [-20, 20], speed: 610, tint: 0xbfdbfe, scale: 1.05 };
  }
  return { offsets: [0], spread: [0], speed: 560, tint: 0x93c5fd, scale: 1 };
}

function updateBossBar() {
  if (!boss || !boss.active || bossMaxHp <= 0) return;
  const ratio = Phaser.Math.Clamp(boss.hp / bossMaxHp, 0, 1);
  bossBarFill.width = 258 * ratio;
  bossBarFill.x = (GAME_WIDTH / 2 + 18) - ((258 - bossBarFill.width) / 2);
}

function setBossBarVisible(visible) {
  bossBarLabel.setVisible(visible);
  bossBarBg.setVisible(visible);
  bossBarFill.setVisible(visible);
}

function updatePlayerVisuals(time) {
  if (time < invulnerableUntil) {
    player.setAlpha(Math.floor(time / 80) % 2 === 0 ? 0.35 : 1);
  } else {
    player.setAlpha(1);
  }
}

function announce(text) {
  waveText.setText(text).setAlpha(1).setVisible(true);
  this.tweens.killTweensOf(waveText);
  this.tweens.add({
    targets: waveText,
    alpha: 0,
    y: 78,
    duration: 1100,
    ease: 'Quad.easeOut',
    onStart: () => waveText.setY(110),
  });
}

function emitBurst(x, y, quantity) {
  particles.emitParticleAt(x, y, quantity);
}

function countLivingEnemies() {
  let count = 0;
  enemies.children.iterate((enemy) => {
    if (enemy && enemy.active) count += 1;
  });
  return count;
}

function clearGroup(group) {
  group.children.iterate((child) => {
    if (child) child.disableBody(true, true);
  });
}

function cleanupGroup(group, limit, axis, isLessThan) {
  group.children.iterate((obj) => {
    if (!obj || !obj.active) return;
    if ((isLessThan && obj[axis] < limit) || (!isLessThan && obj[axis] > limit)) {
      obj.disableBody(true, true);
    }
  });
}

function cleanupEnemies(group) {
  group.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;
    if (enemy.y > GAME_HEIGHT + 60 || enemy.x < -100 || enemy.x > GAME_WIDTH + 100) {
      if (enemy.diving) {
        resetDivingEnemy(enemy);
      }
    }
  });
}

function createTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0x030712, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  g.generateTexture('bg', GAME_WIDTH, GAME_HEIGHT);
  g.clear();

  g.fillStyle(0x7dd3fc, 1);
  g.beginPath();
  g.moveTo(24, 2);
  g.lineTo(39, 24);
  g.lineTo(31, 23);
  g.lineTo(27, 40);
  g.lineTo(21, 40);
  g.lineTo(17, 23);
  g.lineTo(9, 24);
  g.closePath();
  g.fillPath();
  g.fillStyle(0xffffff, 1);
  g.beginPath();
  g.moveTo(24, 12);
  g.lineTo(30, 24);
  g.lineTo(18, 24);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x93c5fd, 1);
  g.fillRect(16, 24, 3, 8);
  g.fillRect(29, 24, 3, 8);
  g.fillStyle(0xe0f2fe, 1);
  g.fillRect(23, 24, 2, 10);
  g.fillStyle(0x38bdf8, 1);
  g.fillRoundedRect(21, 23, 6, 12, 3);
  g.fillStyle(0x67e8f9, 1);
  g.beginPath();
  g.moveTo(20, 40);
  g.lineTo(24, 49);
  g.lineTo(28, 40);
  g.closePath();
  g.fillPath();
  g.generateTexture('player', 48, 50);
  g.clear();

  g.fillStyle(0xfb7185, 1);
  g.fillRoundedRect(0, 10, 46, 24, 8);
  g.fillTriangle(6, 10, 16, 0, 20, 10);
  g.fillTriangle(40, 10, 30, 0, 26, 10);
  g.fillStyle(0xfef08a, 1);
  g.fillCircle(23, 22, 5);
  g.fillStyle(0xffedd5, 1);
  g.fillRect(8, 28, 30, 5);
  g.generateTexture('enemy1', 46, 34);
  g.clear();

  g.fillStyle(0xf59e0b, 1);
  g.fillRoundedRect(0, 9, 46, 25, 8);
  g.fillTriangle(6, 11, 16, 0, 20, 11);
  g.fillTriangle(40, 11, 30, 0, 26, 11);
  g.fillStyle(0xfffbeb, 1);
  g.fillCircle(23, 22, 5);
  g.fillStyle(0x7c2d12, 1);
  g.fillRect(7, 27, 32, 6);
  g.lineStyle(2, 0xfef3c7, 1);
  g.strokeRect(11, 13, 24, 14);
  g.generateTexture('enemy2', 46, 34);
  g.clear();

  g.fillStyle(0xa78bfa, 1);
  g.fillRoundedRect(0, 8, 46, 26, 9);
  g.fillTriangle(5, 12, 16, 0, 21, 12);
  g.fillTriangle(41, 12, 30, 0, 25, 12);
  g.fillStyle(0xf5f3ff, 1);
  g.fillCircle(23, 22, 5);
  g.fillStyle(0x312e81, 1);
  g.fillRect(6, 27, 34, 6);
  g.lineStyle(2, 0xe9d5ff, 1);
  g.strokeRect(9, 12, 28, 16);
  g.fillStyle(0xe9d5ff, 1);
  g.fillRect(21, 6, 4, 8);
  g.generateTexture('enemy3', 46, 34);
  g.clear();

  g.fillStyle(0xc084fc, 1);
  g.fillRoundedRect(0, 18, 128, 48, 18);
  g.fillTriangle(16, 18, 38, 0, 54, 18);
  g.fillTriangle(112, 18, 90, 0, 74, 18);
  g.fillStyle(0xfef08a, 1);
  g.fillCircle(64, 38, 10);
  g.fillStyle(0xe879f9, 1);
  g.fillRect(16, 50, 96, 8);
  g.generateTexture('boss', 128, 72);
  g.clear();

  g.fillStyle(0x93c5fd, 1);
  g.fillRoundedRect(0, 0, 6, 22, 3);
  g.generateTexture('bullet', 6, 22);
  g.clear();

  g.fillStyle(0xfca5a5, 1);
  g.fillRoundedRect(0, 0, 6, 18, 3);
  g.generateTexture('enemyBullet', 6, 18);
  g.clear();

  g.fillStyle(0xfef08a, 1);
  g.fillCircle(3, 3, 3);
  g.generateTexture('spark', 6, 6);
  g.clear();

  g.fillStyle(0xffffff, 1);
  g.fillCircle(2, 2, 2);
  g.generateTexture('starSmall', 4, 4);
  g.clear();

  g.fillStyle(0xdbeafe, 1);
  g.fillCircle(3, 3, 3);
  g.generateTexture('starMedium', 6, 6);
  g.clear();

  g.fillStyle(0xbfdbfe, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('starBig', 8, 8);
  g.clear();

  g.fillStyle(0x86efac, 1);
  g.fillRoundedRect(0, 0, 24, 24, 6);
  g.fillStyle(0x14532d, 1);
  g.fillRect(10, 5, 4, 14);
  g.fillRect(5, 10, 14, 4);
  g.generateTexture('powerUpP', 24, 24);
  g.clear();

  g.fillStyle(0xfde68a, 1);
  g.fillRoundedRect(0, 0, 24, 24, 6);
  g.lineStyle(3, 0x854d0e, 1);
  g.strokeCircle(12, 12, 6);
  g.generateTexture('powerUpS', 24, 24);
  g.clear();

  g.fillStyle(0xfca5a5, 1);
  g.fillRoundedRect(0, 0, 24, 24, 6);
  g.fillStyle(0x7f1d1d, 1);
  g.fillRect(10, 4, 4, 16);
  g.fillRect(4, 10, 16, 4);
  g.generateTexture('powerUpL', 24, 24);
  g.clear();
}

function createStarLayer(scene, count, speed, texture) {
  const group = [];
  for (let i = 0; i < count; i += 1) {
    const star = scene.add.image(
      Phaser.Math.Between(0, GAME_WIDTH),
      Phaser.Math.Between(0, GAME_HEIGHT),
      texture
    ).setAlpha(Phaser.Math.FloatBetween(0.4, 1));
    star.speed = speed + Phaser.Math.FloatBetween(-0.08, 0.08);
    star.seed = Math.random() * Math.PI * 2;
    group.push(star);
  }
  return group;
}

function scrollStars(stars, delta) {
  const factor = delta / 16.666;
  stars.forEach((star) => {
    star.y += star.speed * factor;
    if (star.y > GAME_HEIGHT + 8) {
      star.y = -8;
      star.x = Phaser.Math.Between(0, GAME_WIDTH);
    }
  });
}

function bobStars(stars, time) {
  stars.forEach((star, idx) => {
    star.x += Math.sin(time * 0.0004 + star.seed + idx * 0.2) * 0.08;
  });
}

function makeUIText(scene, x, y, text, size, color, bold = false) {
  return scene.add.text(x, y, text, {
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? 'bold' : 'normal',
    stroke: '#000000',
    strokeThickness: 4,
  }).setDepth(10);
}

function loadBestScore() {
  try {
    bestScore = Number(localStorage.getItem('galaxyDefenderBest') || 0);
  } catch (error) {
    bestScore = 0;
  }
}
