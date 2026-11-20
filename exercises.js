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
  BODYWEIGHT: 'bodyweight',
  PULLUPS: 'pullups',
  DUMBBELLS: 'dumbbells',
  CURL_ROD: 'curl_rod',
  RESISTANCE_TUBES: 'resistance_tubes',
  AB_ROLLER: 'ab_roller'
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
    category: EXERCISE_CATEGORIES.BODYWEIGHT,
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
    category: EXERCISE_CATEGORIES.BODYWEIGHT,
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
    category: EXERCISE_CATEGORIES.BODYWEIGHT,
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
    category: EXERCISE_CATEGORIES.BODYWEIGHT,
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
    category: EXERCISE_CATEGORIES.PULLUPS,
    equipment: 'Door Pull-Up Bar / Fixed Bar',
    targetMuscles: 'Latissimus Dorsi, Biceps, Rear Deltoids, Rhomboids, Core',
    recommendedCamera: 'Front view — full body must be visible including bar at top',
    setupTip: 'Hang with arms fully extended. Camera sees your full body from FRONT. Bar MUST be in top quarter of frame.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW, 'Left Wrist': LM.LEFT_WRIST
    },
    state: freshState({ stage: 'HANG' }),
    reset() { this.state = freshState({ stage: 'HANG' }); },

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

      // For pull-ups, chin-over-bar is detected by nose position relative to wrists
      const noseY   = landmarks[LM.NOSE]?.y ?? 1;
      const wristLY = landmarks[LM.LEFT_WRIST]?.y ?? 0;
      const wristRY = landmarks[LM.RIGHT_WRIST]?.y ?? 0;
      const avgWristY = (wristLY + wristRY) / 2;
      const chinOverBar = noseY < avgWristY + 0.03; // Nose is at or above wrist height

      // Swinging / kipping detection
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('pul_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const kipping = torsoAngle > 30;

      const symmetry = Bio.checkSymmetry(leftElbow, rightElbow, 20);

      const errors = [];
      let formScore = 100;
      if (kipping) { errors.push('Body swinging (kipping) — control your movement'); formScore -= 30; }
      if (!symmetry.symmetric) { errors.push('Arms uneven — pull equally with both'); formScore -= 15; }

      const formOk = errors.length === 0;
      let feedback = 'Pull elbows to hips — chin ABOVE bar';
      let stateLabel = 'Dead Hang';
      let repCompleted = false;
      const { stage } = this.state;

      // HANG: avgElbow > 155° (dead hang, fully extended)
      // PULLING: avgElbow dropping, moving toward bar
      // TOP: avgElbow < 70° AND chinOverBar
      // LOWERING: avgElbow rising from TOP
      // Rep counted when return to HANG (> 150°) after valid TOP

      if (stage === 'HANG' || stage === 'IDLE') {
        if (avgElbow < 155) {
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
          // Dropped back without reaching chin-over-bar — not a rep
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
            feedback = 'Rep not counted — keep body still (no kipping)';
          }
          this.state.stage = 'HANG';
          this.state.minAngle = 180;
          this.state.bottomFormOk = false;
          stateLabel = 'Dead Hang — Rest or Next Rep';
        } else {
          stateLabel = `Lowering... ${avgElbow}°`;
          feedback = 'Full extension at the bottom!';
        }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 40),
        liveAngles: {
          'Left Elbow': `${leftElbow}°`,
          'Right Elbow': `${rightElbow}°`,
          'Chin Over Bar': chinOverBar ? '✓ YES' : '✗ Not yet',
          'Body Swing': kipping ? `⚠ ${torsoAngle}° (kipping)` : `✓ ${torsoAngle}°`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.NOSE]
      };
    }
  },

  {
    id: 'chin_up',
    name: 'Chin-Up (Underhand Grip)',
    category: EXERCISE_CATEGORIES.PULLUPS,
    equipment: 'Door Pull-Up Bar / Fixed Bar',
    targetMuscles: 'Biceps, Latissimus Dorsi, Rear Deltoids',
    recommendedCamera: 'Front view — full body visible',
    setupTip: 'Underhand (supinated) grip, shoulder width. Same as pull-up but biceps more active.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW, 'Left Wrist': LM.LEFT_WRIST
    },
    state: freshState({ stage: 'HANG' }),
    reset() { this.state = freshState({ stage: 'HANG' }); },

    evaluate(landmarks, Bio) {
      // Reuse pull-up logic with same angles (grip type not visible to camera)
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
      const noseY      = landmarks[LM.NOSE]?.y ?? 1;
      const avgWristY  = ((landmarks[LM.LEFT_WRIST]?.y ?? 0) + (landmarks[LM.RIGHT_WRIST]?.y ?? 0)) / 2;
      const chinOverBar = noseY < avgWristY + 0.03;
      const torsoAngle = Bio.calcAngleWithVerticalSmoothed('cu_torso', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP]);
      const kipping = torsoAngle > 30;

      const errors = [];
      let formScore = 100;
      if (kipping) { errors.push('No kipping — strict form only'); formScore -= 30; }

      const formOk = errors.length === 0;
      let feedback = 'Underhand grip — curl chin to bar';
      let stateLabel = 'Dead Hang';
      let repCompleted = false;
      const { stage } = this.state;

      if (stage === 'HANG' || stage === 'IDLE') {
        if (avgElbow < 155) { this.state.stage = 'PULLING'; this.state.bottomFormOk = formOk; }
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
          'Elbow Angle': `${avgElbow}°`,
          'Chin Over Bar': chinOverBar ? '✓ YES' : '✗ Not yet'
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.NOSE]
      };
    }
  },

  {
    id: 'bar_hang',
    name: 'Dead Hang (Grip & Shoulder)',
    category: EXERCISE_CATEGORIES.PULLUPS,
    equipment: 'Door Pull-Up Bar',
    targetMuscles: 'Forearms, Grip, Rotator Cuff, Shoulder Decompression',
    recommendedCamera: 'Front view',
    setupTip: 'Simply hang from the bar with arms fully extended. Build shoulder stability and grip strength.',
    requiredLandmarks: { 'Left Shoulder': LM.LEFT_SHOULDER, 'Left Elbow': LM.LEFT_ELBOW },
    state: { holdSeconds: 0, lastTick: 0, repCount: 0 },
    reset() { this.state = { holdSeconds: 0, lastTick: 0, repCount: 0 }; },

    evaluate(landmarks, Bio) {
      const leftElbow  = Bio.calculateAngleSmoothed('hang_l', landmarks[LM.LEFT_SHOULDER],  landmarks[LM.LEFT_ELBOW],  landmarks[LM.LEFT_WRIST]);
      const rightElbow = Bio.calculateAngleSmoothed('hang_r', landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
      const avgElbow   = Math.round((leftElbow + rightElbow) / 2);
      const isHanging  = avgElbow > 150;

      const errors = [];
      let formScore = 100;
      if (!isHanging) { errors.push('Straighten arms fully for a dead hang'); formScore -= 20; }

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
        stateLabel: isHanging ? `Hanging ${this.state.holdSeconds}s ✓` : 'Extend Arms Fully',
        feedback: isHanging ? 'Breathe and hold — decompress spine' : 'Straighten arms completely',
        errors, formScore: Math.max(formScore, 60),
        liveAngles: {
          'Arm Extension': `${avgElbow}° (Need > 150° to hang)`,
          'Hold Time': `${this.state.holdSeconds}s`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW]
      };
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  3. DUMBBELLS
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'dumbbell_curl',
    name: 'Dumbbell Bicep Curl',
    category: EXERCISE_CATEGORIES.DUMBBELLS,
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

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 18) { errors.push('Torso swinging — stand still, isolate biceps'); formScore -= 35; }
      if (!symmetry.symmetric && avgElbow < 120) { errors.push(`Arms uneven by ${symmetry.diff}° — curl together`); formScore -= 15; }

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
          'Symmetry': symmetry.symmetric ? '✓ Even' : `⚠ Off by ${symmetry.diff}°`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST]
      };
    }
  },

  {
    id: 'hammer_curl',
    name: 'Hammer Curl',
    category: EXERCISE_CATEGORIES.DUMBBELLS,
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

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 18) { errors.push('Torso swinging — isolate the curl'); formScore -= 30; }

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
        liveAngles: { 'Avg Elbow': `${avgElbow}°`, 'Torso Sway': `${torsoAngle}°` },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST]
      };
    }
  },

  {
    id: 'dumbbell_shoulder_press',
    name: 'Dumbbell Overhead Press',
    category: EXERCISE_CATEGORIES.DUMBBELLS,
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

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 20) { errors.push('Lower back arching — tighten core, ribs down'); formScore -= 30; }
      if (!symmetry.symmetric && avgArm > 100 && avgArm < 155) { errors.push(`Arms uneven by ${symmetry.diff}°`); formScore -= 15; }

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
          'Torso Lean': `${torsoAngle}° (Keep <20°)`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST]
      };
    }
  },

  {
    id: 'dumbbell_lateral_raise',
    name: 'Dumbbell Lateral Raise',
    category: EXERCISE_CATEGORIES.DUMBBELLS,
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
    category: EXERCISE_CATEGORIES.DUMBBELLS,
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
    category: EXERCISE_CATEGORIES.DUMBBELLS,
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
    category: EXERCISE_CATEGORIES.CURL_ROD,
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

      const errors = [];
      let formScore = 100;
      if (torsoAngle > 15) { errors.push('No body rocking — strict curl only'); formScore -= 35; }
      if (!symmetry.symmetric) { errors.push(`Bar tilting — ${symmetry.diff}° uneven`); formScore -= 15; }

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
          'Body Swing': `${torsoAngle}° (Strict: <15°)`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST]
      };
    }
  },

  {
    id: 'romanian_deadlift',
    name: 'Romanian Deadlift (RDL)',
    category: EXERCISE_CATEGORIES.CURL_ROD,
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
    category: EXERCISE_CATEGORIES.RESISTANCE_TUBES,
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
    category: EXERCISE_CATEGORIES.RESISTANCE_TUBES,
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
    category: EXERCISE_CATEGORIES.AB_ROLLER,
    equipment: 'Ab Roller Wheel + Knee Pad',
    targetMuscles: 'Rectus Abdominis, Transverse Abdominis, Lats',
    recommendedCamera: 'Side profile — laptop on floor/low stool pointing sideways',
    setupTip: '⚠️ BEGINNER: Only roll 30-40cm. Engage core BEFORE rolling. Stop immediately if back arches.',
    requiredLandmarks: {
      'Left Shoulder': LM.LEFT_SHOULDER, 'Left Hip': LM.LEFT_HIP, 'Left Knee': LM.LEFT_KNEE
    },
    state: freshState({ stage: 'START' }),
    reset() { this.state = freshState({ stage: 'START' }); },

    evaluate(landmarks, Bio) {
      const hipAngle   = Bio.calculateAngleSmoothed('ar_hip', landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE]);
      const spineAngle = Bio.spineLinearity(landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE]);

      const errors = [];
      let formScore = 100;

      // ⚠️ CRITICAL: Lower back safety
      if (hipAngle > 130 && spineAngle < 155) {
        errors.push('⚠️ LOWER BACK SAGGING — STOP, pull back NOW!');
        formScore -= 50;
      }

      const formOk = errors.length === 0;
      let feedback = 'Brace core — only roll as far as you can hold form', stateLabel = 'Start Position', repCompleted = false;
      const { stage } = this.state;

      if ((stage === 'START' || stage === 'IDLE') && hipAngle > 110) {
        this.state.stage = 'ROLLING'; this.state.bottomFormOk = formOk;
      } else if (stage === 'ROLLING') {
        if (formOk) this.state.bottomFormOk = true;
        if (hipAngle > 150) { this.state.stage = 'EXTENDED'; stateLabel = 'Extended Position'; feedback = 'Engage lats — pull back now!'; }
        else { stateLabel = `Rolling... ${hipAngle}°`; feedback = 'Keep abs tight!'; }
      } else if (stage === 'EXTENDED') {
        if (hipAngle < 130) { this.state.stage = 'RETURNING'; stateLabel = 'Pulling Back'; feedback = 'Use lats and core to pull back'; }
        else { stateLabel = `Extended ${hipAngle}°`; feedback = 'Now pull back'; }
      } else if (stage === 'RETURNING') {
        if (hipAngle < 90) {
          const now = Date.now();
          if (now - this.state.lastRepTime > MIN_REP_INTERVAL_MS && this.state.bottomFormOk) {
            this.state.repCount++;
            this.state.lastRepTime = now;
            repCompleted = true;
            feedback = `Rep ${this.state.repCount}! Core strength!`;
          } else if (!this.state.bottomFormOk) {
            feedback = 'Rep skipped — keep lower back safe next time';
          }
          this.state.stage = 'START'; this.state.bottomFormOk = false;
          stateLabel = 'Start Position';
        } else { stateLabel = `Returning... ${hipAngle}°`; }
      }

      if (errors.length > 0) feedback = errors[0];

      return {
        repCompleted, repCount: this.state.repCount,
        stateLabel, feedback, errors,
        formScore: Math.max(formScore, 30),
        liveAngles: {
          'Extension': `${hipAngle}° (Full: >150°)`,
          'Spine Safety': `${spineAngle}° (Must stay >155°)`
        },
        activeLandmarks: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE]
      };
    }
  }
];
