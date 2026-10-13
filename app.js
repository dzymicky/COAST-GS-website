'use strict';

const $ = selector => document.querySelector(selector);

const dialog = $('#figure-dialog');
document.addEventListener('click',event=>{
  const link = event.target.closest('a[data-figure]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || typeof dialog.showModal !== 'function') return;
  event.preventDefault();
  $('#dialog-image').src = link.href;
  $('#dialog-image').alt = link.querySelector('img')?.alt || link.dataset.figure;
  $('#dialog-caption').textContent = link.dataset.figure;
  dialog.showModal(); document.body.classList.add('dialog-open');
});
$('#close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{
  if (event.target!==dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom) dialog.close();
});
dialog.addEventListener('close',()=>document.body.classList.remove('dialog-open'));

// Draw decoded video frames onto a normal page surface. This also avoids
// embedded-browser video layers that can advance while presenting a black frame.
const roomVideos = [...document.querySelectorAll('.room-videos video')];
const comparisonVideos = [...document.querySelectorAll('.comparison-videos video')];
[...roomVideos, ...comparisonVideos].forEach(video => {
  const canvas = document.createElement('canvas');
  canvas.className = 'video-canvas';
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  video.parentElement.append(canvas);
  const context = canvas.getContext('2d');
  let frames = 0;
  function paint() {
    if (context && video.readyState >= 2 && video.videoWidth) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.hidden = false;
        canvas.dataset.presentedFrames = ++frames;
        canvas.dataset.mediaTime = video.currentTime.toFixed(3);
      } catch (_) {
        // Keep the native video and its poster available if canvas is unavailable.
        canvas.hidden = true;
      }
    }
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(paint);
    } else {
      requestAnimationFrame(paint);
    }
  }
  paint();
});

// Autoplay continuously, including after the browser restores a hidden tab.
function startRoomVideos() {
  const master = roomVideos[0];
  roomVideos.forEach(video => {
    video.muted = true;
    if (video.error || video.readyState < 2) return;
    if (video !== master && Math.abs(video.currentTime - master.currentTime) > 0.08) {
      video.currentTime = master.currentTime;
    }
    if (video.paused) video.play().catch(() => {});
  });
}

// Each composite scene has its own duration and loops independently.
function startComparisonVideo(video) {
  video.muted = true;
  if (!video.error && video.readyState >= 2 && video.paused) video.play().catch(() => {});
}

function startAllVideos() {
  startRoomVideos();
  comparisonVideos.forEach(startComparisonVideo);
}

roomVideos.forEach(video => video.addEventListener('canplay', startRoomVideos));
comparisonVideos.forEach(video => video.addEventListener('canplay', () => startComparisonVideo(video)));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) startAllVideos();
});
// Some browsers allow autoplay only after the first page interaction.
document.addEventListener('pointerdown', startAllVideos, {once:true, passive:true});
document.addEventListener('keydown', startAllVideos, {once:true});
startAllVideos();

// Correct small drift gently instead of repeatedly seeking through the videos.
setInterval(() => {
  const master = roomVideos[0];
  if (master.paused || master.seeking || !Number.isFinite(master.duration)) return;
  roomVideos.slice(1).forEach(video => {
    if (video.seeking || video.paused || video.error) return;
    let drift = video.currentTime - master.currentTime;
    if (drift > master.duration / 2) drift -= master.duration;
    if (drift < -master.duration / 2) drift += master.duration;
    if (Math.abs(drift) > 0.75) {
      video.currentTime = master.currentTime;
      video.playbackRate = 1;
    } else {
      video.playbackRate = Math.abs(drift) > 0.04 ? (drift > 0 ? 0.98 : 1.02) : 1;
    }
  });
}, 500);
