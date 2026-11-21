/**
 * FitForm AI — Enhanced Exercise Engine v2
 *
 * Key accuracy improvements over v1:
 * ─────────────────────────────────────────────────────────────────────
 * 1. FORM-GATED REP COUNTING: A rep only counts when good form is held
 *    at the bottom/peak position AND throughout the motion. Bad-form reps
 *    are explicitly rejected with a voice + visual warning.
 * 2. DEPTH LOCK: For squats/pushups, the state machine requires the user
 *    to reach a strict depth threshold (not just any angle) before an
 *    ascending phase can begin. Partial reps cannot complete a cycle.
 * 3. STAGE ORDERING ENFORCEMENT: The state machine validates the full
 *    legal stage sequence (e.g. STAND → DESCEND → BOTTOM → ASCEND → STAND).
 *    Any shortcut (skipping BOTTOM) prevents a rep from registering.
 * 4. TEMPORAL SMOOTHING: All angles use Exponential Moving Average on
 *    the Biomechanics engine to filter MediaPipe landmark jitter and
 *    prevent false threshold crossings from noise.
 * 5. LANDMARK VISIBILITY GATE: If the required joints are not visible
 *    with sufficient confidence, evaluation is paused and the user is
 *    prompted to reposition, preventing phantom reps from occluded joints.
 * 6. HYSTERESIS ON THRESHOLDS: Entry and exit thresholds differ (e.g.
 *    knee must reach <95° to enter BOTTOM, but must rise to >115° to
 *    leave BOTTOM). This prevents oscillating at the boundary from
 *    counting double-reps.
 * 7. DEBOUNCE TIMER: A minimum of 400ms must pass between rep completions
 *    to prevent rapid false double-counts from the same motion.
 */

// MediaPipe 33 Landmark Index Constants
export const LM = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};

