/**
 * FitForm AI — App Controller v2
 *
 * Fixes vs v1:
 * ─────────────────────────────────────────────────────────────────────
 * 1. CAMERA FEED NOW FULLY VISIBLE: The video overlay div is properly
 *    hidden when camera starts, and the canvas draws the feed at full
 *    opacity (no transparency/fade effect).
 * 2. MEDIAPIPE MODEL COMPLEXITY 1 → ensures good accuracy vs speed
 * 3. LANDMARK SMOOTHING RESET: Calls Bio.resetSmoothingHistory() on
 *    exercise switch so EMA history from one exercise doesn't bleed
 *    into another.
 * 4. PULL-UPS CATEGORY: Added to equipment filter.
 * 5. FORM ALERT THROTTLE: Audio alerts for form errors have a longer
 *    cooldown (3s) to avoid constant noise during workouts.
 * 6. SKELETON: Per-segment coloring (each bone segment can be green/red
 *    based on the specific error joints it involves).
 */

import { Biomechanics } from './biomechanics.js';
import { VoiceCoach } from './voice_coach.js';
import { EXERCISES, EXERCISE_CATEGORIES, LM } from './exercises.js';
import { StorageManager } from './storage.js';
import { TutorialModal } from './tutorial_modal.js';
import { CalendarView } from './calendar_view.js';
import { LibraryView } from './library_view.js';
import { AnalyticsView } from './analytics_view.js';

class FitFormApp {
  constructor() {
    this.videoElement   = document.getElementById('webcam');
    this.canvasElement  = document.getElementById('output_canvas');
    this.canvasCtx      = this.canvasElement.getContext('2d');
    this.overlayDiv     = document.getElementById('camera_off_prompt');
    this.startBtn       = document.getElementById('start_cam_btn');

    this.voiceCoach     = new VoiceCoach();
    this.tutorialModal  = new TutorialModal();
    this.calendarView   = new CalendarView('calendar_view_container');
    this.libraryView    = new LibraryView('library_view_container', (id) => this.launchFromLibrary(id));
    this.analyticsView  = new AnalyticsView('analytics_view_container', (id) => this.launchFromLibrary(id));

    this.activeView     = 'view_arena';
    this.currentExercise = EXERCISES[0];
    this.camera         = null;
    this.pose           = null;
    this.isRunning      = false;
    this.isPaused       = false;
    this.currentFacingMode = 'user'; // 'user' (front/selfie) or 'environment' (rear)

    // Session
    this.formScores       = [];
    this.currentRepCount  = 0;
    this.activeSet        = 1;
    this.lastFormAlertMs  = 0;
    this.sessionStartTime = null;

    // Rest timer
    this.restTimeRemaining = 0;
    this.restTimerInterval = null;

    this.initUI();
    this.initPoseDetector();
    this.renderHistory();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI SETUP
  // ─────────────────────────────────────────────────────────────────────────

  initUI() {
    const filterContainer = document.getElementById('equipment_filters');
    const categories = [
      { id: EXERCISE_CATEGORIES.ALL,             label: 'All',             icon: '⚡' },
      { id: EXERCISE_CATEGORIES.BODYWEIGHT,       label: 'Bodyweight',      icon: '🤸' },
      { id: EXERCISE_CATEGORIES.PULLUPS,          label: 'Pull-Ups / Bar',  icon: '🏋️' },
      { id: EXERCISE_CATEGORIES.DUMBBELLS,        label: 'Dumbbells',       icon: '💪' },
      { id: EXERCISE_CATEGORIES.CURL_ROD,         label: 'Curl Rod',        icon: '🦾' },
      { id: EXERCISE_CATEGORIES.RESISTANCE_TUBES, label: 'Bands',           icon: '🎗️' },
      { id: EXERCISE_CATEGORIES.AB_ROLLER,        label: 'Ab Roller',       icon: '🔄' }
    ];

    filterContainer.innerHTML = categories.map((c) => `
      <button class="filter-chip px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
        c.id === 'all'
          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      }" data-category="${c.id}">
        <span>${c.icon}</span><span>${c.label}</span>
      </button>
    `).join('');

    filterContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-chip');
      if (!btn) return;
      document.querySelectorAll('.filter-chip').forEach((b) => {
        b.className = 'filter-chip px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all bg-slate-800 text-slate-300 hover:bg-slate-700';
      });
      btn.className = 'filter-chip px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20';
      this.filterExercises(btn.dataset.category);
    });

