 // SCENA, KAMERA, RENDERER
 const scene = new THREE.Scene();
 scene.background = new THREE.Color(0x000000);

 const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
 camera.position.set(0, 0, 10);
 camera.lookAt(0, 0, 0);

 const renderer = new THREE.WebGLRenderer({ antialias: true });
 renderer.setSize(window.innerWidth, window.innerHeight);
 document.body.appendChild(renderer.domElement);

 // SYMETRYCZNE OGRANICZENIA RUCHU
 const movementBounds = {
   x: 7,
   y: 5
 };

 // ŁADOWANIE MODELU STATKU (GLB)
 const loader = new THREE.GLTFLoader();
 let ship = new THREE.Group();

 loader.load(
   'assets/models/ship.glb',
   (gltf) => {
     console.log('Model załadowany pomyślnie');
     scene.remove(ship);
     ship = gltf.scene;
     ship.scale.set(0.5, 0.5, 0.5);
     ship.rotation.set(-Math.PI, 0, Math.PI);
     scene.add(ship);
   },
   undefined,
   (error) => {
     console.error('Błąd ładowania modelu:', error);
     const body = new THREE.Mesh(
       new THREE.CylinderGeometry(0.2, 0.5, 1.5, 16),
       new THREE.MeshStandardMaterial({ color: 0x00ffcc })
     );
     body.rotation.set(-Math.PI / 2, 0, Math.PI);
     ship.add(body);
     scene.add(ship);
   }
 );

 // OŚWIETLENIE
 const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
 scene.add(ambientLight);

 const dirLight = new THREE.DirectionalLight(0xffffff, 1);
 dirLight.position.set(5, 10, 7.5);
 scene.add(dirLight);

 // DŹWIĘKI
 const boomSound = document.getElementById("boom");
 const pingSound = document.getElementById("ping");
 const backgroundMusic = document.getElementById("backgroundMusic");
 let isMuted = false;
 
 function initAudio() {
   backgroundMusic.volume = 0.3;
   boomSound.volume = 0.7;
   pingSound.volume = 0.5;
   
   document.body.addEventListener('click', () => {
     backgroundMusic.play().catch(e => console.log("Audio play error:", e));
   }, { once: true });
 }

 // ASTEROIDY
 const asteroids = [];
 let spawnInterval = 1000;
 let lastSpawn = 0;
 let asteroidSpeed = 0.05;
 const baseAsteroidSpeed = 0.05;
 const speedIncreaseFactor = 0.0005;
 const baseSpawnInterval = 1000;
 const minSpawnInterval = 200;

 // CZĄSTECZKI GWIAZD
 function createStarfield() {
   const starsGeometry = new THREE.BufferGeometry();
   const starsMaterial = new THREE.PointsMaterial({
     color: 0xffffff,
     size: 0.2,
     sizeAttenuation: true
   });

   const starsCount = 2000;
   const positions = new Float32Array(starsCount * 3);
   
   for (let i = 0; i < starsCount; i++) {
     const i3 = i * 3;
     positions[i3] = (Math.random() - 0.5) * 2000;
     positions[i3 + 1] = (Math.random() - 0.5) * 2000;
     positions[i3 + 2] = (Math.random() - 0.5) * 2000 - 500;
   }

   starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
   const starField = new THREE.Points(starsGeometry, starsMaterial);
   scene.add(starField);
 }
 createStarfield();

 // STEROWANIE
 const move = { left: false, right: false, up: false, down: false };
 const shipSpeed = 0.07;

 document.addEventListener('keydown', e => {
   if (e.key === 'ArrowLeft' || e.key === 'a') move.left = true;
   if (e.key === 'ArrowRight' || e.key === 'd') move.right = true;
   if (e.key === 'ArrowUp' || e.key === 'w') move.up = true;
   if (e.key === 'ArrowDown' || e.key === 's') move.down = true;
   if (e.key === 'r' && gameOver) resetGame();
   if (e.key === 'm') toggleMute();
   if (e.key === 'f') toggleFullscreen();
 });

 document.addEventListener('keyup', e => {
   if (e.key === 'ArrowLeft' || e.key === 'a') move.left = false;
   if (e.key === 'ArrowRight' || e.key === 'd') move.right = false;
   if (e.key === 'ArrowUp' || e.key === 'w') move.up = false;
   if (e.key === 'ArrowDown' || e.key === 's') move.down = false;
 });

 // UI ELEMENTS
 const scoreEl = document.getElementById("score");
 const gameOverEl = document.getElementById("gameOver");
 const finalScoreEl = document.getElementById("finalScore");
 const muteBtn = document.getElementById("muteBtn");
 const fullscreenBtn = document.getElementById("fullscreenBtn");

 let gameOver = false;
 let score = 0;
 let startTime = Date.now();
 let lastPingScore = -1;

 // GENEROWANIE ASTEROID
 function spawnAsteroid() {
   const count = Math.min(1 + Math.floor(score / 500), 5);
   
   for (let i = 0; i < count; i++) {
     const geo = new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.4, 0);
     const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
     const a = new THREE.Mesh(geo, mat);
     
     a.position.x = (Math.random() - 0.5) * movementBounds.x * 2.5;
     a.position.y = (Math.random() - 0.5) * movementBounds.y * 2.5;
     a.position.z = -20 - Math.random() * 10;
     
     scene.add(a);
     asteroids.push(a);
   }
 }

 // KOLIZJE
 function checkCollision(obj1, obj2) {
   const b1 = new THREE.Box3().setFromObject(obj1);
   const b2 = new THREE.Box3().setFromObject(obj2);
   return b1.intersectsBox(b2);
 }

 // RESET GRY
 function resetGame() {
   asteroids.forEach(a => scene.remove(a));
   asteroids.length = 0;
   ship.position.set(0, 0, 0);
   gameOver = false;
   score = 0;
   startTime = Date.now();
   lastPingScore = -1;
   spawnInterval = baseSpawnInterval;
   asteroidSpeed = baseAsteroidSpeed;
   gameOverEl.style.display = 'none';
   
   if (!isMuted) {
     backgroundMusic.currentTime = 0;
     backgroundMusic.play().catch(e => console.log("Music error:", e));
   }
 }

 // MUTE/UNMUTE
 function toggleMute() {
   isMuted = !isMuted;
   backgroundMusic.muted = isMuted;
   boomSound.muted = isMuted;
   pingSound.muted = isMuted;
   muteBtn.textContent = isMuted ? "🔇" : "🔊";
 }

 // FULLSCREEN
 function toggleFullscreen() {
   if (!document.fullscreenElement) {
     document.documentElement.requestFullscreen().catch(err => {
       console.log(`Error attempting to enable fullscreen: ${err.message}`);
     });
   } else {
     if (document.exitFullscreen) {
       document.exitFullscreen();
     }
   }
 }

 // EVENT LISTENERS FOR UI BUTTONS
 muteBtn.addEventListener('click', toggleMute);
 fullscreenBtn.addEventListener('click', toggleFullscreen);

 // ANIMACJA
 function animate() {
   requestAnimationFrame(animate);
   if (gameOver) return;

   const now = Date.now();

   // STEROWANIE
   if (move.left && ship.position.x > -movementBounds.x) ship.position.x -= shipSpeed;
   if (move.right && ship.position.x < movementBounds.x) ship.position.x += shipSpeed;
   if (move.up && ship.position.y < movementBounds.y) ship.position.y += shipSpeed;
   if (move.down && ship.position.y > -movementBounds.y) ship.position.y -= shipSpeed;

   // GENEROWANIE ASTEROID
   if (now - lastSpawn > spawnInterval) {
     spawnAsteroid();
     lastSpawn = now;
     spawnInterval = Math.max(
       minSpawnInterval, 
       baseSpawnInterval - (score * 2)
     );
   }

   // PRĘDKOŚĆ ASTEROID
   asteroidSpeed = baseAsteroidSpeed + (score * speedIncreaseFactor);

   // RUCH ASTEROID I KOLIZJE
   for (let i = asteroids.length - 1; i >= 0; i--) {
     const a = asteroids[i];
     a.position.z += asteroidSpeed;

     if (checkCollision(ship, a)) {
       if (!isMuted) {
         boomSound.currentTime = 0;
         boomSound.play();
       }
       gameOver = true;
       finalScoreEl.textContent = `SCORE: ${score}`;
       gameOverEl.style.display = 'block';
       backgroundMusic.pause();
     }

     if (a.position.z > 5) {
       scene.remove(a);
       asteroids.splice(i, 1);
     }
   }

   // PUNKTACJA
   score = Math.floor((now - startTime) / 100);
   scoreEl.textContent = `SCORE: ${score}`;

   if (score % 100 === 0 && score > 0 && score !== lastPingScore) {
     if (!isMuted) {
       pingSound.currentTime = 0;
       pingSound.play();
     }
     lastPingScore = score;
   }

   renderer.render(scene, camera);
 }

 // START GRY
 initAudio();
 animate();

 // RESPONSYWNOŚĆ
 window.addEventListener('resize', () => {
   camera.aspect = window.innerWidth / window.innerHeight;
   camera.updateProjectionMatrix();
   renderer.setSize(window.innerWidth, window.innerHeight);
 });