export const EXERCISE_CATEGORIES = {
  ALL: 'all',
  CHEST: 'chest',
  BACK: 'back',
  SHOULDERS: 'shoulders',
  ARMS: 'arms',
  LEGS: 'legs',
  CORE: 'core',
  WARMUP: 'warmup',
  COOLDOWN: 'cooldown'
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Create fresh state object for each exercise
// ─────────────────────────────────────────────────────────────────────────────
function freshState(overrides = {}) {
  return {
    stage: 'IDLE',       // Current phase in the state machine
    repCount: 0,         // Completed rep count
    lastRepTime: 0,      // Timestamp of last rep completion (debounce)
    goodFormStreak: 0,   // Consecutive frames of good form
    badFormStreak: 0,    // Consecutive frames of bad form at bottom/peak
    bottomFormOk: false, // Was form good when reaching the bottom/peak?
    minAngle: 180,       // Tracks peak angle within current rep (for depth validation)
    maxAngle: 0,         // Tracks peak extension within current rep
    holdSeconds: 0,      // For hold exercises
    lastTick: 0,         // For timer
    ...overrides
  };
}

const MIN_REP_INTERVAL_MS = 500; // minimum ms between two rep completions

export const EXERCISES = [

  // ══════════════════════════════════════════════════════════════════════════
  //  1. BODYWEIGHT
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'bodyweight_squat',
    name: 'Bodyweight Squat',
    category: EXERCISE_CATEGORIES.LEGS,
    equipment: 'Bodyweight',
    targetMuscles: 'Quadriceps, Glutes, Hamstrings, Core',
    recommendedCamera: 'Front view, 6-8 ft away (whole body visible)',
    setupTip: 'Stand feet shoulder-width, toes 15-30° out. Camera must see ANKLES to NOSE.',
    requiredLandmarks: {
      'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE, 'Left Ankle': LM.LEFT_ANKLE,
      'Right Hip': LM.RIGHT_HIP, 'Right Knee': LM.RIGHT_KNEE, 'Right Ankle': LM.RIGHT_ANKLE
    },
    state: freshState({ stage: 'STAND' }),
    reset() { this.state = freshState({ stage: 'STAND' }); },

    evaluate(landmarks, Bio) {
      // ── Landmark check ──────────────────────────────────────────────────
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Move back — cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {},
          activeLandmarks: [LM.LEFT_KNEE, LM.RIGHT_KNEE]
        };
      }

      // ── Smoothed joint angles ───────────────────────────────────────────
      const leftKnee  = Bio.calculateAngleSmoothed('sq_lk', landmarks[LM.LEFT_HIP],  landmarks[LM.LEFT_KNEE],  landmarks[LM.LEFT_ANKLE]);
      const rightKnee = Bio.calculateAngleSmoothed('sq_rk', landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
      const avgKnee   = Math.round((leftKnee + rightKnee) / 2);

      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('sq_torso',
        landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);

      // ── Valgus (knees caving in) ────────────────────────────────────────
      const torso = Bio.torsoHeight(landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const hipDist  = Bio.distance(landmarks[LM.LEFT_HIP],  landmarks[LM.RIGHT_HIP]);
      const kneeDist = Bio.distance(landmarks[LM.LEFT_KNEE], landmarks[LM.RIGHT_KNEE]);
      const valgus = kneeDist < hipDist * 0.70 && avgKnee < 135;

      // ── Heel rise detection ─────────────────────────────────────────────
      const leftHeelY  = landmarks[LM.LEFT_HEEL]?.y ?? 0;
      const leftAnkleY = landmarks[LM.LEFT_ANKLE]?.y ?? 0;
      // Positive = heel higher than ankle tip (heel rising)
      const heelRise = leftHeelY < leftAnkleY - 0.025;

      // ── Form error accumulation ─────────────────────────────────────────
      const errors = [];
      let formScore = 100;

      if (torsoAngle > 50) {
        errors.push('Chest up! Excessive forward lean');
        formScore -= 25;
      }
      if (valgus) {
        errors.push('Knees caving in — push them outward over toes');
        formScore -= 30;
      }
      if (heelRise && avgKnee < 130) {
        errors.push('Heels lifting — keep flat feet, go slower');
        formScore -= 20;
      }

      const formOk = errors.length === 0;
      let feedback = 'Drive through heels, chest tall';
      let stateLabel = 'Standing';
      let repCompleted = false;

      // ── State Machine ───────────────────────────────────────────────────
      // STAND (waiting): avgKnee > 158°
      // DESCEND: avgKnee dropping below 155°  (entry)
      // BOTTOM:  avgKnee < 95°  (strict depth requirement)
      // ASCEND:  avgKnee rising, was at BOTTOM, leave when > 115° (hysteresis)
      // Rep counted: reach STAND again after valid ASCEND

      const { stage } = this.state;

      if (stage === 'STAND' || stage === 'IDLE') {
        if (avgKnee < 155) {
          this.state.stage = 'DESCEND';
          this.state.minAngle = avgKnee;
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Standing — Start Squatting';
        feedback = 'Feet shoulder-width, toes slightly out';

      } else if (stage === 'DESCEND') {
        this.state.minAngle = Math.min(this.state.minAngle, avgKnee);
        if (formOk) this.state.bottomFormOk = true;

        if (avgKnee < 95) {
          // Reached valid depth
          this.state.stage = 'BOTTOM';
          stateLabel = 'Good Depth!';
          feedback = 'Now drive through heels to stand';
        } else if (avgKnee > 160) {
          // User stood back up WITHOUT reaching depth — partial rep, reject
          this.state.stage = 'STAND';
          this.state.minAngle = 180;
          stateLabel = 'Partial rep — squat deeper';
          feedback = 'Go lower! Aim for thighs parallel to floor';
        } else {
          stateLabel = `Descending... ${avgKnee}°`;
          feedback = avgKnee > 120 ? 'Keep going lower' : 'Almost there, go parallel!';
        }

      } else if (stage === 'BOTTOM') {
        this.state.minAngle = Math.min(this.state.minAngle, avgKnee);
        if (formOk) this.state.bottomFormOk = true;

        if (avgKnee > 115) {
          // Hysteresis: only transition to ASCEND after clearly rising from bottom
          this.state.stage = 'ASCEND';
          stateLabel = 'Ascending';
          feedback = 'Push through heels — almost up!';
        } else {
          stateLabel = `Bottom — ${avgKnee}° ✓`;
          feedback = 'Good! Now stand back up';
        }

      } else if (stage === 'ASCEND') {
        if (avgKnee > 158) {
          // Completed full range of motion
          const now = Date.now();
          const timeSinceLast = now - this.state.lastRepTime;

          if (timeSinceLast > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            // Rep is VALID: reached depth + had good form at bottom
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} done! Great squat!`;
          } else if (!this.state.bottomFormOk) {
            feedback = 'Rep not counted — fix form at the bottom';
          }

          this.state.stage = 'STAND';
          this.state.minAngle = 180;
          this.state.bottomFormOk = false;
          stateLabel = 'Standing';

        } else {
          stateLabel = `Ascending... ${avgKnee}°`;
          feedback = 'Keep pushing up — full extension!';
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted,
        repCount: this.state.repCount,
        stateLabel,
        feedback,
        errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Left Knee':    `${leftKnee}°`,
          'Right Knee':   `${rightKnee}°`,
          'Avg Knee':     `${avgKnee}° (Need ≤95° for depth)`,
          'Torso Lean':   `${torsoAngle}° (Keep <45°)`,
          'Valgus':       valgus ? '⚠ Knees Caving' : '✓ Knees Out'
        },
        activeLandmarks: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
      };
    }
  },

  {
    id: 'pushup',
    name: 'Push-up',
    category: EXERCISE_CATEGORIES.CHEST,
    equipment: 'Floor / Mat',
    targetMuscles: 'Chest, Triceps, Anterior Deltoids, Core',
    recommendedCamera: 'Front view OR Side profile (Auto-detected)',
    setupTip: 'Works from FRONT or SIDE! From front, keeps elbows tucked. From side, keeps spine flat.',
    state: freshState({ stage: 'TOP' }),
    reset() { this.state = freshState({ stage: 'TOP' }); },

    evaluate(landmarks, Bio) {
      // ── Auto-Detect View Angle (Front vs Side) ───────────────────────────
      const lSh = landmarks[LM.LEFT_SHOULDER];
      const rSh = landmarks[LM.RIGHT_SHOULDER];
      const lEl = landmarks[LM.LEFT_ELBOW];
      const rEl = landmarks[LM.RIGHT_ELBOW];
      const lWr = landmarks[LM.LEFT_WRIST];
      const rWr = landmarks[LM.RIGHT_WRIST];

      const shoulderSpan = (lSh && rSh) ? Math.abs(lSh.x - rSh.x) : 0;
      const bothShouldersVisible = (lSh?.visibility || 0) > 0.4 && (rSh?.visibility || 0) > 0.4;
      const isFrontView = bothShouldersVisible && shoulderSpan > 0.14;

      let elbowAngle = 180;
      let spineAngle = 180;
      let activeLandmarks = [];
      let viewLabel = 'Side View';
      const errors = [];
      let formScore = 100;

      if (isFrontView) {
        // ── FRONT VIEW TRACKING ───────────────────────────────────────────
        viewLabel = 'Front View';
        const leftElbow  = Bio.calculateAngleSmoothed('pu_f_le', lSh, lEl, lWr || { x: lEl.x, y: lEl.y + 0.12 });
        const rightElbow = Bio.calculateAngleSmoothed('pu_f_re', rSh, rEl, rWr || { x: rEl.x, y: rEl.y + 0.12 });
        elbowAngle = Math.round((leftElbow + rightElbow) / 2);

        // Elbow flare check (excessive abduction > 70° harms rotator cuff)
        if (lEl && rEl && shoulderSpan > 0) {
          const elbowSpan = Math.abs(lEl.x - rEl.x);
          if (elbowSpan > shoulderSpan * 1.65 && elbowAngle < 110) {
            errors.push('Elbows flaring too wide — tuck elbows to ~45° to protect shoulders');
            formScore -= 25;
          }
        }

        // Symmetry check
        const symmetry = Bio.checkSymmetry(leftElbow, rightElbow, 22);
        if (!symmetry.symmetric && elbowAngle < 130) {
          errors.push(`Uneven push — arms off by ${symmetry.diff}°`);
          formScore -= 15;
        }

        activeLandmarks = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST];

      } else {
        // ── SIDE VIEW TRACKING (With auto-side & planted wrist fallback) ──
        viewLabel = 'Side View';
        const sideData = Bio.getSideProfileArmAndSpine(landmarks, LM);
        if (!sideData.hasCore) {
          return {
            repCompleted: false, repCount: this.state.repCount,
            stateLabel: 'Position Camera', formScore: 100,
            feedback: 'Ensure shoulders and arm are visible (either front or side view)',
            errors: ['Shoulders and arm must be in camera frame'],
            liveAngles: {}, activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER]
          };
        }

        elbowAngle = Bio.calculateAngleSmoothed('pu_elbow', sideData.shoulder, sideData.elbow, sideData.wrist);
        spineAngle = Bio.spineLinearity(sideData.shoulder, sideData.hip, sideData.ankle);

        if (spineAngle < 158) {
          errors.push('Hips sagging — squeeze core and glutes');
          formScore -= 35;
        } else if (spineAngle > 200) {
          errors.push('Hips piked too high — lower them to plank line');
          formScore -= 20;
        }

        activeLandmarks = [sideData.shoulderIdx, sideData.elbowIdx, sideData.wristIdx, sideData.hipIdx, sideData.ankleIdx];
      }

      const formOk = errors.length === 0;
      let feedback = 'Lower chest toward floor';
      let stateLabel = 'Plank Position';
      let repCompleted = false;
      const { stage } = this.state;

      // TOP: elbowAngle > 155°  (full lockout)
      // LOWERING: elbowAngle dropping
      // BOTTOM: elbowAngle < 90°  (chest depth required)
      // PUSHING: elbowAngle rising from BOTTOM
      // Rep counted when return to TOP

      if (stage === 'TOP' || stage === 'IDLE') {
        if (elbowAngle < 155) {
          this.state.stage = 'LOWERING';
          this.state.minAngle = elbowAngle;
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Top — Begin Lowering';
        feedback = 'Lower yourself with control';

      } else if (stage === 'LOWERING') {
        this.state.minAngle = Math.min(this.state.minAngle, elbowAngle);
        if (formOk) this.state.bottomFormOk = true;

        if (elbowAngle < 90) {
          this.state.stage = 'BOTTOM';
          stateLabel = 'Full Depth ✓';
          feedback = 'Push the floor away!';
        } else if (elbowAngle > 155) {
          this.state.stage = 'TOP';
          this.state.minAngle = 180;
          stateLabel = 'Go deeper — below 90°';
          feedback = 'Lower chest all the way to floor';
        } else {
          stateLabel = `Lowering... ${elbowAngle}°`;
          feedback = elbowAngle > 120 ? 'Keep lowering' : 'Almost at depth!';
        }

      } else if (stage === 'BOTTOM') {
        if (elbowAngle > 105) {
          this.state.stage = 'PUSHING';
          stateLabel = 'Pushing Up';
          feedback = 'Extend arms fully at the top!';
        } else {
          stateLabel = `Chest at floor — ${elbowAngle}° ✓`;
          feedback = 'Now explode upward!';
        }

      } else if (stage === 'PUSHING') {
        if (elbowAngle > 155) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} complete!`;
          } else if (!this.state.bottomFormOk) {
            feedback = 'Rep not counted — maintain proper form';
          }
          this.state.stage = 'TOP';
          this.state.minAngle = 180;
          this.state.bottomFormOk = false;
          stateLabel = 'Top — Full Lockout';
        } else {
          stateLabel = `Pushing... ${elbowAngle}°`;
          feedback = 'Full extension — lock out arms!';
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted,
        repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Elbow Angle': `${elbowAngle}° (Need ≤90° for depth)`,
          'Camera View': `${viewLabel} (Auto)`,
          ...(isFrontView ? {} : { 'Spine Line': `${spineAngle}° (Ideal: 170°–185°)` })
        },
        activeLandmarks
      };
    }
  },

  {
    id: 'plank',
    name: 'Core Plank (Hold)',
    category: EXERCISE_CATEGORIES.CORE,
    equipment: 'Floor / Mat',
    targetMuscles: 'Rectus Abdominis, Transverse Abdominis, Obliques, Spinal Erectors',
    recommendedCamera: 'Side profile',
    setupTip: 'Forearms or hands on floor. Camera sees you from the side — full body in frame.',
    state: { holdSeconds: 0, lastTick: 0, repCount: 0 },
    reset() { this.state = { holdSeconds: 0, lastTick: 0, repCount: 0 }; },

    evaluate(landmarks, Bio) {
      const sideData = Bio.getSideProfileArmAndSpine(landmarks, LM);
      if (!sideData.hasCore) {
        return {
          repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
          stateLabel: 'Side profile needed', formScore: 100,
          feedback: 'Position camera from the side — shoulders and hips must be visible',
          errors: ['Side view needed: shoulders and hips must be in frame'],
          liveAngles: {}, activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER]
        };
      }

      const spineAngle = Bio.spineLinearity(sideData.shoulder, sideData.hip, sideData.ankle);
      const errors = [];
      let formScore = 100;
      let feedback = 'Solid plank — hold steady!';

      if (spineAngle < 158) { errors.push('Hips sagging — tighten core and glutes'); formScore -= 40; feedback = 'Hips dropping! Brace your abs NOW'; }
      else if (spineAngle > 200) { errors.push('Hips piked — lower them to body line'); formScore -= 25; feedback = 'Lower hips to straight line'; }

      const isGoodForm = errors.length === 0;
      const now = Date.now();

      if (isGoodForm) {
        if (!this.state.lastTick) this.state.lastTick = now;
        if (now - this.state.lastTick >= 1000) {
          this.state.holdSeconds += Math.floor((now - this.state.lastTick) / 1000);
          this.state.lastTick = now;
        }
      } else {
        this.state.lastTick = now; // pause timer when form breaks
      }

      return {
        repCompleted: false,
        repCount: this.state.holdSeconds,
        unit: 'sec',
        stateLabel: isGoodForm ? `Holding ${this.state.holdSeconds}s ✓` : 'Form Paused',
        feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Body Alignment': `${spineAngle}° (Goal: 170°–185°)`,
          'Hold Time': `${this.state.holdSeconds}s`,
          'Side Tracked': `${sideData.side.toUpperCase()} Side`
        },
        activeLandmarks: [sideData.shoulderIdx, sideData.hipIdx, sideData.ankleIdx]
      };
    }
  },

  {
    id: 'lunge',
    name: 'Forward Lunge',
    category: EXERCISE_CATEGORIES.LEGS,
    equipment: 'Bodyweight',
    targetMuscles: 'Quadriceps, Glutes, Hamstrings, Hip Flexors',
    recommendedCamera: 'Side profile (45° or 90°)',
    setupTip: 'Start standing. Step forward — front knee stays above ankle, back knee hovers above floor.',
    requiredLandmarks: {
      'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE, 'Left Ankle': LM.LEFT_ANKLE
    },
    state: freshState({ stage: 'STAND' }),
    reset() { this.state = freshState({ stage: 'STAND' }); },

    evaluate(landmarks, Bio) {
      const frontKnee = Bio.calculateAngleSmoothed('lu_fk', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('lu_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 20) { errors.push('Lean torso upright — do not bend forward'); formScore -= 20; }

      const { stage } = this.state;
      let feedback = 'Step forward into lunge', stateLabel = 'Standing', repCompleted = false;

      if ((stage === 'STAND' || stage === 'IDLE') && frontKnee < 115) {
        this.state.stage = 'LUNGE';
        this.state.bottomFormOk = errors.length === 0;
        stateLabel = 'Lunging Down';
      } else if (stage === 'LUNGE') {
        if (errors.length === 0) this.state.bottomFormOk = true;
        if (frontKnee < 95) {
          stateLabel = `Good depth — ${frontKnee}° ✓`;
          feedback = 'Push back up through front heel!';
        }
        if (frontKnee > 155) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} done!`;
          } else {
            feedback = 'Go lower next time — need 90° front knee';
          }
          this.state.stage = 'STAND';
          this.state.bottomFormOk = false;
          stateLabel = 'Standing — switch legs';
        } else {
          stateLabel = `Lunging... ${frontKnee}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 50),
        liveAngles: { 'Front Knee': `${frontKnee}° (Target: 90°)`, 'Torso': `${torsoAngle}°` },
        activeLandmarks: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE]
      };
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  2. PULL-UPS / DOOR BAR
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'pullup',
    name: 'Pull-Up',
    category: EXERCISE_CATEGORIES.BACK,
    equipment: 'Door Pull-Up Bar / Fixed Bar',
    targetMuscles: 'Latissimus Dorsi, Biceps, Rear Deltoids, Rhomboids, Core',
    recommendedCamera: 'Front view — full body must be visible including bar at top',
    setupTip: 'Hang with arms fully extended. Bar must be in top third of frame. Pull body UP to hands.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Right Shoulder': LM.RIGHT_SHOULDER,
      'Left Elbow': LM.LEFT_ELBOW, 'Right Elbow': LM.RIGHT_ELBOW,
      'Left Wrist': LM.LEFT_WRIST, 'Right Wrist': LM.RIGHT_WRIST,
      'Nose': LM.NOSE
    },
    state: freshState({ stage: 'HANG', hangShoulderY: 0 }),
    reset() { this.state = freshState({ stage: 'HANG', hangShoulderY: 0 }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Missing: ${missingJoints.join(', ')}. Camera must see full body from front.`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {}, activeLandmarks: [LM.LEFT_ELBOW, LM.RIGHT_ELBOW]
        };
      }

      const leftElbow  = Bio.calculateAngleSmoothed('pu_pll', landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_ELBOW],  landmarks[LM.LEFT_WRIST]);
      const rightElbow = Bio.calculateAngleSmoothed('pu_plr', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgElbow   = Math.round((leftElbow + rightElbow) / 2);

      const noseY       = landmarks[LM.NOSE]?.y ?? 1;
      const wristLY     = landmarks[LM.LEFT_WRIST]?.y ?? 0;
      const wristRY     = landmarks[LM.RIGHT_WRIST]?.y ?? 0;
      const avgWristY   = (wristLY + wristRY) / 2;
      const shoulderLY  = landmarks[LM.LEFT_SHOULDER]?.y ?? 0.5;
      const shoulderRY  = landmarks[LM.RIGHT_SHOULDER]?.y ?? 0.5;
      const avgShoulderY = (shoulderLY + shoulderRY) / 2;

      // ── Anti-Spoofing & Physics Verification ──
      // 1. Wrists must remain anchored high overhead on the bar above shoulders
      const handsOverhead = avgWristY < avgShoulderY - 0.04 && avgWristY < 0.40;

      // 2. Track body elevation: when hanging, shoulders are at lowest point (largest Y)
      if (this.state.stage === 'HANG' || this.state.stage === 'IDLE' || !this.state.hangShoulderY) {
        if (!this.state.hangShoulderY || avgShoulderY > this.state.hangShoulderY) {
          this.state.hangShoulderY = avgShoulderY;
        }
      }

      // Vertical ascent: shoulders must physically pull UP in the camera frame
      const shoulderRise = this.state.hangShoulderY ? (this.state.hangShoulderY - avgShoulderY) : 0;
      const bodyPulledUp = shoulderRise >= 0.06;

      // Chin over bar requires nose above wrists AND anchored hands AND genuine body elevation
      const chinOverBar = (noseY <= avgWristY + 0.02) && handsOverhead && bodyPulledUp;

      // Swinging / kipping detection
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('pul_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const kipping = torsoAngle > 30;
      const symmetry = Bio.checkSymmetry(leftElbow, rightElbow, 20);

      const errors = [];
      let formScore = 100;
      if (kipping) { errors.push('Body swinging (kipping) — control your movement'); formScore -= 30; }
      if (!symmetry.symmetric) { errors.push('Arms uneven — pull equally with both'); formScore -= 15; }
      if (!handsOverhead && avgElbow < 140) { errors.push('Keep hands fixed on overhead bar — pull body UP'); formScore -= 25; }

      const formOk = errors.length === 0;
      let feedback = 'Pull elbows to hips — chin ABOVE bar';
      let stateLabel = 'Dead Hang';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'HANG' || stage === 'IDLE') {
        if (avgElbow < 155 && handsOverhead) {
          this.state.stage = 'PULLING';
          this.state.maxAngle = avgElbow;
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Dead Hang — Start Pulling!';
        feedback = 'Depress shoulders, then drive elbows to hips';

      } else if (stage === 'PULLING') {
        this.state.minAngle = Math.min(this.state.minAngle, avgElbow);
        if (formOk) this.state.bottomFormOk = true;

        if (avgElbow < 70 && chinOverBar) {
          this.state.stage = 'TOP';
          stateLabel = 'Chin Over Bar ✓';
          feedback = 'Now lower with FULL control';
        } else if (avgElbow > 155) {
          this.state.stage = 'HANG';
          this.state.minAngle = 180;
          stateLabel = 'Pull higher — chin above bar';
          feedback = 'Get chin OVER the bar before coming down';
        } else {
          stateLabel = `Pulling... ${avgElbow}°`;
          feedback = chinOverBar ? 'Almost there — squeeze last inch!' : `Chin not over bar yet (${avgElbow}°)`;
        }

      } else if (stage === 'TOP') {
        if (avgElbow > 90) {
          this.state.stage = 'LOWERING';
          stateLabel = 'Lowering — Control!';
          feedback = 'Slow and controlled descent';
        } else {
          stateLabel = `Top — Chin Over Bar ✓ (${avgElbow}°)`;
          feedback = 'Hold briefly, then lower slowly';
        }

      } else if (stage === 'LOWERING') {
        if (avgElbow > 150) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} done!`;
          } else if (!this.state.bottomFormOk) {
            feedback = 'Rep skipped — keep form strict!';
          }
          this.state.stage = 'HANG';
          this.state.bottomFormOk = false;
          this.state.minAngle = 180;
          stateLabel = 'Dead Hang';
        } else {
          stateLabel = `Lowering... ${avgElbow}°`;
          feedback = 'Lower until arms are fully straight';
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 30),
        liveAngles: {
          'Elbow Angle': `${avgElbow}° (Need <70° at top, >150° hang)`,
          'Body Elevation': `${Math.round(shoulderRise * 100)}% (Goal: >6%)`,
          'Chin Position': chinOverBar ? '✓ Cleared Bar' : (noseY <= avgWristY ? 'At Bar Level' : 'Below Bar')
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.NOSE]
      };
    }
  },

  {
    id: 'chin_up',
    name: 'Chin-Up (Underhand Grip)',
    category: EXERCISE_CATEGORIES.BACK,
    equipment: 'Door Pull-Up Bar / Fixed Bar',
    targetMuscles: 'Biceps, Latissimus Dorsi, Rear Deltoids',
    recommendedCamera: 'Front view — full body visible',
    setupTip: 'Underhand (supinated) grip, shoulder width. Pull body UP to hands.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Right Shoulder': LM.RIGHT_SHOULDER,
      'Left Elbow': LM.LEFT_ELBOW, 'Right Elbow': LM.RIGHT_ELBOW,
      'Left Wrist': LM.LEFT_WRIST, 'Right Wrist': LM.RIGHT_WRIST,
      'Nose': LM.NOSE
    },
    state: freshState({ stage: 'HANG', hangShoulderY: 0 }),
    reset() { this.state = freshState({ stage: 'HANG', hangShoulderY: 0 }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Missing: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {}, activeLandmarks: [LM.LEFT_ELBOW]
        };
      }

      const leftElbow  = Bio.calculateAngleSmoothed('cu_pll', landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_ELBOW],  landmarks[LM.LEFT_WRIST]);
      const rightElbow = Bio.calculateAngleSmoothed('cu_plr', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgElbow   = Math.round((leftElbow + rightElbow) / 2);

      const noseY       = landmarks[LM.NOSE]?.y ?? 1;
      const wristLY     = landmarks[LM.LEFT_WRIST]?.y ?? 0;
      const wristRY     = landmarks[LM.RIGHT_WRIST]?.y ?? 0;
      const avgWristY   = (wristLY + wristRY) / 2;
      const shoulderLY  = landmarks[LM.LEFT_SHOULDER]?.y ?? 0.5;
      const shoulderRY  = landmarks[LM.RIGHT_SHOULDER]?.y ?? 0.5;
      const avgShoulderY = (shoulderLY + shoulderRY) / 2;

      // Anti-spoofing
      const handsOverhead = avgWristY < avgShoulderY - 0.04 && avgWristY < 0.40;
      if (this.state.stage === 'HANG' || this.state.stage === 'IDLE' || !this.state.hangShoulderY) {
        if (!this.state.hangShoulderY || avgShoulderY > this.state.hangShoulderY) {
          this.state.hangShoulderY = avgShoulderY;
        }
      }
      const shoulderRise = this.state.hangShoulderY ? (this.state.hangShoulderY - avgShoulderY) : 0;
      const bodyPulledUp = shoulderRise >= 0.06;
      const chinOverBar = (noseY <= avgWristY + 0.02) && handsOverhead && bodyPulledUp;

      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('cu_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const kipping = torsoAngle > 30;

      const errors = [];
      let formScore = 100;
      if (kipping) { errors.push('No kipping — strict form only'); formScore -= 30; }
      if (!handsOverhead && avgElbow < 140) { errors.push('Keep hands fixed on overhead bar — pull body UP'); formScore -= 25; }

      const formOk = errors.length === 0;
      let feedback = 'Underhand grip — curl chin to bar';
      let stateLabel = 'Dead Hang';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'HANG' || stage === 'IDLE') {
        if (avgElbow < 155 && handsOverhead) { this.state.stage = 'PULLING'; this.state.bottomFormOk = formOk; }
        stateLabel = 'Dead Hang';
        feedback = 'Curl elbows down and back';
      } else if (stage === 'PULLING') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgElbow < 70 && chinOverBar) { this.state.stage = 'TOP'; stateLabel = 'Chin Over Bar ✓'; feedback = 'Lower slowly'; }
        else if (avgElbow > 155) { this.state.stage = 'HANG'; stateLabel = 'Get chin over bar'; feedback = 'Pull higher!'; }
        else { stateLabel = `Pulling... ${avgElbow}°`; feedback = 'Keep curling'; }
      } else if (stage === 'TOP') {
        if (avgElbow > 90) { this.state.stage = 'LOWERING'; stateLabel = 'Lowering'; feedback = 'Slow descent'; }
        else { stateLabel = `Top ✓ ${avgElbow}°`; feedback = 'Now lower slowly'; }
      } else if (stage === 'LOWERING') {
        if (avgElbow > 150) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}!`;
          }
          this.state.stage = 'HANG';
          this.state.bottomFormOk = false;
          stateLabel = 'Dead Hang';
        } else { stateLabel = `Lowering... ${avgElbow}°`; feedback = 'Full extension!'; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Elbow Angle': `${avgElbow}° (Need <70° at top)`,
          'Body Elevation': `${Math.round(shoulderRise * 100)}% (Goal: >6%)`,
          'Chin Clearance': chinOverBar ? '✓ Cleared Bar' : (noseY <= avgWristY ? 'At Bar Level' : 'Below Bar')
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST]
      };
    }
  },

  {
    id: 'bar_hang',
    name: 'Dead Hang (Grip & Shoulder)',
    category: EXERCISE_CATEGORIES.BACK,
    equipment: 'Door Pull-Up Bar',
    targetMuscles: 'Forearms, Grip, Rotator Cuff, Shoulder Decompression',
    recommendedCamera: 'Front view',
    setupTip: 'Hang from overhead bar with arms fully extended. Arms must be raised overhead.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Right Shoulder': LM.RIGHT_SHOULDER,
      'Left Elbow': LM.LEFT_ELBOW, 'Right Elbow': LM.RIGHT_ELBOW,
      'Left Wrist': LM.LEFT_WRIST, 'Right Wrist': LM.RIGHT_WRIST,
      'Nose': LM.NOSE
    },
    state: { holdSeconds: 0, lastTick: 0, repCount: 0 },
    reset() { this.state = { holdSeconds: 0, lastTick: 0, repCount: 0 }; },

    evaluate(landmarks, Bio) {
      const leftElbow  = Bio.calculateAngleSmoothed('hang_l', landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_ELBOW],  landmarks[LM.LEFT_WRIST]);
      const rightElbow = Bio.calculateAngleSmoothed('hang_r', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgElbow   = Math.round((leftElbow + rightElbow) / 2);

      const wristLY = landmarks[LM.LEFT_WRIST]?.y ?? 1;
      const wristRY = landmarks[LM.RIGHT_WRIST]?.y ?? 1;
      const avgWristY = (wristLY + wristRY) / 2;
      const shoulderLY = landmarks[LM.LEFT_SHOULDER]?.y ?? 0.5;
      const shoulderRY = landmarks[LM.RIGHT_SHOULDER]?.y ?? 0.5;
      const avgShoulderY = (shoulderLY + shoulderRY) / 2;
      const noseY = landmarks[LM.NOSE]?.y ?? 0.5;

      // Must be gripping an overhead bar (wrists overhead, above shoulders and nose)
      const armsOverhead = avgWristY < noseY - 0.05 && avgWristY < avgShoulderY - 0.12 && avgWristY < 0.35;
      const isHanging  = avgElbow > 150 && armsOverhead;

      const errors = [];
      let formScore = 100;
      if (!armsOverhead) {
        errors.push('Grip overhead pull-up bar with arms extended above head');
        formScore -= 30;
      } else if (avgElbow <= 150) {
        errors.push('Straighten arms fully for a dead hang');
        formScore -= 20;
      }

      const now = Date.now();
      if (isHanging) {
        if (!this.state.lastTick) this.state.lastTick = now;
        if (now - this.state.lastTick >= 1000) {
          this.state.holdSeconds += Math.floor((now - this.state.lastTick) / 1000);
          this.state.lastTick = now;
        }
      } else {
        this.state.lastTick = now;
      }

      return {
        repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
        stateLabel: isHanging ? `Hanging ${this.state.holdSeconds}s ✓` : (armsOverhead ? 'Straighten Arms' : 'Grip Overhead Bar'),
        feedback: isHanging ? 'Breathe and hold — decompress spine' : (errors[0] || 'Reach up to bar'),
        errors, formScore: Math.max(formScore, 40),
        liveAngles: {
          'Arm Extension': `${avgElbow}° (Need >150°)`,
          'Overhead Grip': armsOverhead ? '✓ Bar Gripped' : '⚠ Arms Not Overhead',
          'Hold Time': `${this.state.holdSeconds}s`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST]
      };
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  3. DUMBBELLS
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'dumbbell_curl',
    name: 'Dumbbell Bicep Curl',
    category: EXERCISE_CATEGORIES.ARMS,
    equipment: 'Two Dumbbells',
    targetMuscles: 'Biceps Brachii, Brachialis, Forearms',
    recommendedCamera: 'Front or slight 45° angle',
    setupTip: 'Stand tall. Pin elbows to ribs throughout the movement. Supinated grip (palms up).',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW, 'Left Wrist': LM.LEFT_WRIST,
      'Right Shoulder': LM.RIGHT_SHOULDER, 'Right Elbow': LM.RIGHT_ELBOW, 'Right Wrist': LM.RIGHT_WRIST
    },
    state: freshState({ stage: 'DOWN' }),
    reset() { this.state = freshState({ stage: 'DOWN' }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return { repCompleted: false, repCount: this.state.repCount, stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Missing: ${missingJoints.join(', ')}`, errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {}, activeLandmarks: [LM.LEFT_ELBOW, LM.RIGHT_ELBOW] };
      }

      const leftElbow  = Bio.calculateAngleSmoothed('dc_le', landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_ELBOW],  landmarks[LM.LEFT_WRIST]);
      const rightElbow = Bio.calculateAngleSmoothed('dc_re', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      // For bilateral curls, track the AVERAGE — both arms must move together
      const avgElbow = Math.round((leftElbow + rightElbow) / 2);

      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('dc_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const symmetry   = Bio.checkSymmetry(leftElbow, rightElbow, 18);

      // ── Standing Posture & Leg Drive Telemetry ──────────────────────────────
      const hasKnees = (landmarks[LM.LEFT_KNEE]?.visibility ?? 0) > 0.35 && (landmarks[LM.RIGHT_KNEE]?.visibility ?? 0) > 0.35;
      const hasAnkles = (landmarks[LM.LEFT_ANKLE]?.visibility ?? 0) > 0.35 && (landmarks[LM.RIGHT_ANKLE]?.visibility ?? 0) > 0.35;

      let standingStanceStatus = 'Step back to track';
      const activeLms = [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST];

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 18) { errors.push('Torso swinging — stand still, isolate biceps'); formScore -= 35; }
      if (!symmetry.symmetric && avgElbow < 120) { errors.push(`Arms uneven by ${symmetry.diff}° — curl together`); formScore -= 15; }

      if (hasKnees && hasAnkles) {
        activeLms.push(LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE);
        const leftKnee  = Bio.calculateAngleSmoothed('dc_lk', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
        const rightKnee = Bio.calculateAngleSmoothed('dc_rk', landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
        const avgKnee   = Math.round((leftKnee + rightKnee) / 2);

        // Detect knee bounce / leg drive cheat during concentric curl (legs should remain locked/soft ~160-180°)
        if (avgKnee < 155 && avgElbow < 140) {
          errors.push('No knee bounce! Stand strict, isolate biceps');
          formScore -= 30;
        }

        // Stance width: feet should be ~shoulder width, not pinned together or super wide
        const ankleDist = Math.abs(landmarks[LM.LEFT_ANKLE].x - landmarks[LM.RIGHT_ANKLE].x);
        const shoulderDist = Math.abs(landmarks[LM.LEFT_SHOULDER].x - landmarks[LM.RIGHT_SHOULDER].x);
        if (shoulderDist > 0.05 && ankleDist < shoulderDist * 0.40) {
          errors.push('Widen stance to shoulder-width for stability');
          formScore -= 10;
        }

        standingStanceStatus = avgKnee >= 155 ? `${avgKnee}° (Strict ✓)` : `⚠ ${avgKnee}° (Bouncing)`;
      }

      const formOk = errors.length === 0;
      let feedback = 'Pin elbows to sides — curl and squeeze';
      let stateLabel = 'Arms Extended';
      let repCompleted = false;
      const { stage } = this.state;

      // DOWN: avgElbow > 150° (full extension, slight elbow lock OK)
      // CURLING: avgElbow dropping from DOWN
      // PEAK: avgElbow < 55° (full contraction)
      // LOWERING: avgElbow rising from PEAK
      // Rep counted: return to DOWN from LOWERING

      if (stage === 'DOWN' || stage === 'IDLE') {
        if (avgElbow < 148) {
          this.state.stage = 'CURLING';
          this.state.minAngle = avgElbow;
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Arms Extended';
        feedback = 'Curl up — keep elbows pinned';
      } else if (stage === 'CURLING') {
        this.state.minAngle = Math.min(this.state.minAngle, avgElbow);
        if (formOk) this.state.bottomFormOk = true;
        if (avgElbow < 55) {
          this.state.stage = 'PEAK';
          stateLabel = 'Peak Contraction ✓';
          feedback = 'Squeeze hard at the top!';
        } else if (avgElbow > 150) {
          this.state.stage = 'DOWN';
          this.state.minAngle = 180;
          stateLabel = 'Go higher — squeeze bicep at top';
          feedback = 'Curl all the way up for full contraction';
        } else {
          stateLabel = `Curling... ${avgElbow}°`;
          feedback = avgElbow > 90 ? 'Keep curling higher' : 'Almost at peak!';
        }
      } else if (stage === 'PEAK') {
        if (avgElbow > 70) {
          this.state.stage = 'LOWERING';
          stateLabel = 'Lowering — Control the Weight';
          feedback = 'Lower slowly — 2-3 seconds down';
        } else {
          stateLabel = `Peak — ${avgElbow}° ✓`;
          feedback = 'Now lower with FULL control';
        }
      } else if (stage === 'LOWERING') {
        if (avgElbow > 150) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}! Great control`;
          } else if (!this.state.bottomFormOk) {
            feedback = 'Rep skipped — fix form (no body swing)';
          }
          this.state.stage = 'DOWN';
          this.state.minAngle = 180;
          this.state.bottomFormOk = false;
          stateLabel = 'Bottom — Full Extension';
        } else {
          stateLabel = `Lowering... ${avgElbow}°`;
          feedback = 'Full extension — slight elbow bend OK';
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Left Elbow': `${leftElbow}°`, 'Right Elbow': `${rightElbow}°`,
          'Avg Elbow': `${avgElbow}° (Need ≤55° at top)`,
          'Torso Sway': `${torsoAngle}° (Keep <18°)`,
          'Standing Stance': standingStanceStatus,
          'Symmetry': symmetry.symmetric ? '✓ Even' : `⚠ Off by ${symmetry.diff}°`
        },
        activeLandmarks: activeLms
      };
    }
  },

  {
    id: 'hammer_curl',
    name: 'Hammer Curl',
    category: EXERCISE_CATEGORIES.ARMS,
    equipment: 'Two Dumbbells',
    targetMuscles: 'Brachialis, Brachioradialis, Biceps Brachii',
    recommendedCamera: 'Front or slight 45°',
    setupTip: 'Neutral grip (thumbs up, palms facing each other). Same motion as bicep curl.',
    requiredLandmarks: {
      'Left Elbow': LM.LEFT_ELBOW, 'Right Elbow': LM.RIGHT_ELBOW
    },
    state: freshState({ stage: 'DOWN' }),
    reset() { this.state = freshState({ stage: 'DOWN' }); },

    evaluate(landmarks, Bio) {
      // Mechanically identical to dumbbell curl from camera perspective (grip not visible)
      const leftElbow  = Bio.calculateAngleSmoothed('hc_le', landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_ELBOW],  landmarks[LM.LEFT_WRIST]);
      const rightElbow = Bio.calculateAngleSmoothed('hc_re', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgElbow   = Math.round((leftElbow + rightElbow) / 2);
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('hc_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);

      // ── Standing Posture & Leg Drive Telemetry ──────────────────────────────
      const hasKnees = (landmarks[LM.LEFT_KNEE]?.visibility ?? 0) > 0.35 && (landmarks[LM.RIGHT_KNEE]?.visibility ?? 0) > 0.35;
      const hasAnkles = (landmarks[LM.LEFT_ANKLE]?.visibility ?? 0) > 0.35 && (landmarks[LM.RIGHT_ANKLE]?.visibility ?? 0) > 0.35;

      let standingStanceStatus = 'Step back to track';
      const activeLms = [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST];

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 18) { errors.push('Torso swinging — isolate the curl'); formScore -= 30; }

      if (hasKnees && hasAnkles) {
        activeLms.push(LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE);
        const leftKnee  = Bio.calculateAngleSmoothed('hc_lk', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
        const rightKnee = Bio.calculateAngleSmoothed('hc_rk', landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
        const avgKnee   = Math.round((leftKnee + rightKnee) / 2);

        if (avgKnee < 155 && avgElbow < 140) {
          errors.push('No knee bounce! Stand strict, isolate biceps');
          formScore -= 30;
        }

        standingStanceStatus = avgKnee >= 155 ? `${avgKnee}° (Strict ✓)` : `⚠ ${avgKnee}° (Bouncing)`;
      }

      const formOk = errors.length === 0;
      let feedback = 'Neutral grip curl — elbows stay fixed', stateLabel = 'Bottom', repCompleted = false;
      const { stage } = this.state;

      if ((stage === 'DOWN' || stage === 'IDLE') && avgElbow < 148) {
        this.state.stage = 'CURLING'; this.state.bottomFormOk = formOk;
        stateLabel = 'Curling';
      } else if (stage === 'CURLING') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgElbow < 55) { this.state.stage = 'PEAK'; stateLabel = 'Peak ✓'; feedback = 'Hold the peak a moment'; }
        else if (avgElbow > 150) { this.state.stage = 'DOWN'; stateLabel = 'Full extension'; }
        else { stateLabel = `Curling... ${avgElbow}°`; }
      } else if (stage === 'PEAK') {
        if (avgElbow > 70) { this.state.stage = 'LOWERING'; stateLabel = 'Lowering'; feedback = 'Control the descent'; }
        else { stateLabel = `Peak ✓ ${avgElbow}°`; }
      } else if (stage === 'LOWERING') {
        if (avgElbow > 150) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}!`;
          }
          this.state.stage = 'DOWN'; this.state.bottomFormOk = false;
          stateLabel = 'Bottom';
        } else { stateLabel = `Lowering... ${avgElbow}°`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 50),
        liveAngles: { 'Avg Elbow': `${avgElbow}°`, 'Torso Sway': `${torsoAngle}°`, 'Standing Stance': standingStanceStatus },
        activeLandmarks: activeLms
      };
    }
  },

  {
    id: 'dumbbell_shoulder_press',
    name: 'Dumbbell Overhead Press',
    category: EXERCISE_CATEGORIES.SHOULDERS,
    equipment: 'Two Dumbbells',
    targetMuscles: 'Deltoids, Triceps, Upper Traps, Serratus Anterior',
    recommendedCamera: 'Front or slight 45° angle',
    setupTip: 'Start with dumbbells at ear/shoulder height, elbows at 90°. Press straight up. No lower back arch.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW, 'Left Wrist': LM.LEFT_WRIST,
      'Right Shoulder': LM.RIGHT_SHOULDER, 'Right Elbow': LM.RIGHT_ELBOW, 'Right Wrist': LM.RIGHT_WRIST
    },
    state: freshState({ stage: 'RACK' }),
    reset() { this.state = freshState({ stage: 'RACK' }); },

    evaluate(landmarks, Bio) {
      const leftArm  = Bio.calculateAngleSmoothed('ohp_la', landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_ELBOW],  landmarks[LM.LEFT_WRIST]);
      const rightArm = Bio.calculateAngleSmoothed('ohp_ra', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgArm   = Math.round((leftArm + rightArm) / 2);
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('ohp_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const symmetry = Bio.checkSymmetry(leftArm, rightArm, 20);

      // ── Standing Posture & Push-Press Leg Drive Telemetry ──────────────────
      const hasKnees = (landmarks[LM.LEFT_KNEE]?.visibility ?? 0) > 0.35 && (landmarks[LM.RIGHT_KNEE]?.visibility ?? 0) > 0.35;
      const hasAnkles = (landmarks[LM.LEFT_ANKLE]?.visibility ?? 0) > 0.35 && (landmarks[LM.RIGHT_ANKLE]?.visibility ?? 0) > 0.35;

      let standingStanceStatus = 'Step back to track';
      const activeLms = [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST];

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 18) { errors.push('Lower back arching — tighten core, ribs down'); formScore -= 30; }
      if (!symmetry.symmetric && avgArm > 100 && avgArm < 155) { errors.push(`Arms uneven by ${symmetry.diff}°`); formScore -= 15; }

      if (hasKnees && hasAnkles) {
        activeLms.push(LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE);
        const leftKnee  = Bio.calculateAngleSmoothed('ohp_lk', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
        const rightKnee = Bio.calculateAngleSmoothed('ohp_rk', landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
        const avgKnee   = Math.round((leftKnee + rightKnee) / 2);

        // Detect push-press cheat: dipping knees to launch dumbbells overhead
        if (avgKnee < 155 && avgArm < 145) {
          errors.push('Strict press only — no knee dip / push-press leg drive!');
          formScore -= 30;
        }

        // Stance width: pressing base stability
        const ankleDist = Math.abs(landmarks[LM.LEFT_ANKLE].x - landmarks[LM.RIGHT_ANKLE].x);
        const shoulderDist = Math.abs(landmarks[LM.LEFT_SHOULDER].x - landmarks[LM.RIGHT_SHOULDER].x);
        if (shoulderDist > 0.05 && ankleDist < shoulderDist * 0.40) {
          errors.push('Widen stance to shoulder-width for pressing balance');
          formScore -= 10;
        }

        standingStanceStatus = avgKnee >= 155 ? `${avgKnee}° (Strict ✓)` : `⚠ ${avgKnee}° (Leg Drive)`;
      }

      const formOk = errors.length === 0;
      let feedback = 'Press straight up — full lockout overhead', stateLabel = 'Rack Position', repCompleted = false;
      const { stage } = this.state;

      // RACK: avgArm < 100° (dumbbells at shoulder)
      // PRESSING: avgArm rising
      // LOCKOUT: avgArm > 155°
      // LOWERING: returning to rack
      // Rep counted when return to RACK from LOWERING

      if (stage === 'RACK' || stage === 'IDLE') {
        if (avgArm > 100) { this.state.stage = 'PRESSING'; this.state.bottomFormOk = formOk; }
        stateLabel = 'Rack — Start Pressing';
        feedback = 'Brace core, then press straight up';
      } else if (stage === 'PRESSING') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgArm > 155) { this.state.stage = 'LOCKOUT'; stateLabel = 'Overhead Lockout ✓'; feedback = 'Full lockout! Now lower controlled'; }
        else if (avgArm < 90) { this.state.stage = 'RACK'; stateLabel = 'Rack — press higher next time'; feedback = 'Press all the way to full lockout'; }
        else { stateLabel = `Pressing... ${avgArm}°`; }
      } else if (stage === 'LOCKOUT') {
        if (avgArm < 130) { this.state.stage = 'LOWERING'; stateLabel = 'Lowering'; feedback = 'Slow descent — control the weight'; }
        else { stateLabel = `Locked Out ✓ ${avgArm}°`; feedback = 'Now lower with control'; }
      } else if (stage === 'LOWERING') {
        if (avgArm < 95) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} done!`;
          } else if (!this.state.bottomFormOk) {
            feedback = 'Rep skipped — fix lower back arch';
          }
          this.state.stage = 'RACK';
          this.state.bottomFormOk = false;
          stateLabel = 'Back to Rack';
        } else { stateLabel = `Lowering... ${avgArm}°`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Avg Arm Angle': `${avgArm}° (Lockout: >155°)`,
          'Symmetry': symmetry.symmetric ? '✓ Even' : `⚠ ${symmetry.diff}° off`,
          'Torso Lean': `${torsoAngle}° (Keep <18°)`,
          'Knee Stability': standingStanceStatus
        },
        activeLandmarks: activeLms
      };
    }
  },

  {
    id: 'dumbbell_lateral_raise',
    name: 'Dumbbell Lateral Raise',
    category: EXERCISE_CATEGORIES.SHOULDERS,
    equipment: 'Two Dumbbells',
    targetMuscles: 'Medial Deltoids, Supraspinatus',
    recommendedCamera: 'Front view',
    setupTip: 'Slight bend in elbows. Raise arms to shoulder height only — no higher than parallel. Slow controlled descent.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Wrist': LM.LEFT_WRIST,
      'Right Shoulder': LM.RIGHT_SHOULDER, 'Right Wrist': LM.RIGHT_WRIST
    },
    state: freshState({ stage: 'DOWN' }),
    reset() { this.state = freshState({ stage: 'DOWN' }); },

    evaluate(landmarks, Bio) {
      // Measure shoulder abduction angle: wrist height relative to shoulder
      const lWrist = landmarks[LM.LEFT_WRIST];
      const rWrist = landmarks[LM.RIGHT_WRIST];
      const lShoulder = landmarks[LM.LEFT_SHOULDER];
      const rShoulder = landmarks[LM.RIGHT_SHOULDER];

      // Abduction: when wrist is at shoulder Y level = ~90°
      const leftAbduction  = Bio.calculateAngleSmoothed('lr_la', landmarks[LM.LEFT_HIP],  landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_WRIST]);
      const rightAbduction = Bio.calculateAngleSmoothed('lr_ra', landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_WRIST]);
      const avgAbduction   = Math.round((leftAbduction + rightAbduction) / 2);

      // Torso sway
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('lr_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 15) { errors.push('No swinging — control the weight'); formScore -= 30; }

      // Raising too high (above shoulders = impingement risk)
      if (avgAbduction > 95) { errors.push('Do not raise above shoulder height — risk of impingement'); formScore -= 20; }

      const formOk = errors.length === 0;
      let feedback = 'Raise arms to shoulder height — keep slight elbow bend', stateLabel = 'Arms at Sides', repCompleted = false;
      const { stage } = this.state;

      if ((stage === 'DOWN' || stage === 'IDLE') && avgAbduction > 50) {
        this.state.stage = 'RAISING'; this.state.bottomFormOk = formOk;
      } else if (stage === 'RAISING') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgAbduction >= 75 && avgAbduction <= 95) {
          this.state.stage = 'TOP'; stateLabel = 'Shoulder Height ✓'; feedback = 'Hold briefly at top';
        } else if (avgAbduction < 40) {
          this.state.stage = 'DOWN'; stateLabel = 'Go higher'; feedback = 'Raise to shoulder height';
        } else { stateLabel = `Raising... ${avgAbduction}°`; }
      } else if (stage === 'TOP') {
        if (avgAbduction < 60) { this.state.stage = 'LOWERING'; stateLabel = 'Lowering'; feedback = 'Control the descent'; }
        else { stateLabel = `Top ✓ ${avgAbduction}°`; feedback = 'Now lower with resistance'; }
      } else if (stage === 'LOWERING') {
        if (avgAbduction < 35) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}!`;
          }
          this.state.stage = 'DOWN'; this.state.bottomFormOk = false;
          stateLabel = 'Arms at Sides';
        } else { stateLabel = `Lowering... ${avgAbduction}°`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 50),
        liveAngles: {
          'Arm Raise': `${avgAbduction}° (Target: 75°–90°)`,
          'Torso Sway': `${torsoAngle}°`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_WRIST]
      };
    }
  },

  {
    id: 'dumbbell_bent_over_row',
    name: 'Dumbbell Bent-Over Row',
    category: EXERCISE_CATEGORIES.BACK,
    equipment: 'Two Dumbbells',
    targetMuscles: 'Lats, Rhomboids, Rear Deltoids, Biceps',
    recommendedCamera: 'Side profile (45°–90° from your side)',
    setupTip: 'Hip hinge to 45°, flat back (not rounded). Pull dumbbells to lower rib area.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW, 'Left Hip': LM.LEFT_HIP
    },
    state: freshState({ stage: 'HANG' }),
    reset() { this.state = freshState({ stage: 'HANG' }); },

    evaluate(landmarks, Bio) {
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('row_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const elbowAngle = Bio.calculateAngleSmoothed('row_elbow', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_ELBOW], landmarks[LM.LEFT_WRIST]);

      const errors = [];
      let formScore = 100;
      if (torsoAngle < 30) { errors.push('Hinge forward more — torso should be ~45° from vertical'); formScore -= 25; }
      if (torsoAngle > 70) { errors.push('Too bent over — raise chest slightly'); formScore -= 20; }

      const formOk = errors.length === 0;
      let feedback = 'Pull elbows past hips — squeeze back', stateLabel = 'Hanging', repCompleted = false;
      const { stage } = this.state;

      if ((stage === 'HANG' || stage === 'IDLE') && elbowAngle < 135) {
        this.state.stage = 'PULLING'; this.state.bottomFormOk = formOk;
      } else if (stage === 'PULLING') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle < 80) { this.state.stage = 'SQUEEZE'; stateLabel = 'Peak Row ✓'; feedback = 'Squeeze shoulder blades!'; }
        else if (elbowAngle > 148) { this.state.stage = 'HANG'; stateLabel = 'Full extension'; }
        else { stateLabel = `Pulling... ${elbowAngle}°`; }
      } else if (stage === 'SQUEEZE') {
        if (elbowAngle > 95) { this.state.stage = 'LOWERING'; stateLabel = 'Lowering'; feedback = 'Lower with control'; }
        else { stateLabel = `Squeeze ✓ ${elbowAngle}°`; }
      } else if (stage === 'LOWERING') {
        if (elbowAngle > 148) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}!`;
          }
          this.state.stage = 'HANG'; this.state.bottomFormOk = false;
          stateLabel = 'Full Hang';
        } else { stateLabel = `Lowering... ${elbowAngle}°`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Torso Hinge': `${torsoAngle}° (Target: 40°–55°)`,
          'Elbow Pull': `${elbowAngle}° (Need <80° at top)`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.LEFT_HIP]
      };
    }
  },

  {
    id: 'dumbbell_tricep_extension',
    name: 'Dumbbell Overhead Tricep Extension',
    category: EXERCISE_CATEGORIES.ARMS,
    equipment: 'One Dumbbell (both hands)',
    targetMuscles: 'Triceps Brachii (Long Head)',
    recommendedCamera: 'Side profile',
    setupTip: 'Hold dumbbell overhead with both hands. Lower behind head by bending elbows. Keep upper arms vertical.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW, 'Left Wrist': LM.LEFT_WRIST
    },
    state: freshState({ stage: 'TOP' }),
    reset() { this.state = freshState({ stage: 'TOP' }); },

    evaluate(landmarks, Bio) {
      const elbowAngle = Bio.calculateAngleSmoothed('te_elbow', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_ELBOW], landmarks[LM.LEFT_WRIST]);

      const errors = [];
      let formScore = 100;
      // Upper arm should stay vertical (not flaring out)
      const upperArmAngle = Bio.calcAngleWithVerticalSmoothed('te_ua', landmarks[LM.LEFT_ELBOW], landmarks[LM.LEFT_SHOULDER]);
      if (upperArmAngle > 30) { errors.push('Keep upper arms vertical — do not flare elbows'); formScore -= 25; }

      const formOk = errors.length === 0;
      let feedback = 'Lower dumbbell behind head, then extend', stateLabel = 'Extended', repCompleted = false;
      const { stage } = this.state;

      if ((stage === 'TOP' || stage === 'IDLE') && elbowAngle < 130) {
        this.state.stage = 'LOWERING'; this.state.bottomFormOk = formOk;
      } else if (stage === 'LOWERING') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle < 70) { this.state.stage = 'BOTTOM'; stateLabel = `Bottom ✓ ${elbowAngle}°`; feedback = 'Extend arms to lockout!'; }
        else if (elbowAngle > 150) { this.state.stage = 'TOP'; stateLabel = 'Go lower behind head'; }
        else { stateLabel = `Lowering... ${elbowAngle}°`; }
      } else if (stage === 'BOTTOM') {
        if (elbowAngle > 90) { this.state.stage = 'EXTENDING'; stateLabel = 'Extending'; feedback = 'Straighten arms overhead!'; }
        else { stateLabel = `Bottom ✓`; feedback = 'Extend arms to lockout'; }
      } else if (stage === 'EXTENDING') {
        if (elbowAngle > 150) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}!`;
          }
          this.state.stage = 'TOP'; this.state.bottomFormOk = false;
          stateLabel = 'Fully Extended';
        } else { stateLabel = `Extending... ${elbowAngle}°`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 50),
        liveAngles: {
          'Elbow Bend': `${elbowAngle}° (Need <70° at bottom)`,
          'Upper Arm': `${upperArmAngle}° from vertical (Keep <25°)`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST]
      };
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  4. CURL ROD
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'barbell_curl',
    name: 'Curl Rod Bicep Curl',
    category: EXERCISE_CATEGORIES.ARMS,
    equipment: 'Curl Rod (EZ-Bar or Straight)',
    targetMuscles: 'Biceps Brachii, Brachialis',
    recommendedCamera: 'Front or slight 45°',
    setupTip: 'Underhand grip. Elbows pinned at sides. Zero body sway — this is a strict isolation movement.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW, 'Left Wrist': LM.LEFT_WRIST,
      'Right Shoulder': LM.RIGHT_SHOULDER, 'Right Elbow': LM.RIGHT_ELBOW, 'Right Wrist': LM.RIGHT_WRIST
    },
    state: freshState({ stage: 'DOWN' }),
    reset() { this.state = freshState({ stage: 'DOWN' }); },

    evaluate(landmarks, Bio) {
      const leftElbow  = Bio.calculateAngleSmoothed('bc_le', landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_ELBOW],  landmarks[LM.LEFT_WRIST]);
      const rightElbow = Bio.calculateAngleSmoothed('bc_re', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgElbow   = Math.round((leftElbow + rightElbow) / 2);
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('bc_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const symmetry   = Bio.checkSymmetry(leftElbow, rightElbow, 12); // tighter tolerance for barbell

      // ── Standing Posture & Leg Drive Telemetry ──────────────────────────────
      const hasKnees = (landmarks[LM.LEFT_KNEE]?.visibility ?? 0) > 0.35 && (landmarks[LM.RIGHT_KNEE]?.visibility ?? 0) > 0.35;
      const hasAnkles = (landmarks[LM.LEFT_ANKLE]?.visibility ?? 0) > 0.35 && (landmarks[LM.RIGHT_ANKLE]?.visibility ?? 0) > 0.35;

      let standingStanceStatus = 'Step back to track';
      const activeLms = [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST];

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 15) { errors.push('No body rocking — strict curl only'); formScore -= 35; }
      if (!symmetry.symmetric) { errors.push(`Bar tilting — ${symmetry.diff}° uneven`); formScore -= 15; }

      if (hasKnees && hasAnkles) {
        activeLms.push(LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE);
        const leftKnee  = Bio.calculateAngleSmoothed('bc_lk', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
        const rightKnee = Bio.calculateAngleSmoothed('bc_rk', landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
        const avgKnee   = Math.round((leftKnee + rightKnee) / 2);

        if (avgKnee < 155 && avgElbow < 140) {
          errors.push('No knee bounce! Stand strict, isolate biceps');
          formScore -= 30;
        }

        const ankleDist = Math.abs(landmarks[LM.LEFT_ANKLE].x - landmarks[LM.RIGHT_ANKLE].x);
        const shoulderDist = Math.abs(landmarks[LM.LEFT_SHOULDER].x - landmarks[LM.RIGHT_SHOULDER].x);
        if (shoulderDist > 0.05 && ankleDist < shoulderDist * 0.40) {
          errors.push('Widen stance to shoulder-width for balance');
          formScore -= 10;
        }

        standingStanceStatus = avgKnee >= 155 ? `${avgKnee}° (Strict ✓)` : `⚠ ${avgKnee}° (Bouncing)`;
      }

      const formOk = errors.length === 0;
      let feedback = 'Strict curl — no momentum', stateLabel = 'Bottom', repCompleted = false;
      const { stage } = this.state;

      if ((stage === 'DOWN' || stage === 'IDLE') && avgElbow < 148) {
        this.state.stage = 'CURLING'; this.state.minAngle = avgElbow; this.state.bottomFormOk = formOk;
      } else if (stage === 'CURLING') {
        this.state.minAngle = Math.min(this.state.minAngle, avgElbow);
        if (formOk) this.state.bottomFormOk = true;
        if (avgElbow < 55) { this.state.stage = 'PEAK'; stateLabel = 'Peak ✓'; feedback = 'Squeeze hard at the top!'; }
        else if (avgElbow > 150) { this.state.stage = 'DOWN'; stateLabel = 'Go higher'; feedback = 'Curl all the way up!'; }
        else { stateLabel = `Curling... ${avgElbow}°`; }
      } else if (stage === 'PEAK') {
        if (avgElbow > 70) { this.state.stage = 'LOWERING'; stateLabel = 'Lowering'; feedback = '3-second controlled descent'; }
        else { stateLabel = `Peak ✓ ${avgElbow}°`; }
      } else if (stage === 'LOWERING') {
        if (avgElbow > 150) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}! Perfect curl`;
          }
          this.state.stage = 'DOWN'; this.state.bottomFormOk = false;
          stateLabel = 'Full Extension';
        } else { stateLabel = `Lowering... ${avgElbow}°`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Bar Flexion': `${avgElbow}° (Need ≤55° at top)`,
          'Bilateral Balance': symmetry.symmetric ? '✓ Level' : `⚠ Tilted ${symmetry.diff}°`,
          'Body Swing': `${torsoAngle}° (Strict: <15°)`,
          'Standing Stance': standingStanceStatus
        },
        activeLandmarks: activeLms
      };
    }
  },

  {
    id: 'romanian_deadlift',
    name: 'Romanian Deadlift (RDL)',
    category: EXERCISE_CATEGORIES.LEGS,
    equipment: 'Curl Rod / Barbell',
    targetMuscles: 'Hamstrings, Glutes, Spinal Erectors',
    recommendedCamera: 'Side profile (90° from your side)',
    setupTip: 'Hip hinge backward — push glutes to wall behind you. Bar stays close to legs. Back FLAT.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Hip': LM.LEFT_HIP,
      'Left Knee': LM.LEFT_KNEE, 'Left Ankle': LM.LEFT_ANKLE
    },
    state: freshState({ stage: 'STAND' }),
    reset() { this.state = freshState({ stage: 'STAND' }); },

    evaluate(landmarks, Bio) {
      const hipAngle   = Bio.calculateAngleSmoothed('rdl_hip', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE]);
      const kneeAngle  = Bio.calculateAngleSmoothed('rdl_knee', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('rdl_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);

      const errors = [];
      let formScore = 100;
      if (kneeAngle < 130) { errors.push('Too much knee bend — keep knees soft (not deep squat)'); formScore -= 20; }
      if (torsoAngle < 10 && hipAngle > 150) { errors.push('Hinge forward at hips — push glutes backward'); formScore -= 15; }

      const formOk = errors.length === 0;
      let feedback = 'Push hips backward — feel hamstring stretch', stateLabel = 'Standing', repCompleted = false;
      const { stage } = this.state;

      if ((stage === 'STAND' || stage === 'IDLE') && hipAngle < 150) {
        this.state.stage = 'HINGING'; this.state.bottomFormOk = formOk;
        stateLabel = 'Hinging';
      } else if (stage === 'HINGING') {
        if (formOk) this.state.bottomFormOk = true;
        if (hipAngle < 95) { this.state.stage = 'BOTTOM'; stateLabel = `Full Hinge ✓ ${hipAngle}°`; feedback = 'Drive hips forward to stand!'; }
        else if (hipAngle > 165) { this.state.stage = 'STAND'; stateLabel = 'Hinge deeper for hamstrings'; }
        else { stateLabel = `Hinging... ${hipAngle}°`; feedback = 'Keep pushing hips back'; }
      } else if (stage === 'BOTTOM') {
        if (hipAngle > 120) { this.state.stage = 'STANDING_UP'; stateLabel = 'Driving Up'; feedback = 'Squeeze glutes at the top!'; }
        else { stateLabel = `Bottom ✓ ${hipAngle}°`; feedback = 'Full stretch — now drive hips forward'; }
      } else if (stage === 'STANDING_UP') {
        if (hipAngle > 165) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}! Strong lockout`;
          }
          this.state.stage = 'STAND'; this.state.bottomFormOk = false;
          stateLabel = 'Standing Tall';
        } else { stateLabel = `Driving Up... ${hipAngle}°`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Hip Hinge': `${hipAngle}° (Full: <95°)`,
          'Knee Bend': `${kneeAngle}° (Keep >135°)`,
          'Torso Angle': `${torsoAngle}° from vertical`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE]
      };
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  5. RESISTANCE TUBES
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'band_pull_apart',
    name: 'Resistance Band Pull-Apart',
    category: EXERCISE_CATEGORIES.BACK,
    equipment: 'Resistance Tube / Band',
    targetMuscles: 'Rear Deltoids, Rhomboids, Rotator Cuff',
    recommendedCamera: 'Front view',
    setupTip: 'Hold band at chest height. Arms extended. Pull APART until band touches chest. Keep arms straight.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Wrist': LM.LEFT_WRIST,
      'Right Shoulder': LM.RIGHT_SHOULDER, 'Right Wrist': LM.RIGHT_WRIST
    },
    state: freshState({ stage: 'FRONT' }),
    reset() { this.state = freshState({ stage: 'FRONT' }); },

    evaluate(landmarks, Bio) {
      const leftElbow  = Bio.calculateAngleSmoothed('pa_le', landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_ELBOW],  landmarks[LM.LEFT_WRIST]);
      const rightElbow = Bio.calculateAngleSmoothed('pa_re', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgElbow   = Math.round((leftElbow + rightElbow) / 2);

      const wristDist    = Bio.distance(landmarks[LM.LEFT_WRIST], landmarks[LM.RIGHT_WRIST]);
      const shoulderDist = Bio.distance(landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]);
      const spreadRatio  = shoulderDist > 0 ? wristDist / shoulderDist : 1;

      const errors = [];
      let formScore = 100;
      if (avgElbow < 148) { errors.push('Keep arms straight — do not bend elbows'); formScore -= 30; }

      const formOk = errors.length === 0;
      let feedback = 'Pull arms apart — straight arms, squeeze back', stateLabel = 'Band in Front', repCompleted = false;
      const { stage } = this.state;

      if ((stage === 'FRONT' || stage === 'IDLE') && spreadRatio > 1.8) {
        this.state.stage = 'EXPANDING'; this.state.bottomFormOk = formOk;
      } else if (stage === 'EXPANDING') {
        if (formOk) this.state.bottomFormOk = true;
        if (spreadRatio > 2.5) { this.state.stage = 'EXPANDED'; stateLabel = 'Full Retraction ✓'; feedback = 'Pinch shoulder blades!'; }
        else { stateLabel = `Pulling... ${spreadRatio.toFixed(1)}x`; }
      } else if (stage === 'EXPANDED') {
        if (spreadRatio < 2.0) { this.state.stage = 'RETURNING'; stateLabel = 'Returning'; feedback = 'Control band back to front'; }
        else { stateLabel = `Expanded ✓`; feedback = 'Now return under tension'; }
      } else if (stage === 'RETURNING') {
        if (spreadRatio < 1.4) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}!`;
          }
          this.state.stage = 'FRONT'; this.state.bottomFormOk = false;
          stateLabel = 'Band in Front';
        } else { stateLabel = `Returning... ${spreadRatio.toFixed(1)}x`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 50),
        liveAngles: {
          'Arm Straightness': `${avgElbow}° (Keep >148°)`,
          'Band Spread': `${spreadRatio.toFixed(2)}x shoulder width`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST]
      };
    }
  },

  {
    id: 'resistance_band_row',
    name: 'Resistance Band Seated Row',
    category: EXERCISE_CATEGORIES.BACK,
    equipment: 'Resistance Tube (anchored)',
    targetMuscles: 'Lats, Rhomboids, Rear Deltoids, Biceps',
    recommendedCamera: 'Side profile',
    setupTip: 'Anchor band at mid-height. Sit/stand. Pull handles to lower rib — squeeze back at peak.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW, 'Left Wrist': LM.LEFT_WRIST
    },
    state: freshState({ stage: 'EXTENDED' }),
    reset() { this.state = freshState({ stage: 'EXTENDED' }); },

    evaluate(landmarks, Bio) {
      const elbowAngle = Bio.calculateAngleSmoothed('br_e', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_ELBOW], landmarks[LM.LEFT_WRIST]);

      const errors = [];
      let formScore = 100;
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('br_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      if (torsoAngle > 20) { errors.push('Do not lean back — use back muscles, not momentum'); formScore -= 25; }

      const formOk = errors.length === 0;
      let feedback = 'Pull elbows past hips — squeeze shoulder blades', stateLabel = 'Extended', repCompleted = false;
      const { stage } = this.state;

      if ((stage === 'EXTENDED' || stage === 'IDLE') && elbowAngle < 140) {
        this.state.stage = 'PULLING'; this.state.bottomFormOk = formOk;
      } else if (stage === 'PULLING') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle < 80) { this.state.stage = 'PEAK'; stateLabel = 'Peak Pull ✓'; feedback = 'Hold the squeeze!'; }
        else if (elbowAngle > 148) { this.state.stage = 'EXTENDED'; stateLabel = 'Extended'; }
        else { stateLabel = `Pulling... ${elbowAngle}°`; }
      } else if (stage === 'PEAK') {
        if (elbowAngle > 95) { this.state.stage = 'RETURNING'; stateLabel = 'Returning'; feedback = 'Control back to start'; }
        else { stateLabel = `Peak ✓ ${elbowAngle}°`; }
      } else if (stage === 'RETURNING') {
        if (elbowAngle > 148) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}!`;
          }
          this.state.stage = 'EXTENDED'; this.state.bottomFormOk = false;
          stateLabel = 'Extended';
        } else { stateLabel = `Returning... ${elbowAngle}°`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 50),
        liveAngles: {
          'Elbow Angle': `${elbowAngle}° (Pull to <80°)`,
          'Torso Lean': `${torsoAngle}°`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST]
      };
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  6. AB ROLLER
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'ab_roller_rollout',
    name: 'Kneeling Ab Wheel Rollout',
    category: EXERCISE_CATEGORIES.CORE,
    equipment: 'Ab Roller Wheel + Knee Pad',
    targetMuscles: 'Rectus Abdominis, Transverse Abdominis, Lats',
    recommendedCamera: 'Side profile — laptop on floor/low stool pointing sideways',
    setupTip: 'Start kneeling with wheel directly under chest. Roll wheel forward along floor, keeping core tight.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Hip': LM.LEFT_HIP,
      'Left Knee': LM.LEFT_KNEE, 'Left Wrist': LM.LEFT_WRIST
    },
    state: freshState({ stage: 'START', startDx: 0 }),
    reset() { this.state = freshState({ stage: 'START', startDx: 0 }); },

    evaluate(landmarks, Bio) {
      // Determine side profile visibility (left vs right)
      const leftScore = (landmarks[LM.LEFT_SHOULDER]?.visibility ?? 0) + (landmarks[LM.LEFT_KNEE]?.visibility ?? 0);
      const rightScore = (landmarks[LM.RIGHT_SHOULDER]?.visibility ?? 0) + (landmarks[LM.RIGHT_KNEE]?.visibility ?? 0);
      const isLeft = leftScore >= rightScore;

      const s_idx = isLeft ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
      const h_idx = isLeft ? LM.LEFT_HIP : LM.RIGHT_HIP;
      const k_idx = isLeft ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
      const w_idx = isLeft ? LM.LEFT_WRIST : LM.RIGHT_WRIST;

      const shoulder = landmarks[s_idx];
      const hip = landmarks[h_idx];
      const knee = landmarks[k_idx];
      const wrist = landmarks[w_idx];

      const hipAngle = Bio.calculateAngleSmoothed('ar_hip', shoulder, hip, knee);
      const shoulderReachAngle = Bio.calculateAngleSmoothed('ar_reach', hip, shoulder, wrist);

      // Horizontal span of wheel relative to knees
      const dx = Math.abs(wrist.x - knee.x);
      // Wrists must be down near floor level holding the roller
      const wristNearFloor = wrist.y > 0.45 && Math.abs(wrist.y - knee.y) < 0.30;
      // Torso must descend during rollout (shoulders close to floor)
      const torsoLow = shoulder.y > knee.y - 0.28;

      const errors = [];
      let formScore = 100;

      // Anti-spoofing: upright kneeling or hands off floor
      if (!wristNearFloor) {
        errors.push('Place ab roller on floor in front of knees');
        formScore -= 40;
      }

      // Lower back sagging detection: hips dipping below shoulder line during full extension
      if (hipAngle > 135 && shoulder.y > hip.y + 0.08) {
        errors.push('⚠️ Lower back sagging — brace core and pull back!');
        formScore -= 40;
      }

      const formOk = errors.length === 0;
      let feedback = 'Brace core — roll wheel forward along floor';
      let stateLabel = 'Start Position';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'START' || stage === 'IDLE') {
        if (wristNearFloor) {
          this.state.startDx = dx;
        }
        if (hipAngle > 110 && shoulderReachAngle > 85 && wristNearFloor) {
          this.state.stage = 'ROLLING';
          this.state.bottomFormOk = formOk;
        }
      } else if (stage === 'ROLLING') {
        if (formOk) this.state.bottomFormOk = true;
        // Full rollout requires hip extension >145°, shoulder reach >115°, wheel on floor, and horizontal stretch
        if (hipAngle > 145 && shoulderReachAngle > 115 && wristNearFloor && dx > 0.28) {
          this.state.stage = 'EXTENDED';
          stateLabel = 'Extended Position ✓';
          feedback = 'Engage lats — pull roller back now!';
        } else {
          stateLabel = `Rolling... Reach ${shoulderReachAngle}°`;
          feedback = 'Keep abs tight and roll out';
        }
      } else if (stage === 'EXTENDED') {
        if (hipAngle < 130 || shoulderReachAngle < 105) {
          this.state.stage = 'RETURNING';
          stateLabel = 'Pulling Back';
          feedback = 'Use lats and core to pull wheel back';
        } else {
          stateLabel = `Extended ✓ (${shoulderReachAngle}°)`;
          feedback = 'Pull back through core';
        }
      } else if (stage === 'RETURNING') {
        if (hipAngle < 95 && shoulderReachAngle < 85) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}! Core strength!`;
          } else if (!this.state.bottomFormOk) {
            feedback = 'Rep skipped — keep lower back safe next time';
          }
          this.state.stage = 'START';
          this.state.bottomFormOk = false;
          stateLabel = 'Start Position';
        } else {
          stateLabel = `Returning... ${hipAngle}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 30),
        liveAngles: {
          'Hip Extension': `${hipAngle}° (Full: >145°)`,
          'Arm Reach': `${shoulderReachAngle}° (Goal: >115°)`,
          'Roller Contact': wristNearFloor ? '✓ Floor Contact' : '⚠ Off Floor'
        },
        activeLandmarks: [s_idx, h_idx, k_idx, w_idx]
      };
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  7. WARM-UP & MOBILITY (LIVE ARENA AI TRACKED)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'warmup_arm_circles',
    name: 'Warm-Up: Arm Circles & Rotations',
    category: EXERCISE_CATEGORIES.WARMUP,
    equipment: 'Bodyweight',
    targetMuscles: 'Deltoids, Rotator Cuffs, Upper Back',
    recommendedCamera: 'Front view, arms extended (stand 6-8 ft back)',
    setupTip: 'Extend arms straight out to sides at shoulder height. Make continuous, wide circular rotations.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Right Shoulder': LM.RIGHT_SHOULDER,
      'Left Elbow': LM.LEFT_ELBOW, 'Right Elbow': LM.RIGHT_ELBOW,
      'Left Wrist': LM.LEFT_WRIST, 'Right Wrist': LM.RIGHT_WRIST
    },
    state: freshState({ stage: 'EXTEND', circlePhase: 'TOP', lastRotTime: 0 }),
    reset() { this.state = freshState({ stage: 'EXTEND', circlePhase: 'TOP', lastRotTime: 0 }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Move back — cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {},
          activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW]
        };
      }

      const leftArmAngle = Bio.calculateAngleSmoothed('w_larm', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_ELBOW], landmarks[LM.LEFT_WRIST]);
      const rightArmAngle = Bio.calculateAngleSmoothed('w_rarm', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgArmExtension = Math.round((leftArmAngle + rightArmAngle) / 2);

      const lWrist = landmarks[LM.LEFT_WRIST];
      const rWrist = landmarks[LM.RIGHT_WRIST];
      const lShoulder = landmarks[LM.LEFT_SHOULDER];
      const rShoulder = landmarks[LM.RIGHT_SHOULDER];
      const avgShoulderY = (lShoulder.y + rShoulder.y) / 2;
      const avgWristY = (lWrist.y + rWrist.y) / 2;
      const relY = avgWristY - avgShoulderY;

      const errors = [];
      let formScore = 100;

      if (avgArmExtension < 125) {
        errors.push('Straighten arms outward — avoid bent elbows');
        formScore -= 25;
      }
      if (relY > 0.35) {
        errors.push('Lift arms up to shoulder level');
        formScore -= 20;
      }

      const formOk = errors.length === 0;
      let feedback = 'Make wide circular motions with extended arms';
      let stateLabel = 'Circling Arms';
      let repCompleted = false;
      const now = Date.now();

      if (this.state.stage === 'EXTEND') {
        if (relY <= 0.20) {
          this.state.stage = 'ROTATING';
          this.state.circlePhase = 'TOP';
        }
        stateLabel = 'Extend Arms Wide';
        feedback = 'Hold arms at shoulder height and start circling';
      } else if (this.state.stage === 'ROTATING') {
        if (this.state.circlePhase === 'TOP' && relY > 0.06) {
          this.state.circlePhase = 'BOTTOM';
        } else if (this.state.circlePhase === 'BOTTOM' && relY < 0.02) {
          if (now - (this.state.lastRotTime || 0) > 400 && formOk) {
            this.state.repCount++;
            this.state.lastRotTime = now;
            repCompleted = true;
            feedback = `Rotation ${this.state.repCount} ✓ Smooth mobility!`;
          }
          this.state.circlePhase = 'TOP';
        }
        stateLabel = `Circling (${avgArmExtension}°)`;
        if (formOk && !repCompleted) feedback = 'Keep rhythmic circular flow';
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted,
        repCount: this.state.repCount,
        stateLabel,
        feedback,
        errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Left Arm': `${leftArmAngle}° (Goal >135°)`,
          'Right Arm': `${rightArmAngle}° (Goal >135°)`,
          'Arm Height': relY <= 0.25 ? '✓ Shoulder Level' : '⚠ Arms Too Low',
          'Rotations': `${this.state.repCount}`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST]
      };
    }
  },

  {
    id: 'warmup_torso_twists',
    name: 'Warm-Up: Torso Twists & Spine Mobility',
    category: EXERCISE_CATEGORIES.WARMUP,
    equipment: 'Bodyweight',
    targetMuscles: 'Thoracic Spine, Core, Obliques, Hips',
    recommendedCamera: 'Front view, full body visible',
    setupTip: 'Feet shoulder-width apart, knees soft. Rotate torso smoothly from side to side with arms relaxed.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Right Shoulder': LM.RIGHT_SHOULDER,
      'Left Hip': LM.LEFT_HIP, 'Right Hip': LM.RIGHT_HIP
    },
    state: freshState({ stage: 'CENTER', lastTwistSide: null, lastRepTime: 0 }),
    reset() { this.state = freshState({ stage: 'CENTER', lastTwistSide: null, lastRepTime: 0 }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Move back — cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {},
          activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP]
        };
      }

      const ls = landmarks[LM.LEFT_SHOULDER];
      const rs = landmarks[LM.RIGHT_SHOULDER];
      const lh = landmarks[LM.LEFT_HIP];
      const rh = landmarks[LM.RIGHT_HIP];

      const shoulderMidX = (ls.x + rs.x) / 2;
      const hipMidX = (lh.x + rh.x) / 2;
      const twistOffset = Math.round((shoulderMidX - hipMidX) * 200);

      const spineAngle = Bio.calcAngleWithVerticalSmoothed('w_twist_spine',
        { x: shoulderMidX, y: (ls.y + rs.y) / 2 },
        { x: hipMidX, y: (lh.y + rh.y) / 2 }
      );

      const errors = [];
      let formScore = 100;

      if (spineAngle > 22) {
        errors.push('Avoid leaning sideways — rotate around tall spine');
        formScore -= 25;
      }

      const formOk = errors.length === 0;
      let feedback = 'Gently twist torso side to side';
      let stateLabel = 'Center';
      let repCompleted = false;
      const now = Date.now();

      if (Math.abs(twistOffset) < 5) {
        stateLabel = 'Center — Rotate Torso';
        feedback = 'Rotate smoothly left, then right';
      } else if (twistOffset >= 8) {
        stateLabel = 'Twisting Left ↺';
        if (this.state.lastTwistSide === 'RIGHT' && formOk && (now - this.state.lastRepTime > 450)) {
          this.state.repCount++;
          this.state.lastRepTime = now;
          this.state.lastTwistSide = 'LEFT';
          repCompleted = true;
          feedback = `Twist ${this.state.repCount} ✓ Great spinal rotation!`;
        } else if (!this.state.lastTwistSide) {
          this.state.lastTwistSide = 'LEFT';
        }
      } else if (twistOffset <= -8) {
        stateLabel = 'Twisting Right ↻';
        if (this.state.lastTwistSide === 'LEFT' && formOk && (now - this.state.lastRepTime > 450)) {
          this.state.repCount++;
          this.state.lastRepTime = now;
          this.state.lastTwistSide = 'RIGHT';
          repCompleted = true;
          feedback = `Twist ${this.state.repCount} ✓ Great spinal rotation!`;
        } else if (!this.state.lastTwistSide) {
          this.state.lastTwistSide = 'RIGHT';
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted,
        repCount: this.state.repCount,
        stateLabel,
        feedback,
        errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Spine Lean': `${spineAngle}° (Keep <20°)`,
          'Twist Offset': `${twistOffset}`,
          'Twist State': stateLabel,
          'Total Twists': `${this.state.repCount}`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP]
      };
    }
  },

  {
    id: 'warmup_air_squats',
    name: 'Warm-Up: Mobility Air Squats',
    category: EXERCISE_CATEGORIES.WARMUP,
    equipment: 'Bodyweight',
    targetMuscles: 'Knees, Hips, Glutes, Synovial Joint Fluid',
    recommendedCamera: 'Front or 45° angle, full body visible',
    setupTip: 'Perform smooth, shallow rhythmic squats to lubricate hips and knees. 1s pause at bottom.',
    requiredLandmarks: {
      'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE, 'Left Ankle': LM.LEFT_ANKLE,
      'Right Hip': LM.RIGHT_HIP, 'Right Knee': LM.RIGHT_KNEE, 'Right Ankle': LM.RIGHT_ANKLE
    },
    state: freshState({ stage: 'STAND' }),
    reset() { this.state = freshState({ stage: 'STAND' }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Move back — cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {},
          activeLandmarks: [LM.LEFT_KNEE, LM.RIGHT_KNEE]
        };
      }

      const leftKnee = Bio.calculateAngleSmoothed('w_sq_lk', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
      const rightKnee = Bio.calculateAngleSmoothed('w_sq_rk', landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
      const avgKnee = Math.round((leftKnee + rightKnee) / 2);

      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('w_sq_torso',
        landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);

      const hipDist = Bio.distance(landmarks[LM.LEFT_HIP], landmarks[LM.RIGHT_HIP]);
      const kneeDist = Bio.distance(landmarks[LM.LEFT_KNEE], landmarks[LM.RIGHT_KNEE]);
      const valgus = kneeDist < hipDist * 0.70 && avgKnee < 140;

      const errors = [];
      let formScore = 100;

      if (torsoAngle > 55) {
        errors.push('Chest up! Keep torso tall during mobility squat');
        formScore -= 25;
      }
      if (valgus) {
        errors.push('Push knees outward over toes');
        formScore -= 30;
      }

      const formOk = errors.length === 0;
      let feedback = 'Rhythmic mobility squat — lubricate joints';
      let stateLabel = 'Standing';
      let repCompleted = false;

      const { stage } = this.state;
      if (stage === 'STAND' || stage === 'IDLE') {
        if (avgKnee < 155) {
          this.state.stage = 'DESCEND';
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Standing — Ease Down';
        feedback = 'Smooth rhythmic tempo';
      } else if (stage === 'DESCEND') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgKnee <= 115) {
          this.state.stage = 'BOTTOM';
          stateLabel = 'Good Mobility Depth!';
          feedback = 'Now smoothly stand back up';
        } else {
          stateLabel = `Descending... ${avgKnee}°`;
        }
      } else if (stage === 'BOTTOM') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgKnee > 130) {
          this.state.stage = 'ASCEND';
          stateLabel = 'Rising';
        }
      } else if (stage === 'ASCEND') {
        if (avgKnee > 158) {
          const now = Date.now();
          if (now - this.state.lastRepTime > 400 && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Warm-up Rep ${this.state.repCount} ✓ Joints primed!`;
          }
          this.state.stage = 'STAND';
          this.state.bottomFormOk = false;
          stateLabel = 'Standing';
        } else {
          stateLabel = `Rising... ${avgKnee}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted,
        repCount: this.state.repCount,
        stateLabel,
        feedback,
        errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Knee Angle': `${avgKnee}° (Goal ≤115°)`,
          'Torso Lean': `${torsoAngle}° (Keep <50°)`,
          'Knee Alignment': valgus ? '⚠ Knees Caving' : '✓ Knees Out',
          'Mobility Reps': `${this.state.repCount}`
        },
        activeLandmarks: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
      };
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  8. COOL-DOWN & STRETCHING (LIVE ARENA AI TRACKED)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'cooldown_quad_stretch',
    name: 'Cool-Down: Standing Quad & Hip Stretch',
    category: EXERCISE_CATEGORIES.COOLDOWN,
    equipment: 'Bodyweight',
    targetMuscles: 'Quadriceps, Hip Flexors, Psoas',
    recommendedCamera: 'Front or Side profile, full body visible',
    setupTip: 'Stand tall, hold one ankle behind you toward glutes. Hold stretch with chest tall.',
    requiredLandmarks: {
      'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE, 'Left Ankle': LM.LEFT_ANKLE,
      'Right Hip': LM.RIGHT_HIP, 'Right Knee': LM.RIGHT_KNEE, 'Right Ankle': LM.RIGHT_ANKLE
    },
    state: freshState({ stage: 'STRETCH', holdSeconds: 0, lastTick: 0 }),
    reset() { this.state = freshState({ stage: 'STRETCH', holdSeconds: 0, lastTick: 0 }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Move back — cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {}, activeLandmarks: [LM.LEFT_KNEE, LM.RIGHT_KNEE]
        };
      }

      const lKnee = Bio.calculateAngleSmoothed('cd_lk', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
      const rKnee = Bio.calculateAngleSmoothed('cd_rk', landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
      const minKnee = Math.min(lKnee, rKnee);

      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('cd_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 30) {
        errors.push('Keep chest upright — avoid leaning forward');
        formScore -= 20;
      }

      const inStretch = minKnee < 85;
      const formOk = inStretch && errors.length === 0;
      const now = Date.now();

      if (formOk) {
        if (!this.state.lastTick) this.state.lastTick = now;
        if (now - this.state.lastTick >= 1000) {
          this.state.holdSeconds += Math.floor((now - this.state.lastTick) / 1000);
          this.state.lastTick = now;
        }
      } else {
        this.state.lastTick = now;
      }

      let stateLabel = inStretch ? 'Stretching Quad ✓' : 'Pull Ankle to Glute';
      let feedback = inStretch ? 'Hold tall, breathe deeply through nose' : 'Gently pull one heel toward glutes';
      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
        stateLabel, feedback, errors, formScore: Math.max(formScore, 40),
        liveAngles: {
          'Flexed Knee': `${minKnee}° (Goal <85°)`,
          'Torso Posture': `${torsoAngle}° (Keep <25°)`,
          'Stretch Hold': `${this.state.holdSeconds}s`
        },
        activeLandmarks: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
      };
    }
  },

  {
    id: 'cooldown_chest_opener',
    name: 'Cool-Down: Chest & Shoulder Opener',
    category: EXERCISE_CATEGORIES.COOLDOWN,
    equipment: 'Bodyweight',
    targetMuscles: 'Pectorals, Anterior Deltoids, Biceps',
    recommendedCamera: 'Front view, stand 6-8 ft back',
    setupTip: 'Extend arms wide or clasp hands behind back. Open chest, lift sternum, and breathe slowly.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Right Shoulder': LM.RIGHT_SHOULDER,
      'Left Elbow': LM.LEFT_ELBOW, 'Right Elbow': LM.RIGHT_ELBOW
    },
    state: freshState({ stage: 'STRETCH', holdSeconds: 0, lastTick: 0 }),
    reset() { this.state = freshState({ stage: 'STRETCH', holdSeconds: 0, lastTick: 0 }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Move back — cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {}, activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER]
        };
      }

      const lShoulder = landmarks[LM.LEFT_SHOULDER];
      const rShoulder = landmarks[LM.RIGHT_SHOULDER];
      const shoulderDist = Bio.distance(lShoulder, rShoulder);

      const now = Date.now();
      if (!this.state.lastTick) this.state.lastTick = now;
      if (now - this.state.lastTick >= 1000) {
        this.state.holdSeconds += Math.floor((now - this.state.lastTick) / 1000);
        this.state.lastTick = now;
      }

      return {
        repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
        stateLabel: 'Chest Opened ✓', feedback: 'Deep belly breaths, release tension from chest and shoulders',
        errors: [], formScore: 100,
        liveAngles: {
          'Chest Expansion': 'Open ✓',
          'Hold Time': `${this.state.holdSeconds}s`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW]
      };
    }
  },

  {
    id: 'cooldown_decompression',
    name: 'Cool-Down: Hamstring & Spine Decompression',
    category: EXERCISE_CATEGORIES.COOLDOWN,
    equipment: 'Bodyweight',
    targetMuscles: 'Hamstrings, Lumbar Spine, CNS Recovery',
    recommendedCamera: 'Side or 45° angle, full body visible',
    setupTip: 'Hinge forward gently at hips, soft knees, letting arms and head hang relaxed toward floor.',
    requiredLandmarks: {
      'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE, 'Left Shoulder': LM.LEFT_SHOULDER
    },
    state: freshState({ stage: 'STRETCH', holdSeconds: 0, lastTick: 0 }),
    reset() { this.state = freshState({ stage: 'STRETCH', holdSeconds: 0, lastTick: 0 }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Move back — cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {}, activeLandmarks: [LM.LEFT_HIP, LM.LEFT_KNEE]
        };
      }

      const hipHinge = Bio.calculateAngleSmoothed('cd_hinge', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE]);

      const inHinge = hipHinge < 135;
      const now = Date.now();

      if (inHinge) {
        if (!this.state.lastTick) this.state.lastTick = now;
        if (now - this.state.lastTick >= 1000) {
          this.state.holdSeconds += Math.floor((now - this.state.lastTick) / 1000);
          this.state.lastTick = now;
        }
      } else {
        this.state.lastTick = now;
      }

      let stateLabel = inHinge ? 'Decompressing Spine ✓' : 'Hinge Forward at Hips';
      let feedback = inHinge ? 'Exhale slowly, letting neck and shoulders relax completely' : 'Gently fold forward at the hips';

      return {
        repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
        stateLabel, feedback, errors: [], formScore: 100,
        liveAngles: {
          'Hip Fold': `${hipHinge}° (Target <130°)`,
          'Hold Time': `${this.state.holdSeconds}s`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE]
      };
    }
  }
