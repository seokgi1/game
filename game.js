const GAME_WIDTH = 900;
const GAME_HEIGHT = 700;

const State = {
  BOOT: 'boot',
  READY: 'ready',
  PLAYING: 'playing',
  BOSS: 'boss',
  GAME_OVER: 'game_over',
};

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#030712',
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
let wave = 0;
let shield = 0;
let powerLevel = 1;
let rapidUntil = 0;

let scoreText;
let livesText;
let levelText;
let powerText;
let bestText;
let centerText;
let helperText;
let waveText;
let bossHealthText;

let lastFired = 0;
let nextFormationAt = 0;
let formationFireAt = 0;
let nextPowerDropAt = 0;
let boss = null;
let bossFireAt = 0;
let bossPatternAt = 0;
let bossDirection = 1;
let invulnerableUntil = 0;

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
  levelText = makeUIText(this, GAME_WIDTH - 160, 18, 'LEVEL: 1', 20, '#d6ecff', true);
  powerText = makeUIText(this, GAME_WIDTH - 160, 48, 'POWER: 1', 18, '#fff3b0');

  centerText = this.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2 - 70,
    'GALAXY DEFENDER\nPRESS ENTER',
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
    'MOVE: ← → or A / D\nFIRE: SPACE\nCOLLECT P TO UPGRADE / S FOR SHIELD',
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

  bossHealthText = this.add.text(GAME_WIDTH / 2, 20, '', {
    fontSize: '22px',
    color: '#ffb3b3',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5, 0).setDepth(20).setVisible(false);

  cursors = this.input.keyboard.createCursorKeys();
  keys = this.input.keyboard.addKeys('A,D,SPACE');
  enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

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

  if (sceneState === State.READY || sceneState === State.GAME_OVER) {
    if (Phaser.Input.Keyboard.JustDown(enterKey)) {
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
  if (cursors.left.isDown || keys.A.isDown) {
    player.setVelocityX(-390);
  } else if (cursors.right.isDown || keys.D.isDown) {
    player.setVelocityX(390);
  }
}

function handlePlayerFiring(time) {
  const fireGap = time < rapidUntil ? 95 : 175;
  if ((cursors.space.isDown || keys.SPACE.isDown) && time > lastFired) {
    firePlayerBullets.call(this);
    lastFired = time + fireGap;
  }
}

function runFormationPhase(time) {
  if (time >= nextFormationAt && countLivingEnemies() === 0) {
    spawnFormation.call(this);
    nextFormationAt = time + 1000000;
  }

  updateFormationMovement(time);

  if (time > formationFireAt && countLivingEnemies() > 0) {
    formationFireAt = time + Math.max(320, 900 - level * 45);
    fireFromFormation.call(this);
  }

  if (time > nextPowerDropAt && countLivingEnemies() > 0) {
    maybeDropTimedPowerUp.call(this);
    nextPowerDropAt = time + 6000;
  }

  if (countLivingEnemies() === 0 && enemyFormation.list.length > 0) {
    enemyFormation.removeAll(true);
    wave += 1;
    if (wave % 4 === 0) {
      startBossBattle.call(this);
    } else {
      level += 1;
      updateHud();
      announce.call(this, `WAVE ${wave + 1}`);
      nextFormationAt = time + 1200;
    }
  }
}

function runBossPhase(time) {
  if (!boss || !boss.active) return;

  boss.x += bossDirection * (2.2 + level * 0.08);
  if (boss.x < 100 || boss.x > GAME_WIDTH - 100) {
    bossDirection *= -1;
  }

  if (time > bossPatternAt) {
    bossPatternAt = time + 1800;
    boss.y = Phaser.Math.Clamp(boss.y + Phaser.Math.Between(-14, 18), 90, 180);
  }

  if (time > bossFireAt) {
    bossFireAt = time + Math.max(350, 700 - level * 30);
    bossFire.call(this);
  }

  bossHealthText.setText(`BOSS HP: ${boss.hp}`);
}

function startNewGame() {
  resetRun.call(this, false);
  sceneState = State.PLAYING;
  centerText.setVisible(false);
  helperText.setVisible(false);
  announce.call(this, 'WAVE 1');
  nextFormationAt = 300;
}

function resetRun(showReady) {
  score = 0;
  lives = 3;
  level = 1;
  wave = 0;
  shield = 0;
  powerLevel = 1;
  rapidUntil = 0;
  lastFired = 0;
  nextFormationAt = 0;
  formationFireAt = 0;
  nextPowerDropAt = 3000;
  bossFireAt = 0;
  bossPatternAt = 0;
  bossDirection = 1;
  invulnerableUntil = 0;

  clearGroup(playerBullets);
  clearGroup(enemyBullets);
  clearGroup(enemies);
  clearGroup(powerUps);
  enemyFormation.removeAll(true);
  if (boss) {
    boss.destroy();
    boss = null;
  }
  bossHealthText.setVisible(false);

  player.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 78);
  player.setAlpha(1);
  player.clearTint();
  player.setActive(true).setVisible(true);
  player.body.enable = true;

  updateHud();

  if (showReady) {
    sceneState = State.READY;
    centerText.setText('GALAXY DEFENDER\nPRESS ENTER').setVisible(true);
    helperText.setText('MOVE: ← → or A / D\nFIRE: SPACE\nCOLLECT P TO UPGRADE / S FOR SHIELD').setVisible(true);
  }
}

function spawnFormation() {
  enemyFormation.removeAll(true);

  const rows = Math.min(3 + Math.floor(level / 2), 5);
  const cols = 7;
  const startX = 165;
  const startY = 110;
  const spacingX = 82;
  const spacingY = 58;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const enemy = enemies.get(startX + c * spacingX, startY + r * spacingY, 'enemy');
      if (!enemy) continue;
      enemy.setActive(true).setVisible(true);
      enemy.body.enable = true;
      enemy.setDepth(3);
      enemy.baseX = startX + c * spacingX;
      enemy.baseY = startY + r * spacingY;
      enemy.row = r;
      enemy.col = c;
      enemy.hp = 1 + (level >= 6 && r === 0 ? 1 : 0);
      enemy.inFormation = true;
      enemy.diving = false;
      enemy.angleOffset = (c * 0.55) + (r * 0.25);
      enemyFormation.add(enemy);
    }
  }

  formationFireAt = 1200;
  nextPowerDropAt = 5000;
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
      if (enemy.y > GAME_HEIGHT + 40) {
        enemy.destroy();
      }
    }
  });
}