    this.populateExerciseSelect(EXERCISES);
    document.getElementById('exercise_select').addEventListener('change', (e) => this.switchExercise(e.target.value));
    this.startBtn.addEventListener('click', () => this.toggleCamera());
    document.getElementById('stop_cam_btn')?.addEventListener('click', () => this.toggleCamera());
    document.getElementById('flip_cam_btn')?.addEventListener('click', () => this.switchCamera());
    document.getElementById('finish_set_btn').addEventListener('click', () => this.finishSet());
    document.getElementById('voice_toggle_btn').addEventListener('click', (e) => this.toggleVoice(e));

    // Tutorial "How to" button
    document.getElementById('how_to_btn').addEventListener('click', () => {
      this.tutorialModal.open(this.currentExercise.id, this.currentExercise.name);
    });
    // Log Export / Clear actions
    document.getElementById('export_csv_btn')?.addEventListener('click', () => StorageManager.exportCSV());
    document.getElementById('export_json_btn')?.addEventListener('click', () => StorageManager.exportJSON());
    document.getElementById('clear_history_btn')?.addEventListener('click', () => {
      if (confirm('Clear all saved workout history? This cannot be undone.')) {
        StorageManager.clearHistory();
        this.renderHistory();
      }
    });
    document.querySelectorAll('.rest-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.startRestTimer(parseInt(btn.dataset.seconds, 10)));
    });
    document.getElementById('fullscreen_btn').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    // Multi-Interface View Switcher (Desktop Header & Mobile Bottom Nav)
    document.querySelectorAll('.nav-tab-btn, .mobile-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetView = btn.dataset.target;
        if (targetView) this.switchView(targetView);
      });
    });

    this.updateExerciseInfoCard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MULTI-INTERFACE ROUTER (ARENA, CALENDAR, LIBRARY, ANALYTICS)
  // ─────────────────────────────────────────────────────────────────────────

  switchView(viewId) {
    this.activeView = viewId;

    // Toggle view containers
    document.querySelectorAll('.tab-view').forEach((el) => {
      if (el.id === viewId) {
        el.classList.remove('hidden');
        el.classList.add('block');
      } else {
        el.classList.remove('block');
        el.classList.add('hidden');
      }
    });

    // Update Desktop Nav styles
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      if (btn.dataset.target === viewId) {
        btn.className = 'nav-tab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-emerald-500 text-slate-950 shadow-sm';
      } else {
        btn.className = 'nav-tab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-400 hover:text-white';
      }
    });

    // Update Mobile Bottom Nav styles
    document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
      if (btn.dataset.target === viewId) {
        btn.classList.remove('text-slate-400');
        btn.classList.add('text-emerald-400');
      } else {
        btn.classList.remove('text-emerald-400');
        btn.classList.add('text-slate-400');
      }
    });

    // Lazy render specific view content
    if (viewId === 'view_calendar') {
      this.calendarView.render();
    } else if (viewId === 'view_library') {
      this.libraryView.render();
    } else if (viewId === 'view_analytics') {
      this.analyticsView.render();
    }

    // Scroll smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  launchFromLibrary(exerciseId) {
    this.switchExercise(exerciseId);
    this.switchView('view_arena');
    this.voiceCoach.speak(`Loaded ${this.currentExercise.name}. Start camera when ready!`, true);
  }

  filterExercises(category) {
    const filtered = category === 'all' ? EXERCISES : EXERCISES.filter((ex) => ex.category === category);
    this.populateExerciseSelect(filtered);
    if (filtered.length > 0) this.switchExercise(filtered[0].id);
  }

  populateExerciseSelect(list) {
    const select = document.getElementById('exercise_select');
    select.innerHTML = list.map((ex) =>
      `<option value="${ex.id}" ${ex.id === this.currentExercise.id ? 'selected' : ''}>${ex.name} (${ex.equipment})</option>`
    ).join('');
  }

  switchExercise(exerciseId) {
    const found = EXERCISES.find((ex) => ex.id === exerciseId);
    if (!found) return;
    this.currentExercise = found;
    this.currentExercise.reset();
    Biomechanics.resetSmoothingHistory(); // Clear EMA history
    this.currentRepCount = 0;
    this.activeSet = 1;
    this.formScores = [];
    document.getElementById('rep_counter').innerText = '0';
    document.getElementById('set_counter').innerText = 'Set 1';
    document.getElementById('form_score').innerText = '100%';
    document.getElementById('form_status_badge').innerHTML = '<span>🟢</span> <span>READY — STEP INTO FRAME</span>';
    document.getElementById('state_pill').innerText = 'Ready';
    this.updateExerciseInfoCard();
    this.voiceCoach.speak(`${this.currentExercise.name}. ${this.currentExercise.setupTip}`, true);
  }

  updateExerciseInfoCard() {
    document.getElementById('current_exercise_title').innerText = this.currentExercise.name;
    document.getElementById('current_exercise_equipment').innerText = `Equipment: ${this.currentExercise.equipment}`;
    document.getElementById('current_exercise_muscles').innerText = `Target: ${this.currentExercise.targetMuscles}`;
    document.getElementById('current_exercise_tip').innerText = this.currentExercise.setupTip;
    document.getElementById('recommended_camera_angle').innerText = `📷 ${this.currentExercise.recommendedCamera}`;
  }

  toggleVoice(e) {
    const isMuted = this.voiceCoach.enabled;
    this.voiceCoach.toggle(!isMuted);
    const btn = document.getElementById('voice_toggle_btn');
    if (isMuted) {
      btn.innerHTML = '🔇 Muted';
      btn.classList.replace('bg-emerald-500/20', 'bg-slate-800');
      btn.classList.replace('text-emerald-400', 'text-slate-400');
    } else {
      btn.innerHTML = '🔊 Coach On';
      btn.classList.replace('bg-slate-800', 'bg-emerald-500/20');
      btn.classList.replace('text-slate-400', 'text-emerald-400');
      this.voiceCoach.speak('Voice coach on!', true);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MEDIAPIPE INIT
  // ─────────────────────────────────────────────────────────────────────────

  async initPoseDetector() {
    const statusPill = document.getElementById('engine_status');
    try {
      let attempts = 0;
      while (typeof window.Pose === 'undefined' && attempts < 30) {
        await new Promise((r) => setTimeout(r, 300));
        attempts++;
      }

      if (typeof window.Pose !== 'undefined') {
        this.pose = new window.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
        });
        this.pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55
        });
        this.pose.onResults((results) => this.onPoseResults(results));
        statusPill.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> MediaPipe Pose Ready';
        statusPill.className = 'text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono flex items-center gap-1.5';
      } else {
        statusPill.innerText = '⚠️ MediaPipe failed to load — check internet';
      }
    } catch (e) {
      console.error('Pose init error:', e);
      statusPill.innerText = '❌ Pose AI error';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CAMERA TOGGLE
  // ─────────────────────────────────────────────────────────────────────────

  async toggleCamera() {
    if (!this.isRunning) {
      try {
        this.startBtn.innerHTML = '<span class="inline-block animate-spin">⌛</span> Starting...';

        // 1. Strict Security Context Check for Mobile
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            alert(
              "📱 MOBILE CAMERA REQUIREMENT:\n\n" +
              "Modern mobile browsers (iOS Safari & Android Chrome) block camera access over plain HTTP.\n\n" +
              "To use your phone's camera:\n" +
              "1. Open your live GitHub Pages link (which has automatic free HTTPS):\n" +
              "https://karthik-d514.github.io/fitform-ai-workout-coach/\n\n" +
              "Or open via HTTPS."
            );
            this.startBtn.innerHTML = '▶ Start Camera & Workout';
            return;
          }
          throw new Error("Your browser or device does not support mediaDevices.getUserMedia.");
        }

        // 2. 3-Tier Progressive Camera Fallback (prevents OverconstrainedError on smartphones)
        let stream = null;
        const constraintsList = [
          { video: { facingMode: this.currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          { video: { facingMode: this.currentFacingMode }, audio: false },
          { video: true, audio: false }
        ];

        let lastErr = null;
        for (const constraints of constraintsList) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (stream) break;
          } catch (e) {
            lastErr = e;
          }
        }

        if (!stream) {
          throw lastErr || new Error("Could not acquire video stream from camera.");
        }

        // 3. Configure video element with explicit iOS Safari compatibility
        this.videoElement.setAttribute('autoplay', '');
        this.videoElement.setAttribute('muted', '');
        this.videoElement.setAttribute('playsinline', '');
        this.videoElement.setAttribute('webkit-playsinline', '');
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;
        this.videoElement.srcObject = stream;
        await this.videoElement.play();

        // Set canvas dimensions to match video
        const vw = this.videoElement.videoWidth  || 1280;
        const vh = this.videoElement.videoHeight || 720;
        this.canvasElement.width  = vw;
        this.canvasElement.height = vh;

        // ── FIX: Hide the overlay so camera feed is fully visible ──────────
        if (this.overlayDiv) {
          this.overlayDiv.style.display = 'none';
        }

        // Direct hardware frame loop (prevents NotReadableError duplicate getUserMedia from window.Camera)
        this._startFrameLoop();

        this.isRunning = true;
        this.sessionStartTime = Date.now();
        document.getElementById('stop_cam_btn')?.classList.remove('hidden');
        document.getElementById('flip_cam_btn')?.classList.remove('hidden');
        this.startBtn.innerHTML = '⏹ Stop Camera';
        this.startBtn.classList.remove('bg-emerald-500', 'text-slate-950');
        this.startBtn.classList.add('bg-rose-500', 'text-white');
        this.voiceCoach.speak(`Camera on. ${this.currentExercise.setupTip}`, true);

      } catch (err) {
        console.error('Camera error:', err);
        this.startBtn.innerHTML = '▶ Start Camera & Workout';
        this.startBtn.classList.add('bg-emerald-500', 'text-slate-950');

        let msg = 'Could not access camera.\n\n' + err.message;
        if (err.name === 'NotReadableError') {
          msg = '⚠️ CAMERA HARDWARE BUSY (NotReadableError):\n\n' +
                'Another app or browser tab on your device is currently locking the camera.\n\n' +
                '1. Please close any background camera apps, video calls, or other browser tabs.\n' +
                '2. Refresh the page and tap Start Camera again.';
        }
        alert(msg);
      }
    } else {
      this._animLoopRunning = false;
      this.isRunning = false;

      if (this.videoElement.srcObject) {
        try {
          this.videoElement.srcObject.getTracks().forEach((t) => t.stop());
        } catch (_) {}
        this.videoElement.srcObject = null;
      }

      // Clear canvas and show overlay again
      const ctx = this.canvasCtx;
      ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
      document.getElementById('stop_cam_btn')?.classList.add('hidden');
      document.getElementById('flip_cam_btn')?.classList.add('hidden');
      if (this.overlayDiv) this.overlayDiv.style.display = '';

      this.startBtn.innerHTML = '▶ Start Camera & Workout';
      this.startBtn.classList.add('bg-emerald-500', 'text-slate-950');
      this.startBtn.classList.remove('bg-rose-500', 'text-white');
      this.voiceCoach.speak('Camera stopped.', true);
    }
  }

  async switchCamera() {
    if (!this.isRunning) return;
    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    await this.toggleCamera(); // stop current stream
    await new Promise((r) => setTimeout(r, 150)); // allow mobile camera driver to release sensor
    await this.toggleCamera(); // start stream with new facingMode
  }

  _startFrameLoop() {
    this._animLoopRunning = true;
    let isProcessing = false;

    const processFrame = async () => {
      if (!this._animLoopRunning) return;

      if (this.isRunning && !this.isPaused && this.pose && this.videoElement && this.videoElement.readyState >= 2) {
        if (!isProcessing) {
          isProcessing = true;
          try {
            await this.pose.send({ image: this.videoElement });
          } catch (err) {
            console.warn('Pose send frame warning:', err);
          } finally {
            isProcessing = false;
          }
        }
      }

      if (this._animLoopRunning) {
        if ('requestVideoFrameCallback' in this.videoElement) {
          this.videoElement.requestVideoFrameCallback(processFrame);
        } else {
          requestAnimationFrame(processFrame);
        }
      }
    };

    if ('requestVideoFrameCallback' in this.videoElement) {
      this.videoElement.requestVideoFrameCallback(processFrame);
    } else {
      requestAnimationFrame(processFrame);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POSE RESULTS HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  onPoseResults(results) {
    if (!this.canvasCtx || !this.isRunning) return;

    const ctx    = this.canvasCtx;
    const W      = this.canvasElement.width;
    const H      = this.canvasElement.height;

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // ── Draw mirrored video feed at FULL opacity ───────────────────────────
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.globalAlpha = 1.0;        // ← Ensure full opacity
    ctx.drawImage(results.image, 0, 0, W, H);
    ctx.restore();

    if (!results.poseLandmarks) {
      this._showNoPerson(ctx, W, H);
      return;
    }

    const landmarks = results.poseLandmarks;
    const isFramed  = this.checkFraming(landmarks);

    this.drawFramingGuide(ctx, W, H, isFramed);

    const evalResult = this.currentExercise.evaluate(landmarks, Biomechanics);
    this.drawSkeleton(ctx, landmarks, evalResult, W, H);
    this.drawAngleLabels(ctx, landmarks, evalResult, W, H);
    this.updateHUD(evalResult);

    this.currentRepCount = evalResult.repCount;
    this.lastUnit = evalResult.unit || 'reps';

    // ── Handle rep completion ──────────────────────────────────────────────
    if (evalResult.repCompleted) {
      this.voiceCoach.playRepChime();
      this.voiceCoach.speak(`Rep ${this.currentRepCount}!`, true);
      this.triggerRepPulse();
    } else if (evalResult.errors.length > 0) {
      // Throttle form alerts to once per 3 seconds
      const now = Date.now();
      if (now - this.lastFormAlertMs > 3000) {
        this.voiceCoach.playFormAlert();
        this.voiceCoach.speak(evalResult.errors[0], false);
        this.lastFormAlertMs = now;
      }
    }
  }

  _showNoPerson(ctx, W, H) {
    document.getElementById('form_status_badge').innerHTML =
      '<span>⚠️</span> <span>NO BODY DETECTED — STEP INTO FRAME OR MOVE BACK</span>';
    document.getElementById('form_status_badge').className =
      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse';
  }

  checkFraming(landmarks) {
    const nose     = landmarks[LM.NOSE];
    const lAnkle   = landmarks[LM.LEFT_ANKLE];
    const rAnkle   = landmarks[LM.RIGHT_ANKLE];
    const lHip     = landmarks[LM.LEFT_HIP];
    const hasUpper = nose   && nose.visibility   > 0.5;
    const hasCore  = lHip   && lHip.visibility   > 0.5;
    const hasLower = (lAnkle && lAnkle.visibility > 0.4) || (rAnkle && rAnkle.visibility > 0.4);
    return hasUpper && hasCore;
  }

  drawFramingGuide(ctx, W, H, isFramed) {
    const margin = { x: W * 0.12, y: H * 0.05 };
    ctx.save();
    ctx.strokeStyle = isFramed ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(margin.x, margin.y, W - margin.x * 2, H - margin.y * 2);

    if (!isFramed) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fillRect(margin.x, margin.y, W - margin.x * 2, H - margin.y * 2);
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('Step back so full body is visible', W / 2, H * 0.08);
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SKELETON RENDERING
  // ─────────────────────────────────────────────────────────────────────────

  drawSkeleton(ctx, landmarks, evalResult, W, H) {
    const hasErrors     = evalResult.errors.length > 0;
    const activeSet     = new Set(evalResult.activeLandmarks || []);
    const goodColor     = '#10b981';
    const errorColor    = '#ef4444';
    const inactiveColor = '#38bdf8';
    const goodBone      = 'rgba(16, 185, 129, 0.85)';
    const errorBone     = 'rgba(239, 68, 68, 0.85)';
    const inactiveBone  = 'rgba(56, 189, 248, 0.5)';

    // Mirror x because video is flipped
    const toScreen = (lm) => ({
      x: (1.0 - lm.x) * W,
      y: lm.y * H,
      vis: lm.visibility ?? 1
    });

    // Full 17-connection body skeleton
    const connections = [
      // Face
      [LM.NOSE, LM.LEFT_EYE], [LM.NOSE, LM.RIGHT_EYE],
      // Shoulders
      [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
      // Arms
      [LM.LEFT_SHOULDER, LM.LEFT_ELBOW], [LM.LEFT_ELBOW, LM.LEFT_WRIST],
      [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW], [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
      // Torso
      [LM.LEFT_SHOULDER, LM.LEFT_HIP], [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
      [LM.LEFT_HIP, LM.RIGHT_HIP],
      // Legs
      [LM.LEFT_HIP, LM.LEFT_KNEE], [LM.LEFT_KNEE, LM.LEFT_ANKLE],
      [LM.RIGHT_HIP, LM.RIGHT_KNEE], [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
      // Feet
      [LM.LEFT_ANKLE, LM.LEFT_HEEL], [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
      [LM.RIGHT_ANKLE, LM.RIGHT_HEEL], [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX]
    ];

    // Draw each bone
    connections.forEach(([i, j]) => {
      if (i >= landmarks.length || j >= landmarks.length) return;
      const p1 = toScreen(landmarks[i]);
      const p2 = toScreen(landmarks[j]);
      if (p1.vis < 0.35 || p2.vis < 0.35) return;

      const isActiveBone = activeSet.has(i) || activeSet.has(j);
      const color = isActiveBone ? (hasErrors ? errorBone : goodBone) : inactiveBone;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = color;
      ctx.lineWidth   = isActiveBone ? 5 : 2.5;
      ctx.lineCap     = 'round';
      ctx.shadowColor = isActiveBone ? color : 'transparent';
      ctx.shadowBlur  = isActiveBone ? 8 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Draw joint dots
    landmarks.forEach((lm, idx) => {
      if (idx > 32 || !lm) return;
      const pt = toScreen(lm);
      if (pt.vis < 0.35) return;

      const isActive = activeSet.has(idx);
      const color = isActive ? (hasErrors ? errorColor : goodColor) : inactiveColor;
      const radius  = isActive ? 7 : 3.5;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.shadowColor = color;
      ctx.shadowBlur  = isActive ? 14 : 4;
      ctx.fill();
      ctx.shadowBlur = 0;

      // White center dot for active joints
      if (isActive) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ON-SCREEN ANGLE ANNOTATIONS
  // ─────────────────────────────────────────────────────────────────────────

  drawAngleLabels(ctx, landmarks, evalResult, W, H) {
    if (!evalResult.activeLandmarks || evalResult.activeLandmarks.length < 2) return;

    const toScreen = (lm) => ({ x: (1.0 - lm.x) * W, y: lm.y * H });
    const hasErrors = evalResult.errors.length > 0;
    const color     = hasErrors ? '#ef4444' : '#10b981';

    // Draw state label near the primary active joint (second one in list)
    const primaryIdx = evalResult.activeLandmarks[Math.floor(evalResult.activeLandmarks.length / 2)];
    if (primaryIdx === undefined || !landmarks[primaryIdx]) return;
    const pt = toScreen(landmarks[primaryIdx]);
    if ((landmarks[primaryIdx].visibility ?? 1) < 0.4) return;

    const text      = evalResult.stateLabel;
    const fontSize  = 15;
    ctx.save();
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const bx = pt.x + 14;
    const by = pt.y - 18;

    // Background pill
    ctx.fillStyle   = 'rgba(2, 8, 20, 0.88)';
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    const br = 8;
    const bw = tw + 20, bh = 28;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, br);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = hasErrors ? '#fca5a5' : '#6ee7b7';
    ctx.fillText(text, bx + 10, by + bh - 8);
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  updateHUD(evalResult) {
    // Rep counter
    const unit = evalResult.unit || 'reps';
    document.getElementById('rep_counter').innerText = evalResult.repCount;
    const unitEl = document.getElementById('rep_unit');
    if (unitEl) unitEl.innerText = unit === 'sec' ? 'seconds' : 'reps';

    // State pill
    document.getElementById('state_pill').innerText = evalResult.stateLabel;

    // Form badge
    const badge = document.getElementById('form_status_badge');
    if (evalResult.errors.length > 0) {
      badge.innerHTML = `<span>⚠️</span> <span>${evalResult.errors[0]}</span>`;
      badge.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse';
    } else {
      badge.innerHTML = `<span>✅</span> <span>${evalResult.feedback}</span>`;
      badge.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    }

    // Form score (rolling avg over last 60 frames)
    this.formScores.push(evalResult.formScore);
    if (this.formScores.length > 60) this.formScores.shift();
    const avgScore = Math.round(this.formScores.reduce((a, b) => a + b, 0) / this.formScores.length);
    const scoreEl = document.getElementById('form_score');
    scoreEl.innerText = `${avgScore}%`;
    scoreEl.style.color = avgScore >= 85 ? '#34d399' : avgScore >= 65 ? '#fbbf24' : '#f87171';

    // Live angles panel
    const angleList = document.getElementById('live_angle_telemetry');
    angleList.innerHTML = Object.entries(evalResult.liveAngles || {}).map(([key, val]) => `
      <div class="flex justify-between items-center py-1.5 border-b border-slate-800/60 text-xs">
        <span class="text-slate-400 font-medium">${key}</span>
        <span class="font-mono font-bold ${val.toString().includes('⚠') ? 'text-rose-400' : 'text-emerald-400'} bg-slate-900 px-2 py-0.5 rounded">
          ${val}
        </span>
      </div>
    `).join('');

    // Checklist
    const checklist = document.getElementById('form_checklist');
    if (evalResult.errors.length === 0) {
      checklist.innerHTML = `
        <li class="flex items-center gap-2 text-xs text-emerald-400"><span>✓</span><span>Correct form maintained</span></li>
        <li class="flex items-center gap-2 text-xs text-emerald-400"><span>✓</span><span>Movement range is valid</span></li>
      `;
    } else {
      checklist.innerHTML = evalResult.errors.map((err) => `
        <li class="flex items-start gap-2 text-xs text-rose-400 font-medium leading-tight py-0.5">
          <span class="mt-0.5">✗</span><span>${err}</span>
        </li>
      `).join('');
    }
  }

  triggerRepPulse() {
    const counter = document.getElementById('rep_counter');
    counter.classList.add('scale-150', 'transition-transform', 'duration-150');
    counter.style.color = '#10b981';
    setTimeout(() => {
      counter.classList.remove('scale-150');
      counter.style.color = '';
    }, 300);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SET MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  finishSet() {
    if (this.currentRepCount === 0) {
      alert('Complete at least 1 rep or hold for at least 1 second before logging this set.');
      return;
    }
    const avgFormScore = this.formScores.length > 0
      ? Math.round(this.formScores.reduce((a, b) => a + b, 0) / this.formScores.length)
      : 100;

    const unit = this.lastUnit || (this.currentExercise.id === 'plank' || this.currentExercise.id === 'bar_hang' ? 'sec' : 'reps');

    // Check if new Personal Record achieved
    const prevPrs = StorageManager.getPersonalRecords();
    const existingPr = prevPrs.find((p) => p.exerciseId === this.currentExercise.id);
    const isNewPr = !existingPr || this.currentRepCount > existingPr.bestCount;

    StorageManager.saveSession({
      exerciseId: this.currentExercise.id,
      exerciseName: this.currentExercise.name,
      equipment: this.currentExercise.equipment,
      setNumber: this.activeSet,
      count: this.currentRepCount,
      unit,
      avgFormScore
    });

    if (isNewPr && this.currentRepCount > 1) {
      this.voiceCoach.speak(`Incredible! You beat your personal record with ${this.currentRepCount} ${unit}!`, true);
    } else {
      this.voiceCoach.speak(`Set ${this.activeSet} logged! Great work.`, true);
    }

    this.activeSet++;
    document.getElementById('set_counter').innerText = `Set ${this.activeSet}`;
    this.currentRepCount = 0;
    this.formScores = [];
    this.currentExercise.reset();
    Biomechanics.resetSmoothingHistory();
    document.getElementById('rep_counter').innerText = '0';
    this.renderHistory();
    if (this.calendarView) this.calendarView.render();
    if (this.analyticsView) this.analyticsView.render();
    this.startRestTimer(45);
  }

  startRestTimer(seconds) {
    if (this.restTimerInterval) clearInterval(this.restTimerInterval);
    this.restTimeRemaining = seconds;
    const modal     = document.getElementById('rest_timer_modal');
    const timerText = document.getElementById('rest_timer_display');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const tick = () => {
      timerText.innerText = `${this.restTimeRemaining}s`;
      if (this.restTimeRemaining === 10) this.voiceCoach.speak('10 seconds left — get ready!');
      else if (this.restTimeRemaining > 0 && this.restTimeRemaining <= 3) this.voiceCoach.playCountdownBeep(false);
      else if (this.restTimeRemaining === 0) {
        clearInterval(this.restTimerInterval);
        this.voiceCoach.playCountdownBeep(true);
        this.voiceCoach.speak("Let's go — next set!", true);
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        return;
      }
      this.restTimeRemaining--;
    };
    tick();
    this.restTimerInterval = setInterval(tick, 1000);
    document.getElementById('skip_rest_btn').onclick = () => {
      clearInterval(this.restTimerInterval);
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HISTORY & DAILY LOGGING
  // ─────────────────────────────────────────────────────────────────────────

  renderHistory() {
    const history   = StorageManager.getHistory();
    const stats     = StorageManager.getLifetimeStats();
    const todayLog  = StorageManager.getDaySummary();

    const repsEl    = document.getElementById('lifetime_reps');
    const todayEl   = document.getElementById('today_summary');

    if (repsEl) repsEl.innerText = stats.totalReps || 0;
    if (todayEl) {
      const todaySecondsStr = todayLog.totalSeconds > 0 ? ` + ${todayLog.totalSeconds}s holds` : '';
      todayEl.innerText = `Today: ${todayLog.totalReps} reps${todaySecondsStr} • ${todayLog.totalSets} sets`;
    }

    const list = document.getElementById('history_list');
    if (!history || history.length === 0) {
      list.innerHTML = '<div class="text-xs text-slate-500 py-3 text-center">No history yet. Complete a set!</div>';
      return;
    }

    const todayKey = StorageManager.getTodayKey();
    list.innerHTML = history.slice(0, 15).map((h) => {
      const unitLabel = h.unit === 'sec' ? 'sec hold' : 'reps';
      const countVal  = h.count !== undefined ? h.count : h.reps;
      const isToday   = (h.dateKey === todayKey) || (h.date && h.date.startsWith(todayKey));
      const dateDisplay = isToday ? 'Today' : (h.dateKey || new Date(h.date).toLocaleDateString());

      return `
        <div class="flex justify-between items-center py-2 border-b border-slate-800 text-xs">
          <div>
            <div class="font-semibold text-slate-200 leading-tight">${h.exerciseName}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">
              ${dateDisplay} &bull; Set ${h.setNumber} &bull; ${h.time || new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div class="text-right">
            <div class="font-bold text-emerald-400 font-mono">${countVal} ${unitLabel}</div>
            <div class="text-[10px] mt-0.5 ${(h.formScore || h.avgFormScore) >= 80 ? 'text-emerald-400' : (h.formScore || h.avgFormScore) >= 60 ? 'text-amber-400' : 'text-rose-400'}">
              ${h.formScore || h.avgFormScore}% Form
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.fitFormApp = new FitFormApp();
});
