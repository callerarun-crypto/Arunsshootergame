const GAME_WIDTH = 960;
const GAME_HEIGHT = 640;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#121212',
  physics: { default:'arcade', arcade:{ debug:false, gravity:{ y:0 } } },
  scene: [BootScene, PlayScene, ShopScene]
};
new Phaser.Game(config);

/* ---------------- BootScene ---------------- */
function BootScene() { Phaser.Scene.call(this,{ key:'BootScene' }); }
BootScene.prototype = Object.create(Phaser.Scene.prototype);
BootScene.prototype.constructor = BootScene;

BootScene.prototype.preload = function() {
  // placeholder for future asset loading
};
BootScene.prototype.create = function() {
  const g = this.add.graphics();
  g.fillStyle(0x66ccff); g.fillCircle(16,16,16); g.generateTexture('player',32,32); g.clear();
  g.fillStyle(0xff6666); g.fillCircle(12,12,12); g.generateTexture('enemy',24,24); g.clear();
  g.fillStyle(0xffff66); g.fillRect(0,0,6,2); g.generateTexture('bullet',6,2); g.clear();
  g.fillStyle(0x66ff99); g.fillRoundedRect(0,0,12,18,4); g.generateTexture('potion',12,18); g.clear();
  g.fillStyle(0x222222); g.fillRect(0,0,64,64); g.generateTexture('floor',64,64); g.clear();
  g.fillStyle(0xffcc33); g.fillCircle(2,2,2); g.generateTexture('particle',4,4); g.clear();
  this.scene.start('PlayScene');
};

/* ---------------- Bullet Class ---------------- */
class Bullet extends Phaser.Physics.Arcade.Image {
  constructor(scene,x,y,angle,damage){
    super(scene,x,y,'bullet');
    scene.add.existing(this); scene.physics.add.existing(this);
    this.setRotation(angle);
    this.damage = damage; this.lifetime = 900;
    scene.physics.velocityFromRotation(angle,700,this.body.velocity);
  }
  preUpdate(time,delta){ super.preUpdate(time,delta); this.lifetime-=delta; if(this.lifetime<=0) this.destroy(); }
}

/* ---------------- PlayScene ---------------- */
function PlayScene(){ Phaser.Scene.call(this,{ key:'PlayScene' }); }
PlayScene.prototype = Object.create(Phaser.Scene.prototype);
PlayScene.prototype.constructor = PlayScene;

PlayScene.prototype.create=function(){
  this.worldWidth=2000; this.worldHeight=1200;
  for(let x=0;x<this.worldWidth;x+=64){ for(let y=0;y<this.worldHeight;y+=64){ this.add.image(x+32,y+32,'floor').setTint(0x141414); } }
  this.player=this.physics.add.sprite(this.worldWidth/2,this.worldHeight/2,'player');
  this.player.setCollideWorldBounds(true); this.player.speed=240; this.player.maxHp=20; this.player.hp=20;
  this.player.attack=8; this.player.potions=1; this.player.score=0; this.player.gold=0; this.player.dashRecharge=0;

  this.cameras.main.setBounds(0,0,this.worldWidth,this.worldHeight);
  this.cameras.main.startFollow(this.player,true,0.08,0.08);

  this.bullets=this.add.group({ classType:Bullet, runChildUpdate:true });
  this.enemies=this.physics.add.group(); this.enemySpawnTimer=0; this.difficulty=1;

  const particles=this.add.particles('particle');
  this.hitEmitter=particles.createEmitter({ speed:{min:-60,max:60}, lifespan:300, on:false });
  this.explosionEmitter=particles.createEmitter({ speed:{min:-160,max:160}, lifespan:600, quantity:20, scale:{start:1.2,end:0}, on:false });

  this.hpText=this.add.text(10,10,'',{ font:'16px monospace', fill:'#fff'}).setScrollFactor(0);
  this.scoreText=this.add.text(10,30,'',{ font:'16px monospace', fill:'#fff'}).setScrollFactor(0);
  this.dashBar=this.add.graphics().setScrollFactor(0);

  this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SHIFT,SPACE,E,Q');
  this.input.on('pointerdown',(p)=>this.shoot(p.worldX,p.worldY));

  this.physics.add.overlap(this.bullets,this.enemies,this.onBulletHit,null,this);
  this.physics.add.overlap(this.player,this.enemies,this.onPlayerHit,null,this);

  this.time.delayedCall(500,()=>this.spawnWave(6));
};

PlayScene.prototype.spawnWave=function(n){
  for(let i=0;i<n;i++){
    const x=Phaser.Math.Between(50,this.worldWidth-50);
    const y=Phaser.Math.Between(50,this.worldHeight-50);
    if(Phaser.Math.Distance.Between(x,y,this.player.x,this.player.y)<180){ i--; continue; }
    const e=this.enemies.create(x,y,'enemy'); e.hp=8+Math.floor(this.difficulty*2); e.speed=60+this.difficulty*10;
  }
  this.difficulty+=0.25;
};

PlayScene.prototype.update=function(time,dt){
  if(!this.player.active) return;
  const up=this.keys.W.isDown||this.keys.UP.isDown;
  const down=this.keys.S.isDown||this.keys.DOWN.isDown;
  const left=this.keys.A.isDown||this.keys.LEFT.isDown;
  const right=this.keys.D.isDown||this.keys.RIGHT.isDown;
  let vx=0,vy=0; if(left)vx--; if(right)vx++; if(up)vy--; if(down)vy++;
  const len=Math.hypot(vx,vy); if(len){vx/=len; vy/=len;}

  if((this.keys.SHIFT.isDown||this.keys.SPACE.isDown)&&this.player.dashRecharge<=0){
    this.player.setVelocity(vx*this.player.speed*3,vy*this.player.speed*3); this.player.dashRecharge=900;
  } else { this.player.setVelocity(vx*this.player.speed,vy*this.player.speed); if(this.player.dashRecharge>0)this.player.dashRecharge-=dt; }

  this.player.setRotation(Phaser.Math.Angle.Between(this.player.x,this.player.y,this.input.activePointer.worldX,this.input.activePointer.worldY));

  this.enemies.getChildren().forEach(e=>{
    const ang=Phaser.Math.Angle.Between(e.x,e.y,this.player.x,this.player.y);
    this.physics.velocityFromRotation(ang,e.speed,e.body.velocity); e.rotation=ang;
  });

  if(time>this.enemySpawnTimer){ this.spawnWave(1); this.enemySpawnTimer=time+Phaser.Math.Clamp(1200-this.difficulty*30,400,2000); }

  this.hpText.setText(`HP: ${this.player.hp}/${this.player.maxHp}  Potions: ${this.player.potions}`);
  this.scoreText.setText(`Kills: ${this.player.score}  Gold: ${this.player.gold}  Attack: ${this.player.attack}`);

  // dash bar
  this.dashBar.clear();
  const ready=(this.player.dashRecharge<=0);
  const pct=Phaser.Math.Clamp(1-this.player.d