function fireFromFormation() {
  const shooters = [];
  enemies.children.iterate((enemy) => {
    if (enemy && enemy.active) shooters.push(enemy);
  });
  if (shooters.length === 0) return;

  const shooter = Phaser.Utils.Array.GetRandom(shooters);

  if (Math.random() < 0.34) {
    startDive(shooter);
  } else {
    const bullet = enemyBullets.get(shooter.x, shooter.y + 12, 'enemyBullet');
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    bullet.body.enable = true;
    bullet.setDepth(2);
    this.physics.moveTo(bullet, player.x, player.y, 260 + level * 18);
  }
}

function startDive(enemy) {
  if (!enemy || !enemy.active || enemy.diving) return;
  enemy.inFormation = false;
  enemy.diving = true;
  enemy.diveSpeedY = 2.8 + level * 0.32;
  enemy.diveSpeedX = Phaser.Math.Clamp((player.x - enemy.x) * 0.01, -2.4, 2.4);
  enemy.spinSpeed = Phaser.Math.FloatBetween(-0.03, 0.03);
}

function startBossBattle() {
  sceneState = State.BOSS;
  enemyFormation.removeAll(true);
  clearGroup(enemies);
  announce.call(this, 'WARNING: BOSS APPROACHING');

  boss = this.physics.add.image(GAME_WIDTH / 2, 120, 'boss');
  boss.setDepth(4);
  boss.hp = 24 + level * 3;
  boss.body.setSize(120, 72);
  bossHealthText.setVisible(true).setText(`BOSS HP: ${boss.hp}`);
}

