/**
 * FitForm AI - Guided Warm-Up & Cool-Down Routine Manager (v5 Live Arena)
 *
 * Pre-workout dynamic mobility and post-workout recovery stretches
 * tracked with live camera AI and real-time skeleton pose analysis.
 */

export class RoutineManager {
  constructor(voiceCoach, app = null) {
    this.voiceCoach = voiceCoach;
    this.app = app;
    this.currentRoutine = null;
    this.currentType = 'warmup'; // 'warmup' or 'cooldown'
    this.currentStepIndex = 0;
    this.timerSeconds = 0;
    this.intervalId = null;
    this.savedExerciseId = null;
    this.isActive = false;

    this.WARMUP_STEPS = [
      {
        exerciseId: 'warmup_arm_circles',
        title: 'Arm Circles & Rotations',
        icon: '🔄',
        target: 'Rotator Cuffs, Deltoids & Shoulders',
        duration: 30,
        tip: 'Make wide circular motions with extended arms. 15s forward, then 15s backward.'
      },
      {
        exerciseId: 'warmup_torso_twists',
        title: 'Torso Twists & Spine Mobility',
        icon: '🌪️',
        target: 'Thoracic Spine, Core & Obliques',
        duration: 30,
        tip: 'Stand wide, soft knees. Gently rotate torso side to side with arms swinging freely.'
      },
      {
        exerciseId: 'warmup_air_squats',
        title: 'Mobility Air Squats',
        icon: '🦵',
        target: 'Knees, Hips & Synovial Fluid',
        duration: 30,
        tip: 'Perform smooth rhythmic squats with 1s pause at bottom to prime hip and knee joints.'
      }
    ];

    this.COOLDOWN_STEPS = [
      {
        exerciseId: 'cooldown_quad_stretch',
        title: 'Standing Quad & Hip Stretch',
        icon: '🦿',
        target: 'Quadriceps & Hip Flexors',
        duration: 30,
        tip: 'Hold one ankle behind you toward glutes, chest tall. 15s each leg.'
      },
      {
        exerciseId: 'cooldown_chest_opener',
        title: 'Chest & Shoulder Opener',
        icon: '🚪',
        target: 'Pectorals & Anterior Deltoids',
        duration: 30,
        tip: 'Extend arms wide or clasp hands behind back. Open chest and breathe slowly.'
      },
      {
        exerciseId: 'cooldown_decompression',
        title: 'Spine Decompression & Breathing',
        icon: '🫁',
        target: 'Hamstrings, Lumbar Spine & CNS Recovery',
        duration: 30,
        tip: 'Hinge gently at hips, let head hang relaxed toward floor. Inhale 4s, exhale 6s.'
      }
    ];
  }

  setApp(app) {
    this.app = app;
  }

  async startRoutine(type = 'warmup') {
    if (!this.app) {
      console.error('FitFormApp instance not set on RoutineManager.');
      return;
    }

    this.currentType = type;
    this.currentRoutine = type === 'warmup' ? this.WARMUP_STEPS : this.COOLDOWN_STEPS;
    this.currentStepIndex = 0;
    this.isActive = true;

    // Remember previous exercise so we can restore it when routine finishes
    if (!this.savedExerciseId && this.app.currentExercise) {
      this.savedExerciseId = this.app.currentExercise.id;
    }

    // Switch to Arena tab if user was in another tab
    if (this.app.activeView !== 'view_arena') {
      this.app.switchView('view_arena');
    }

    // Auto-start camera if camera is currently off!
    if (!this.app.isRunning) {
      try {
        await this.app.toggleCamera();
      } catch (err) {
        console.warn('Could not auto-start camera for routine:', err);
      }
    }

    this.showHUD();
    this.runStep();
  }

  showHUD() {
    const hud = document.getElementById('arena_routine_hud');
    if (!hud) return;
    hud.classList.remove('hidden');
    hud.classList.add('flex');

    // Bind HUD buttons if not already bound
    const nextBtn = document.getElementById('routine_hud_next_btn');
    if (nextBtn && !nextBtn._bound) {
      nextBtn._bound = true;
      nextBtn.addEventListener('click', () => this.nextStep());
    }

    const exitBtn = document.getElementById('routine_hud_exit_btn');
    if (exitBtn && !exitBtn._bound) {
      exitBtn._bound = true;
      exitBtn.addEventListener('click', () => this.exitRoutine());
    }
  }

  hideHUD() {
    const hud = document.getElementById('arena_routine_hud');
    if (hud) {
      hud.classList.add('hidden');
      hud.classList.remove('flex');
    }
  }

  runStep() {
    const step = this.currentRoutine[this.currentStepIndex];
    if (!step) {
      this.completeRoutine();
      return;
    }

    this.timerSeconds = step.duration;

    // Switch exercise in arena to the step's exercise
    if (this.app && step.exerciseId) {
      this.app.switchExercise(step.exerciseId);
    }

    // Update HUD elements
    const iconEl = document.getElementById('routine_hud_icon');
    const badgeEl = document.getElementById('routine_hud_badge');
    const titleEl = document.getElementById('routine_hud_title');
    const tipEl = document.getElementById('routine_hud_tip');
    const timerEl = document.getElementById('routine_hud_timer');

    const typeLabel = this.currentType === 'warmup' ? 'WARM-UP' : 'COOL-DOWN';
    const badgeColor = this.currentType === 'warmup'
      ? 'bg-amber-500/30 text-amber-300'
      : 'bg-indigo-500/30 text-indigo-300';

    if (iconEl) iconEl.innerText = step.icon;
    if (badgeEl) {
      badgeEl.className = `text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeColor} font-mono`;
      badgeEl.innerText = `${typeLabel} • MOVEMENT ${this.currentStepIndex + 1} OF ${this.currentRoutine.length}`;
    }
    if (titleEl) titleEl.innerText = step.title;
    if (tipEl) tipEl.innerText = step.tip;
    if (timerEl) timerEl.innerText = `${this.timerSeconds}s`;

    // Voice announcement
    this.voiceCoach?.speak(`${step.title}. ${step.tip}`, true);

    // Run 1-second interval timer
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.timerSeconds--;
      const tEl = document.getElementById('routine_hud_timer');
      if (tEl) tEl.innerText = `${this.timerSeconds}s`;

      if (this.timerSeconds <= 3 && this.timerSeconds > 0) {
        this.voiceCoach?.playCountdownBeep(false);
      } else if (this.timerSeconds <= 0) {
        clearInterval(this.intervalId);
        this.voiceCoach?.playCountdownBeep(true);
        this.currentStepIndex++;
        this.runStep();
      }
    }, 1000);
  }

  nextStep() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.currentStepIndex++;
    this.runStep();
  }

  completeRoutine() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isActive = false;
    this.hideHUD();

    const celebrationMsg = this.currentType === 'warmup'
      ? 'Warm-up completed! Your joints and muscles are primed. Let\'s crush this workout!'
      : 'Cool-down completed! Great recovery session. Rest and hydrate well!';

    this.voiceCoach?.playRepChime();
    this.voiceCoach?.speak(celebrationMsg, true);

    // Return Arena smoothly to user's main exercise
    if (this.savedExerciseId && this.app) {
      this.app.switchExercise(this.savedExerciseId);
      this.savedExerciseId = null;
    }
  }

  exitRoutine() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isActive = false;
    this.hideHUD();
    this.voiceCoach?.speak('Routine stopped.', true);

    // Return to main exercise
    if (this.savedExerciseId && this.app) {
      this.app.switchExercise(this.savedExerciseId);
      this.savedExerciseId = null;
    }
  }

  close() {
    this.exitRoutine();
  }
}