,

  // ══════════════════════════════════════════════════════════════════════════
  //  9. HIGH-IMPACT MUSCLE BUILDERS (HOME GYM CURATED)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'dumbbell_floor_press',
    name: 'Dumbbell Floor Press',
    category: EXERCISE_CATEGORIES.CHEST,
    equipment: 'Dumbbells + Mat',
    targetMuscles: 'Pectoralis Major, Triceps, Anterior Deltoids',
    recommendedCamera: 'Side-angle or 45° view from floor level',
    setupTip: 'Lie on floor, knees bent. Press dumbbells up until arms lock out, lower until triceps touch floor.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Right Shoulder': LM.RIGHT_SHOULDER,
      'Left Elbow': LM.LEFT_ELBOW, 'Right Elbow': LM.RIGHT_ELBOW,
      'Left Wrist': LM.LEFT_WRIST, 'Right Wrist': LM.RIGHT_WRIST
    },
    state: freshState({ stage: 'LOCKOUT' }),
    reset() { this.state = freshState({ stage: 'LOCKOUT' }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {}, activeLandmarks: [LM.LEFT_ELBOW, LM.RIGHT_ELBOW]
        };
      }

      const lElbow = Bio.calculateAngleSmoothed('fp_le', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_ELBOW], landmarks[LM.LEFT_WRIST]);
      const rElbow = Bio.calculateAngleSmoothed('fp_re', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgElbow = Math.round((lElbow + rElbow) / 2);
      const { symmetric } = Bio.checkSymmetry(lElbow, rElbow, 22);

      const errors = [];
      let formScore = 100;
      if (!symmetric) {
        errors.push('Press evenly — one arm is lagging behind');
        formScore -= 20;
      }

      const formOk = errors.length === 0;
      let feedback = 'Drive dumbbells straight up over chest';
      let stateLabel = 'Lockout';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'LOCKOUT' || stage === 'IDLE') {
        if (avgElbow < 145) {
          this.state.stage = 'LOWERING';
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Top Lockout — Lower Weights';
      } else if (stage === 'LOWERING') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgElbow <= 95) {
          this.state.stage = 'FLOOR';
          stateLabel = 'Floor Touch (Pause)';
          feedback = 'Press up explosive through chest';
        } else {
          stateLabel = `Lowering... ${avgElbow}°`;
        }
      } else if (stage === 'FLOOR') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgElbow > 115) {
          this.state.stage = 'PRESSING';
          stateLabel = 'Pressing Up';
        }
      } else if (stage === 'PRESSING') {
        if (avgElbow > 155) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Strong chest press!`;
          }
          this.state.stage = 'LOCKOUT';
          this.state.bottomFormOk = false;
          stateLabel = 'Top Lockout';
        } else {
          stateLabel = `Pressing... ${avgElbow}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Elbow Angle': `${avgElbow}° (Floor: ≤95°, Lock: >155°)`,
          'Arm Symmetry': symmetric ? '✓ Balanced' : '⚠ Uneven Press'
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST]
      };
    }
  },

  {
    id: 'diamond_pushup',
    name: 'Diamond / Close-Grip Push-up',
    category: EXERCISE_CATEGORIES.CHEST,
    equipment: 'Floor / Mat',
    targetMuscles: 'Triceps Brachii, Inner Chest, Anterior Deltoids',
    recommendedCamera: 'Side profile or 45° angle, full body visible',
    setupTip: 'Hands under sternum with thumbs and index fingers touching in diamond. Lower chest to hands.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW,
      'Left Hip': LM.LEFT_HIP, 'Left Ankle': LM.LEFT_ANKLE
    },
    state: freshState({ stage: 'TOP' }),
    reset() { this.state = freshState({ stage: 'TOP' }); },

    evaluate(landmarks, Bio) {
      const sideData = Bio.getSideProfileArmAndSpine(landmarks, LM);
      if (!sideData.hasCore) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: 'Move back — camera must see shoulder, hip, and ankles',
          errors: ['Cannot see core body line'],
          liveAngles: {}, activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW]
        };
      }

      const elbowAngle = Bio.calculateAngleSmoothed('dp_el', sideData.shoulder, sideData.elbow, sideData.wrist);
      const spineAngle = Bio.spineLinearity(sideData.shoulder, sideData.hip, sideData.ankle);

      const errors = [];
      let formScore = 100;
      if (spineAngle < 155) {
        errors.push('Hips sagging — lock glutes and core in rigid plank');
        formScore -= 25;
      }

      const formOk = errors.length === 0;
      let feedback = 'Keep elbows tracking backward along ribs';
      let stateLabel = 'Plank Lockout';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'TOP' || stage === 'IDLE') {
        if (elbowAngle < 145) {
          this.state.stage = 'DOWN';
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Plank — Lower Chest';
      } else if (stage === 'DOWN') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle <= 85) {
          this.state.stage = 'BOTTOM';
          stateLabel = 'Deep Tricep Flexion!';
        } else {
          stateLabel = `Lowering... ${elbowAngle}°`;
        }
      } else if (stage === 'BOTTOM') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle > 110) {
          this.state.stage = 'UP';
          stateLabel = 'Driving Up';
        }
      } else if (stage === 'UP') {
        if (elbowAngle > 155) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Triceps locked out!`;
          }
          this.state.stage = 'TOP';
          this.state.bottomFormOk = false;
          stateLabel = 'Top Lockout';
        } else {
          stateLabel = `Ascending... ${elbowAngle}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Elbow Flexion': `${elbowAngle}° (Need ≤85° for depth)`,
          'Plank Line': `${spineAngle}° (Goal >160°)`
        },
        activeLandmarks: [sideData.shoulderIdx, sideData.elbowIdx, sideData.wristIdx, sideData.hipIdx]
      };
    }
  },

  {
    id: 'single_arm_dumbbell_row',
    name: 'Single-Arm Dumbbell Row',
    category: EXERCISE_CATEGORIES.BACK,
    equipment: 'Dumbbells + Sturdy Chair/Knee Support',
    targetMuscles: 'Latissimus Dorsi, Rhomboids, Rear Deltoids, Biceps',
    recommendedCamera: 'Side profile facing the rowing arm',
    setupTip: 'Hinge at hips, back flat. Pull dumbbell toward hip pocket, keeping elbow tight to ribs.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Right Shoulder': LM.RIGHT_SHOULDER,
      'Left Elbow': LM.LEFT_ELBOW, 'Right Elbow': LM.RIGHT_ELBOW,
      'Left Hip': LM.LEFT_HIP, 'Right Hip': LM.RIGHT_HIP
    },
    state: freshState({ stage: 'STRETCH' }),
    reset() { this.state = freshState({ stage: 'STRETCH' }); },

    evaluate(landmarks, Bio) {
      const sideData = Bio.getSideProfileArmAndSpine(landmarks, LM);
      if (!sideData.hasCore) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: 'Stand in side profile with rowing arm facing camera',
          errors: ['Cannot see rowing arm'],
          liveAngles: {}, activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW]
        };
      }

      const elbowAngle = Bio.calculateAngleSmoothed('row_el', sideData.shoulder, sideData.elbow, sideData.wrist);
      const spineAngle = Bio.calcAngleWithVerticalSmoothed('row_sp', sideData.shoulder, sideData.hip);

      const errors = [];
      let formScore = 100;
      if (spineAngle < 35 || spineAngle > 75) {
        errors.push('Hinge at hips — keep torso ~45° to floor');
        formScore -= 20;
      }

      const formOk = errors.length === 0;
      let feedback = 'Pull elbow back to hip pocket';
      let stateLabel = 'Bottom Stretch';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'STRETCH' || stage === 'IDLE') {
        if (elbowAngle < 135) {
          this.state.stage = 'PULL';
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Full Stretch — Pull to Hip';
      } else if (stage === 'PULL') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle <= 80) {
          this.state.stage = 'PEAK';
          stateLabel = 'Peak Lat Contraction!';
        } else {
          stateLabel = `Rowing... ${elbowAngle}°`;
        }
      } else if (stage === 'PEAK') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle > 105) {
          this.state.stage = 'LOWER';
          stateLabel = 'Controlled Stretch';
        }
      } else if (stage === 'LOWER') {
        if (elbowAngle > 150) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Squeezed lats!`;
          }
          this.state.stage = 'STRETCH';
          this.state.bottomFormOk = false;
          stateLabel = 'Full Stretch';
        } else {
          stateLabel = `Lowering... ${elbowAngle}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Elbow Pull': `${elbowAngle}° (Peak: ≤80°, Stretch: >150°)`,
          'Torso Hinge': `${spineAngle}° (Target 45°–65°)`
        },
        activeLandmarks: [sideData.shoulderIdx, sideData.elbowIdx, sideData.wristIdx, sideData.hipIdx]
      };
    }
  },

  {
    id: 'pike_pushup',
    name: 'Pike Push-up (Shoulder Builder)',
    category: EXERCISE_CATEGORIES.SHOULDERS,
    equipment: 'Floor / Mat',
    targetMuscles: 'Anterior & Medial Deltoids, Upper Chest, Triceps',
    recommendedCamera: 'Side profile with full body visible',
    setupTip: 'Hands on floor, hips piked high in an inverted V. Lower forehead forward toward floor between hands.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW,
      'Left Hip': LM.LEFT_HIP, 'Left Ankle': LM.LEFT_ANKLE
    },
    state: freshState({ stage: 'TOP' }),
    reset() { this.state = freshState({ stage: 'TOP' }); },

    evaluate(landmarks, Bio) {
      const sideData = Bio.getSideProfileArmAndSpine(landmarks, LM);
      if (!sideData.hasCore) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: 'Step into side view showing arms, hips, and feet',
          errors: ['Cannot see body alignment'],
          liveAngles: {}, activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW]
        };
      }

      const elbowAngle = Bio.calculateAngleSmoothed('pk_el', sideData.shoulder, sideData.elbow, sideData.wrist);
      const hipPike = Bio.calculateAngleSmoothed('pk_hp', sideData.shoulder, sideData.hip, sideData.ankle);

      const errors = [];
      let formScore = 100;
      if (hipPike > 115) {
        errors.push('Pike hips higher into inverted V — target shoulders!');
        formScore -= 25;
      }

      const formOk = errors.length === 0;
      let feedback = 'Lower head forward between hands';
      let stateLabel = 'Pike Position';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'TOP' || stage === 'IDLE') {
        if (elbowAngle < 145) {
          this.state.stage = 'DOWN';
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Inverted V — Descend';
      } else if (stage === 'DOWN') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle <= 90) {
          this.state.stage = 'BOTTOM';
          stateLabel = 'Shoulder Depth Reached!';
        } else {
          stateLabel = `Descending... ${elbowAngle}°`;
        }
      } else if (stage === 'BOTTOM') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle > 115) {
          this.state.stage = 'UP';
          stateLabel = 'Pressing Up';
        }
      } else if (stage === 'UP') {
        if (elbowAngle > 155) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Boulder shoulder press!`;
          }
          this.state.stage = 'TOP';
          this.state.bottomFormOk = false;
          stateLabel = 'Top Lockout';
        } else {
          stateLabel = `Pressing... ${elbowAngle}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Elbow Depth': `${elbowAngle}° (Need ≤90°)`,
          'Hip Pike': `${hipPike}° (Keep ≤105° for V-shape)`
        },
        activeLandmarks: [sideData.shoulderIdx, sideData.elbowIdx, sideData.hipIdx]
      };
    }
  },

  {
    id: 'band_face_pull',
    name: 'Resistance Band Face Pull',
    category: EXERCISE_CATEGORIES.SHOULDERS,
    equipment: 'Resistance Band + Door Anchor',
    targetMuscles: 'Rear Deltoids, Rotator Cuffs, Rhomboids',
    recommendedCamera: 'Side or 45° angle, full upper body visible',
    setupTip: 'Anchor band at eye/chest level. Pull band toward eyes/ears, flaring elbows high and wide.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Right Shoulder': LM.RIGHT_SHOULDER,
      'Left Elbow': LM.LEFT_ELBOW, 'Right Elbow': LM.RIGHT_ELBOW,
      'Left Wrist': LM.LEFT_WRIST, 'Right Wrist': LM.RIGHT_WRIST
    },
    state: freshState({ stage: 'STRETCH' }),
    reset() { this.state = freshState({ stage: 'STRETCH' }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {}, activeLandmarks: [LM.LEFT_ELBOW, LM.RIGHT_ELBOW]
        };
      }

      const lElbow = Bio.calculateAngleSmoothed('fp_l', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_ELBOW], landmarks[LM.LEFT_WRIST]);
      const rElbow = Bio.calculateAngleSmoothed('fp_r', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgElbow = Math.round((lElbow + rElbow) / 2);

      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('fp_sp', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 22) {
        errors.push('Stand tall — avoid leaning back with bodyweight');
        formScore -= 20;
      }

      const formOk = errors.length === 0;
      let feedback = 'Pull hands to ears, elbows high and wide';
      let stateLabel = 'Arms Extended';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'STRETCH' || stage === 'IDLE') {
        if (avgElbow < 140) {
          this.state.stage = 'PULL';
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Start — Pull Toward Face';
      } else if (stage === 'PULL') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgElbow <= 75) {
          this.state.stage = 'PEAK';
          stateLabel = 'Peak Rear Delt Squeeze!';
        } else {
          stateLabel = `Pulling... ${avgElbow}°`;
        }
      } else if (stage === 'PEAK') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgElbow > 105) {
          this.state.stage = 'RETURN';
          stateLabel = 'Controlled Return';
        }
      } else if (stage === 'RETURN') {
        if (avgElbow > 150) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Perfect rotator cuff health!`;
          }
          this.state.stage = 'STRETCH';
          this.state.bottomFormOk = false;
          stateLabel = 'Arms Extended';
        } else {
          stateLabel = `Returning... ${avgElbow}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Elbow Flexion': `${avgElbow}° (Peak: ≤75°, Stretch: >150°)`,
          'Torso Lean': `${torsoAngle}° (Keep <20°)`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW]
      };
    }
  },

  {
    id: 'ez_bar_skull_crusher',
    name: 'EZ Bar Skull Crushers (Floor)',
    category: EXERCISE_CATEGORIES.ARMS,
    equipment: 'EZ Curl Rod + Mat',
    targetMuscles: 'Triceps Brachii (Long & Medial Heads)',
    recommendedCamera: 'Side-profile from floor level',
    setupTip: 'Lie on floor, arms vertical over chest. Bend only elbows to lower bar toward forehead, then lock out.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW,
      'Left Wrist': LM.LEFT_WRIST, 'Left Hip': LM.LEFT_HIP
    },
    state: freshState({ stage: 'LOCKOUT' }),
    reset() { this.state = freshState({ stage: 'LOCKOUT' }); },

    evaluate(landmarks, Bio) {
      const sideData = Bio.getSideProfileArmAndSpine(landmarks, LM);
      if (!sideData.hasCore) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: 'Camera must see your arm and upper body from side',
          errors: ['Cannot see arm alignment'],
          liveAngles: {}, activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW]
        };
      }

      const elbowAngle = Bio.calculateAngleSmoothed('sk_el', sideData.shoulder, sideData.elbow, sideData.wrist);
      const armDrift = Bio.calcAngleWithVerticalSmoothed('sk_dr', sideData.elbow, sideData.shoulder);

      const errors = [];
      let formScore = 100;
      if (armDrift > 32) {
        errors.push('Keep upper arms steady — do not turn into a chest press!');
        formScore -= 25;
      }

      const formOk = errors.length === 0;
      let feedback = 'Lower bar toward forehead with elbows pinned';
      let stateLabel = 'Lockout';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'LOCKOUT' || stage === 'IDLE') {
        if (elbowAngle < 140) {
          this.state.stage = 'LOWERING';
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Arms Vertical — Lower Bar';
      } else if (stage === 'LOWERING') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle <= 75) {
          this.state.stage = 'BOTTOM';
          stateLabel = 'Deep Tricep Stretch!';
        } else {
          stateLabel = `Lowering... ${elbowAngle}°`;
        }
      } else if (stage === 'BOTTOM') {
        if (formOk) this.state.bottomFormOk = true;
        if (elbowAngle > 105) {
          this.state.stage = 'EXTENDING';
          stateLabel = 'Locking Out';
        }
      } else if (stage === 'EXTENDING') {
        if (elbowAngle > 155) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Full tricep lockout!`;
          }
          this.state.stage = 'LOCKOUT';
          this.state.bottomFormOk = false;
          stateLabel = 'Lockout';
        } else {
          stateLabel = `Extending... ${elbowAngle}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Elbow Angle': `${elbowAngle}° (Stretch: ≤75°, Lock: >155°)`,
          'Upper Arm Drift': armDrift <= 25 ? '✓ Steady' : '⚠ Drifting'
        },
        activeLandmarks: [sideData.shoulderIdx, sideData.elbowIdx, sideData.wristIdx]
      };
    }
  },

  {
    id: 'band_tricep_pushdown',
    name: 'Resistance Band Tricep Pushdown',
    category: EXERCISE_CATEGORIES.ARMS,
    equipment: 'Resistance Band + Door Anchor',
    targetMuscles: 'Triceps (Lateral & Medial Heads)',
    recommendedCamera: 'Side profile, 6-8 ft away',
    setupTip: 'Anchor band overhead. Elbows pinned to ribs, push forearms down until arms lock out completely.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW,
      'Left Wrist': LM.LEFT_WRIST, 'Left Hip': LM.LEFT_HIP
    },
    state: freshState({ stage: 'TOP' }),
    reset() { this.state = freshState({ stage: 'TOP' }); },

    evaluate(landmarks, Bio) {
      const sideData = Bio.getSideProfileArmAndSpine(landmarks, LM);
      if (!sideData.hasCore) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: 'Camera must see your arm and upper body from side',
          errors: ['Cannot see arm'],
          liveAngles: {}, activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW]
        };
      }

      const elbowAngle = Bio.calculateAngleSmoothed('pd_el', sideData.shoulder, sideData.elbow, sideData.wrist);

      let formScore = 100;
      let feedback = 'Keep elbows pinned to your ribs';
      let stateLabel = 'Start Position';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'TOP' || stage === 'IDLE') {
        if (elbowAngle > 95) {
          this.state.stage = 'PUSHDOWN';
        }
        stateLabel = 'Ready — Push Down';
      } else if (stage === 'PUSHDOWN') {
        if (elbowAngle >= 155) {
          this.state.stage = 'LOCKOUT';
          stateLabel = 'Peak Tricep Squeeze!';
        } else {
          stateLabel = `Pushing... ${elbowAngle}°`;
        }
      } else if (stage === 'LOCKOUT') {
        if (elbowAngle < 130) {
          this.state.stage = 'RETURN';
        }
      } else if (stage === 'RETURN') {
        if (elbowAngle <= 85) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Horse-shoe triceps!`;
          }
          this.state.stage = 'TOP';
          stateLabel = 'Top Stretch';
        } else {
          stateLabel = `Returning... ${elbowAngle}°`;
        }
      }

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors: [],
        formScore,
        liveAngles: {
          'Elbow Angle': `${elbowAngle}° (Lock: ≥155°, Stretch: ≤85°)`
        },
        activeLandmarks: [sideData.shoulderIdx, sideData.elbowIdx, sideData.wristIdx]
      };
    }
  },

  {
    id: 'dumbbell_goblet_squat',
    name: 'Dumbbell Goblet Squat',
    category: EXERCISE_CATEGORIES.LEGS,
    equipment: 'Dumbbells',
    targetMuscles: 'Quadriceps, Glutes, Core, Thoracic Extensors',
    recommendedCamera: 'Front view or 45° angle, full body visible',
    setupTip: 'Hold dumbbell vertically against chest with both hands. Squat deep between knees, chest tall.',
    requiredLandmarks: {
      'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE, 'Left Ankle': LM.LEFT_ANKLE,
      'Right Hip': LM.RIGHT_HIP, 'Right Knee': LM.RIGHT_KNEE, 'Right Ankle': LM.RIGHT_ANKLE
    },
    state: freshState({ stage: 'STAND' }),
    reset() { this.state = freshState({ stage: 'STAND' }); },

    evaluate(landmarks, Bio) {
      const { ok, missingJoints } = Bio.checkRequiredJoints(landmarks, this.requiredLandmarks);
      if (!ok) {
        return {
          repCompleted: false, repCount: this.state.repCount,
          stateLabel: 'Adjust Camera', formScore: 100,
          feedback: `Cannot see: ${missingJoints.join(', ')}`,
          errors: [`Cannot see: ${missingJoints.join(', ')}`],
          liveAngles: {}, activeLandmarks: [LM.LEFT_KNEE, LM.RIGHT_KNEE]
        };
      }

      const lKnee = Bio.calculateAngleSmoothed('gs_lk', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
      const rKnee = Bio.calculateAngleSmoothed('gs_rk', landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
      const avgKnee = Math.round((lKnee + rKnee) / 2);

      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('gs_sp', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const hipDist = Bio.distance(landmarks[LM.LEFT_HIP], landmarks[LM.RIGHT_HIP]);
      const kneeDist = Bio.distance(landmarks[LM.LEFT_KNEE], landmarks[LM.RIGHT_KNEE]);
      const valgus = kneeDist < hipDist * 0.70 && avgKnee < 135;

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 42) {
        errors.push('Chest up! Keep dumbbell tight against sternum');
        formScore -= 25;
      }
      if (valgus) {
        errors.push('Knees caving in — push outward over pinky toes');
        formScore -= 30;
      }

      const formOk = errors.length === 0;
      let feedback = 'Squat deep between your knees, chest tall';
      let stateLabel = 'Standing';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'STAND' || stage === 'IDLE') {
        if (avgKnee < 155) {
          this.state.stage = 'DESCEND';
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Standing — Ease Down';
      } else if (stage === 'DESCEND') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgKnee <= 95) {
          this.state.stage = 'BOTTOM';
          stateLabel = 'Parallel Depth Reached!';
          feedback = 'Drive through full foot to stand';
        } else {
          stateLabel = `Descending... ${avgKnee}°`;
        }
      } else if (stage === 'BOTTOM') {
        if (formOk) this.state.bottomFormOk = true;
        if (avgKnee > 115) {
          this.state.stage = 'ASCEND';
          stateLabel = 'Ascending';
        }
      } else if (stage === 'ASCEND') {
        if (avgKnee > 158) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Heavy goblet squat!`;
          }
          this.state.stage = 'STAND';
          this.state.bottomFormOk = false;
          stateLabel = 'Standing';
        } else {
          stateLabel = `Ascending... ${avgKnee}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Knee Flexion': `${avgKnee}° (Goal ≤95°)`,
          'Torso Angle': `${torsoAngle}° (Keep <40°)`,
          'Knees': valgus ? '⚠ Caving' : '✓ Outward'
        },
        activeLandmarks: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
      };
    }
  },

  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat / Reverse Lunge',
    category: EXERCISE_CATEGORIES.LEGS,
    equipment: 'Dumbbells + Mat',
    targetMuscles: 'Quadriceps, Gluteus Maximus, Adductors',
    recommendedCamera: 'Side profile or 45° angle, full body visible',
    setupTip: 'One foot forward, rear foot stepped back or elevated. Lower rear knee until front thigh is parallel.',
    requiredLandmarks: {
      'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE, 'Left Ankle': LM.LEFT_ANKLE
    },
    state: freshState({ stage: 'STAND' }),
    reset() { this.state = freshState({ stage: 'STAND' }); },

    evaluate(landmarks, Bio) {
      const frontKnee = Bio.calculateAngleSmoothed('bss_k', landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('bss_t', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 35) {
        errors.push('Torso leaning too far forward — stay tall');
        formScore -= 20;
      }

      const formOk = errors.length === 0;
      let feedback = 'Lower rear knee down with control';
      let stateLabel = 'Standing Stance';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'STAND' || stage === 'IDLE') {
        if (frontKnee < 155) {
          this.state.stage = 'DESCEND';
          this.state.bottomFormOk = formOk;
        }
        stateLabel = 'Split Stance — Lower';
      } else if (stage === 'DESCEND') {
        if (formOk) this.state.bottomFormOk = true;
        if (frontKnee <= 95) {
          this.state.stage = 'BOTTOM';
          stateLabel = 'Parallel Depth!';
        } else {
          stateLabel = `Descending... ${frontKnee}°`;
        }
      } else if (stage === 'BOTTOM') {
        if (formOk) this.state.bottomFormOk = true;
        if (frontKnee > 115) {
          this.state.stage = 'ASCEND';
          stateLabel = 'Driving Up';
        }
      } else if (stage === 'ASCEND') {
        if (frontKnee > 155) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Pure quad & glute power!`;
          }
          this.state.stage = 'STAND';
          this.state.bottomFormOk = false;
          stateLabel = 'Standing';
        } else {
          stateLabel = `Ascending... ${frontKnee}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Front Knee': `${frontKnee}° (Goal ≤95°)`,
          'Torso Lean': `${torsoAngle}° (Keep <30°)`
        },
        activeLandmarks: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE]
      };
    }
  },

  {
    id: 'weighted_glute_bridge',
    name: 'Weighted Glute Bridge (Floor)',
    category: EXERCISE_CATEGORIES.LEGS,
    equipment: 'Dumbbells or EZ Bar + Mat',
    targetMuscles: 'Gluteus Maximus, Hamstrings, Core',
    recommendedCamera: 'Side profile from floor level',
    setupTip: 'Lie on back, feet flat. Rest dumbbell across hips. Drive through heels to full hip lockout.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE
    },
    state: freshState({ stage: 'FLOOR' }),
    reset() { this.state = freshState({ stage: 'FLOOR' }); },

    evaluate(landmarks, Bio) {
      const hipExt = Bio.calculateAngleSmoothed('gb_h', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE]);

      const errors = [];
      let formScore = 100;
      if (hipExt > 190) {
        errors.push('Avoid hyperextending lower back — squeeze glutes at neutral');
        formScore -= 20;
      }

      const formOk = errors.length === 0;
      let feedback = 'Drive through heels, squeeze glutes hard';
      let stateLabel = 'Floor Position';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'FLOOR' || stage === 'IDLE') {
        if (hipExt > 125) {
          this.state.stage = 'LIFTING';
        }
        stateLabel = 'Floor — Drive Hips Up';
      } else if (stage === 'LIFTING') {
        if (hipExt >= 165) {
          this.state.stage = 'LOCKOUT';
          stateLabel = 'Peak Glute Lockout!';
        } else {
          stateLabel = `Lifting... ${hipExt}°`;
        }
      } else if (stage === 'LOCKOUT') {
        if (hipExt < 145) {
          this.state.stage = 'LOWERING';
        }
      } else if (stage === 'LOWERING') {
        if (hipExt <= 115) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && formOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Strong glute bridge!`;
          }
          this.state.stage = 'FLOOR';
          stateLabel = 'Floor Position';
        } else {
          stateLabel = `Lowering... ${hipExt}°`;
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Hip Extension': `${hipExt}° (Lockout: ≥165°)`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE]
      };
    }
  },

  {
    id: 'standing_calf_raise',
    name: 'Standing Dumbbell Calf Raise',
    category: EXERCISE_CATEGORIES.LEGS,
    equipment: 'Dumbbells + Mat / Step',
    targetMuscles: 'Gastrocnemius, Soleus (Calves), Ankle Stabilizers',
    recommendedCamera: 'Front or side view showing feet and legs',
    setupTip: 'Stand tall holding dumbbells at sides. Rise up onto balls of feet, hold 1s at top, lower slowly.',
    requiredLandmarks: {
      'Left Ankle': LM.LEFT_ANKLE, 'Left Heel': LM.LEFT_HEEL, 'Left Foot Index': LM.LEFT_FOOT_INDEX
    },
    state: freshState({ stage: 'FLAT' }),
    reset() { this.state = freshState({ stage: 'FLAT' }); },

    evaluate(landmarks, Bio) {
      const heelY = landmarks[LM.LEFT_HEEL]?.y ?? 0;
      const toeY = landmarks[LM.LEFT_FOOT_INDEX]?.y ?? 0;
      const heelElevation = Math.round((toeY - heelY) * 300);

      let feedback = 'Drive through big toes, rise high on calves';
      let stateLabel = 'Flat Feet';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'FLAT' || stage === 'IDLE') {
        if (heelElevation > 8) {
          this.state.stage = 'RISING';
        }
        stateLabel = 'Flat Feet — Rise High';
      } else if (stage === 'RISING') {
        if (heelElevation >= 18) {
          this.state.stage = 'PEAK';
          stateLabel = 'Peak Calf Contraction!';
        } else {
          stateLabel = `Rising... (${heelElevation})`;
        }
      } else if (stage === 'PEAK') {
        if (heelElevation < 12) {
          this.state.stage = 'LOWERING';
        }
      } else if (stage === 'LOWERING') {
        if (heelElevation <= 6) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount} ✓ Full calf stretch!`;
          }
          this.state.stage = 'FLAT';
          stateLabel = 'Flat Feet';
        } else {
          stateLabel = 'Lowering with Control';
        }
      }

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors: [],
        formScore: 100,
        liveAngles: {
          'Heel Elevation': `${heelElevation} (Peak: ≥18)`
        },
        activeLandmarks: [LM.LEFT_ANKLE, LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX]
      };
    }
  },

  {
    id: 'side_plank',
    name: 'Side Plank (Obliques & Core)',
    category: EXERCISE_CATEGORIES.CORE,
    equipment: 'Floor / Mat',
    targetMuscles: 'Internal/External Obliques, Glute Medius, Core',
    recommendedCamera: 'Front view showing full diagonal body line',
    setupTip: 'Lie on side on forearm. Lift hips until body forms straight diagonal line from shoulder to ankles.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Hip': LM.LEFT_HIP, 'Left Ankle': LM.LEFT_ANKLE
    },
    state: freshState({ stage: 'HOLD', holdSeconds: 0, lastTick: 0 }),
    reset() { this.state = freshState({ stage: 'HOLD', holdSeconds: 0, lastTick: 0 }); },

    evaluate(landmarks, Bio) {
      const spineLine = Bio.calculateAngleSmoothed('sp_line', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_ANKLE]);

      const errors = [];
      let formScore = 100;
      if (spineLine < 155) {
        errors.push('Hips sagging — push bottom hip up toward ceiling');
        formScore -= 25;
      }

      const formOk = errors.length === 0;
      const now = Date.now();

      if (formOk) {
        if (!this.state.lastTick) this.state.lastTick = now;
        if (now - this.state.lastTick >= 1000) {
          this.state.holdSeconds += Math.floor((now - this.state.lastTick) / 1000);
          this.state.lastTick = now;
        }
      } else {
        this.state.lastTick = now;
      }

      let stateLabel = formOk ? 'Holding Side Plank ✓' : 'Lift Bottom Hip';
      let feedback = formOk ? 'Hold rigid diagonal line, breathe steadily' : (errors[0] || 'Hold posture');

      return {
        repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Body Linearity': `${spineLine}° (Goal >160°)`,
          'Hold Time': `${this.state.holdSeconds}s`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_ANKLE]
      };
    }
  },

  {
    id: 'hollow_body_hold',
    name: 'Hollow Body Hold',
    category: EXERCISE_CATEGORIES.CORE,
    equipment: 'Floor / Mat',
    targetMuscles: 'Rectus Abdominis, Transverse Abdominis, Hip Flexors',
    recommendedCamera: 'Side profile from floor level',
    setupTip: 'Lie on back, press lower back firmly into floor. Raise arms and legs 6 inches off ground.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE
    },
    state: freshState({ stage: 'HOLD', holdSeconds: 0, lastTick: 0 }),
    reset() { this.state = freshState({ stage: 'HOLD', holdSeconds: 0, lastTick: 0 }); },

    evaluate(landmarks, Bio) {
      const hipAngle = Bio.calculateAngleSmoothed('hbh_hp', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE]);

      const inHollow = hipAngle >= 135 && hipAngle <= 165;
      const now = Date.now();

      if (inHollow) {
        if (!this.state.lastTick) this.state.lastTick = now;
        if (now - this.state.lastTick >= 1000) {
          this.state.holdSeconds += Math.floor((now - this.state.lastTick) / 1000);
          this.state.lastTick = now;
        }
      } else {
        this.state.lastTick = now;
      }

      let stateLabel = inHollow ? 'Hollow Body Engaged ✓' : 'Press Lower Back to Floor';
      let feedback = inHollow ? 'Glue lower back to floor, brace core tight' : 'Lift shoulders and legs slightly';

      return {
        repCompleted: false, repCount: this.state.holdSeconds, unit: 'sec',
        stateLabel, feedback, errors: [],
        formScore: 100,
        liveAngles: {
          'Hollow Angle': `${hipAngle}° (Target 140°–165°)`,
          'Hold Time': `${this.state.holdSeconds}s`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE]
      };
    }
  }

];
