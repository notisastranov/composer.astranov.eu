function animate() {
  requestAnimationFrame(animate);
  if (!drag) {
    globePivot.rotation.y += idleRoll + trackVelX;
    globePivot.rotation.x += trackVelY;
    globePivot.rotation.x = Math.max(-1.25, Math.min(1.25, globePivot.rotation.x));
    trackVelX *= 0.94;
    trackVelY *= 0.94;
  }
  // pilot pulse to make it alive
  if (window._pilot) {
    const t = Date.now() / 600;
    const s = 1 + Math.sin(t) * 0.12;
    window._pilot.scale.set(s, s, s);

    // Advanced thruster animation (gaming engine glow)
    if (window._pilot.userData.thrusters) {
      const thrustScale = 0.7 + Math.sin(t * 2) * 0.4;
      window._pilot.userData.thrusters.forEach(t => {
        t.scale.set(1, thrustScale, 1);
        t.material.opacity = 0.5 + Math.sin(t * 3) * 0.3;
      });
    }

    // Occasional thruster particle bursts (when pilot active)
    if (Date.now() % 380 < 30 && window._pilot) {
      AIGraphics.spawnEffect(window._pilot.position, 0xff5500, 5, 18);
    }
  }

  // ASTRANOV AI Graphics Engine tick
  AIGraphics.update();
  updateOrbital();

  if (window.AstranovCollectiveIntelligence) {
    ACI.tick();
    ACI.neurons.forEach(n => {
      if (!n.userData) return;
      const t = Date.now() / 700;
      const s = 1 + Math.sin(t + (n.userData.id ? n.userData.id.length : 0)) * 0.07 * Math.min(1.8, n.userData.strength || 1);
      n.scale.set(s, s, s);
    });
  }

  if (window.MapDepict) MapDepict.tick();
  CosmicZoom.update(camera.position.z);
  renderer.render(scene, camera);
}
animate();
ACI.init();
Auth.init();
AciCli.init();
ACIControl.init();
PmrRadio.bindUI();
DrivingView.init();
CosmicZoom.init();
Commerce.loadVendors();
NewsFeed.fetch();
setInterval(() => NewsFeed.tick(), 12000);

// Demo auto show after permissions
setTimeout(() => {
  // auto demo if needed (globe focused)
}, 25000);

// Domain guard
const host = location.hostname || '';
const isOfficial = host === 'astranov.eu' || host.endsWith('.astranov.eu');
const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
if (host && !isOfficial && !isLocal) {
  document.body.innerHTML = '<div style="color:#444;padding:40px;text-align:center;font-family:sans-serif">Available only on authorized Astranov domains</div>';
}

// No panel restore needed - pure globe mode
// me already set as Αξάς above