function bossFire() {
  if (!boss || !boss.active) return;

  const spread = [-0.22, -0.1, 0, 0.1, 0.22];
  const count = level >= 6 ? 5 : 3;
  const selected = spread.slice(0, count).map((v, idx, arr) => spread[Math.floor((spread.length - count) / 2) + idx]);

  selected.forEach((offset) => {
    const bullet = enemyBullets.get(boss.x, boss.y + 34, 'enemyBullet');
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    bullet.body.enable = true;
    bullet.setDepth(2);
    bullet.body.velocity.x = offset * 900;
    bullet.body.velocity.y = 300 + level * 12;
  });
}

function firePlayerBullets() {
  const offsets = powerLevel >= 3 ? [-16, 0, 16] : powerLevel === 2 ? [-10, 10] : [0];
  offsets.forEach((offset) => {
    const bullet = playerBullets.get(player.x + offset, player.y - 28, 'bullet');
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    bullet.body.enable = true;
    bullet.setDepth(2);
    bullet.setVelocity(0, -560);
  });
}

function onBulletHitEnemy(bullet, enemy) {
  bullet.disableBody(true, true);

  if (enemy === boss) {
    boss.hp -= 1;
    emitBurst.call(this, enemy.x, enemy.y, 8);
    if (boss.hp <= 0) {
      score += 1500;
      emitBurst.call(this, enemy.x, enemy.y, 28);
      boss.destroy();
      boss = null;
      bossHealthText.setVisible(false);
      level += 1;
      updateHud();
      sceneState = State.PLAYING;
      announce.call(this, 'BOSS DEFEATED');
      nextFormationAt = this.time.now + 1500;
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
  if (Math.random() < 0.12) {
    spawnPowerUp.call(this, enemy.x, enemy.y, Math.random() < 0.72 ? 'powerUpP' : 'powerUpS');
  }
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
    powerLevel = Math.min(3, powerLevel + 1);
    rapidUntil = this.time.now + 5000;
    announce.call(this, 'POWER UP');
  } else {
    shield = Math.min(2, shield + 1);
    announce.call(this, 'SHIELD +1');
  }
  updateHud();
}

function maybeDropTimedPowerUp() {
  if (Math.random() < 0.42) {
    spawnPowerUp.call(this, Phaser.Math.Between(120, GAME_WIDTH - 120), 120, Math.random() < 0.6 ? 'powerUpP' : 'powerUpS');
  }
}

function spawnPowerUp(x, y, key) {
  const item = powerUps.get(x, y, key);
  if (!item) return;
  item.setActive(true).setVisible(true);
  item.body.enable = true;
  item.setDepth(2);
  item.setVelocity(0, 110);
}

function triggerGameOver() {
  sceneState = State.GAME_OVER;
  centerText.setText('GAME OVER\nPRESS ENTER').setVisible(true);
  helperText.setText(`FINAL SCORE: ${score}`).setVisible(true);
  bossHealthText.setVisible(false);

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
  levelText.setText(`LEVEL: ${level}`);
  powerText.setText(`POWER: ${powerLevel}${rapidUntil > 0 ? ' +' : ''}`);
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
      enemy.destroy();
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
  g.moveTo(24, 0);
  g.lineTo(48, 32);
  g.lineTo(34, 30);
  g.lineTo(28, 50);
  g.lineTo(20, 50);
  g.lineTo(14, 30);
  g.lineTo(0, 32);
  g.closePath();
  g.fillPath();
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(24, 10, 33, 28, 15, 28);
  g.fillStyle(0x38bdf8, 1);
  g.fillRect(21, 30, 6, 14);
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
  g.generateTexture('enemy', 46, 34);
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
