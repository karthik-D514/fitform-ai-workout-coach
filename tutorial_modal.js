/**
 * FitForm AI — Tutorial Modal System
 *
 * Clean tutorial interface featuring:
 *  1. Curated tutorial video (YouTube Privacy-Enhanced mode)
 *  2. Step-by-step camera setup tailored to your equipment and room
 *  3. Key form cues & common beginner mistakes
 *  4. Breathing cadence guidance
 */

import { TUTORIALS } from './tutorials.js';

export class TutorialModal {
  constructor() {
    this._buildDOM();
    this._online = navigator.onLine;

    window.addEventListener('online',  () => { this._online = true;  });
    window.addEventListener('offline', () => { this._online = false; });
  }

  _buildDOM() {
    const el = document.createElement('div');
    el.id = 'tutorial_modal_root';
    el.innerHTML = `
      <!-- Backdrop -->
      <div id="tut_backdrop" class="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[60] hidden items-center justify-center p-3">
        <div id="tut_panel" class="relative w-full max-w-3xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">

          <!-- Modal Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900 shrink-0 z-10">
            <div>
              <h2 id="tut_title" class="text-base font-bold text-white leading-tight">Exercise Tutorial</h2>
              <p id="tut_subtitle" class="text-[11px] text-slate-400 mt-0.5">Learn proper technique and camera setup</p>
            </div>
            <button id="tut_close_btn"
              class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-lg leading-none shrink-0"
              aria-label="Close tutorial">✕</button>
          </div>

          <!-- Content Section (Scrollable body) -->
          <div class="flex flex-col lg:flex-row gap-0 overflow-y-auto flex-1">

            <!-- Left: Video & Breathing -->
            <div class="lg:w-1/2 bg-slate-950 flex flex-col justify-between">

              <!-- YouTube embed -->
              <div id="tut_video_wrap" class="relative w-full" style="padding-top:56.25%">
                <iframe id="tut_iframe"
                  class="absolute inset-0 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                  title="Tutorial video"
                  loading="lazy">
                </iframe>
              </div>

              <!-- Offline fallback notice if offline -->
              <div id="tut_offline_msg" class="hidden p-6 text-center text-slate-400 text-xs bg-slate-950 border-b border-slate-800">
                <span class="text-2xl block mb-2">🌐</span>
                Video player requires internet connection. Refer to the form checklist and camera setup guide below.
              </div>

              <!-- Breathing Cue -->
              <div id="tut_breathing" class="p-4 bg-cyan-950/30 border-t border-cyan-800/30 mt-auto">
                <div class="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest mb-1">🫁 Breathing Pattern</div>
                <p id="tut_breathing_text" class="text-xs text-cyan-200 leading-relaxed"></p>
              </div>
            </div>

            <!-- Right: Instructions & Camera Setup -->
            <div class="lg:w-1/2 flex flex-col border-l border-slate-800 bg-slate-900/60">

              <!-- Camera Setup -->
              <div class="p-4 border-b border-slate-800/80">
                <h3 class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span>📷</span> Camera Placement for Your Setup
                </h3>
                <ul id="tut_camera_steps" class="flex flex-col gap-1.5"></ul>
              </div>

              <!-- Key Points -->
              <div class="p-4 border-b border-slate-800/80">
                <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span>✅</span> Technique Checklist
                </h3>
                <ul id="tut_key_points" class="flex flex-col gap-1.5"></ul>
              </div>

              <!-- Common Mistakes -->
              <div class="p-4">
                <h3 class="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span>⚠️</span> Common Mistakes to Avoid
                </h3>
                <ul id="tut_mistakes" class="flex flex-col gap-1.5"></ul>
              </div>
            </div>
          </div>

          <!-- Footer CTA -->
          <div class="px-5 py-3.5 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-900 shrink-0">
            <p class="text-[10px] text-slate-500">Review the posture tips, then start your workout set.</p>
            <button id="tut_start_btn"
              class="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition shrink-0 flex items-center gap-1.5 active:scale-95">
              <span>▶</span> Got It, Start Workout
            </button>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(el);

    // Event listeners
    document.getElementById('tut_close_btn').addEventListener('click', () => this.close());
    document.getElementById('tut_start_btn').addEventListener('click', () => this.close());
    document.getElementById('tut_backdrop').addEventListener('click', (e) => {
      if (e.target === document.getElementById('tut_backdrop')) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  /**
   * Open the tutorial for the given exerciseId.
   */
  open(exerciseId, exerciseName) {
    const tut = TUTORIALS[exerciseId];

    document.getElementById('tut_title').innerText = exerciseName;
    document.getElementById('tut_subtitle').innerText = tut
      ? 'Review form and camera position before starting'
      : 'Tutorial coming soon';

    const backdrop = document.getElementById('tut_backdrop');
    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');

    if (!tut) return;

    // Video setup
    const iframe = document.getElementById('tut_iframe');
    const videoWrap = document.getElementById('tut_video_wrap');
    const offlineMsg = document.getElementById('tut_offline_msg');

    if (tut.youtubeId && this._online) {
      iframe.src = `https://www.youtube-nocookie.com/embed/${tut.youtubeId}?rel=0&modestbranding=1`;
      iframe.title = tut.youtubeTitle || exerciseName;
      videoWrap.style.display = '';
      offlineMsg.classList.add('hidden');
    } else {
      iframe.src = 'about:blank';
      videoWrap.style.display = 'none';
      offlineMsg.classList.remove('hidden');
    }

    // Breathing cue
    document.getElementById('tut_breathing_text').innerText = tut.breathingCue || 'Inhale on the negative, exhale on the positive.';

    // Camera setup steps
    document.getElementById('tut_camera_steps').innerHTML = (tut.cameraSetup || [])
      .map((step) => `<li class="flex items-start gap-2 text-xs text-slate-300 leading-snug">
        <span class="shrink-0 mt-0.5 text-amber-400">›</span><span>${step}</span>
      </li>`).join('');

    // Key points
    document.getElementById('tut_key_points').innerHTML = (tut.keyPoints || [])
      .map((pt) => `<li class="flex items-start gap-2 text-xs text-slate-300 leading-snug">
        <span class="shrink-0 mt-0.5 text-emerald-400">✓</span><span>${pt}</span>
      </li>`).join('');

    // Common mistakes
    document.getElementById('tut_mistakes').innerHTML = (tut.commonMistakes || [])
      .map((m) => `<li class="flex items-start gap-2 text-xs text-rose-300/90 leading-snug">
        <span class="shrink-0 mt-0.5">•</span><span>${m}</span>
      </li>`).join('');
  }

  close() {
    const iframe = document.getElementById('tut_iframe');
    iframe.src = 'about:blank'; // Stop video playback immediately

    const backdrop = document.getElementById('tut_backdrop');
    backdrop.classList.remove('flex');
    backdrop.classList.add('hidden');
  }
}
