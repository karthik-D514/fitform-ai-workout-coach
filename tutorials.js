/**
 * FitForm AI — Tutorial Database
 *
 * Each exercise entry has:
 *   - youtubeId        : YouTube video ID (embedded when online)
 *   - youtubeTitle     : Human-readable title shown in the player header
 *   - keyPoints        : Bullet-point cues shown ALWAYS (online & offline)
 *   - commonMistakes   : What beginners get wrong (always visible)
 *   - skeletonFrames   : Array of pose keyframe descriptors for offline
 *                        stick-figure animation (angle snapshots per phase)
 *   - cameraSetup      : Step-by-step positioning instructions for YOUR setup
 *   - breathingCue     : When to inhale/exhale
 */

export const TUTORIALS = {

  // ─── BODYWEIGHT ────────────────────────────────────────────────────────────

  bodyweight_squat: {
    youtubeId: 'gsNoPYwWXeM',
    youtubeTitle: 'Perfect Squat Form for Beginners — Alan Thrall',
    keyPoints: [
      'Feet shoulder-width apart, toes 15–30° outward',
      'Push knees outward OVER the toes throughout the squat',
      'Keep chest tall — do not let it collapse toward the floor',
      'Drive through your FULL FOOT (not just heels or toes)',
      'Reach parallel or below (thighs horizontal = good depth)',
      'Squeeze glutes at the top of every rep for full lockout',
    ],
    commonMistakes: [
      '❌ Heels lifting off the floor (insufficient ankle mobility)',
      '❌ Knees caving inward (weak glutes or poor motor control)',
      '❌ Excessive forward lean (tight hips or weak upper back)',
      '❌ Not reaching depth — stop at first discomfort, not 45°',
      '❌ Looking down instead of forward/slightly up',
    ],
    cameraSetup: [
      '📏 Distance: Place laptop 6–8 ft (2–2.5 m) in front of you',
      '📐 Height: Laptop camera at hip height (on a chair or stool)',
      '📷 Angle: Directly in front (front view) for knee tracking',
      '🧍 Framing: Your full body from head to toes must be visible',
    ],
    breathingCue: 'Inhale at the top → Hold or exhale as you descend → Exhale as you drive up',
    skeletonFrames: [
      { label: 'Start — Standing', kneeAngle: 175, hipAngle: 170, torso: 5 },
      { label: 'Descending', kneeAngle: 130, hipAngle: 120, torso: 25 },
      { label: 'Bottom (Parallel)', kneeAngle: 90, hipAngle: 90, torso: 35 },
      { label: 'Ascending', kneeAngle: 130, hipAngle: 120, torso: 25 },
      { label: 'Lockout', kneeAngle: 175, hipAngle: 170, torso: 5 },
    ],
  },

  pushup: {
    youtubeId: 'IODxDxX7oi4',
    youtubeTitle: 'The Perfect Push-Up — Jeff Nippard',
    keyPoints: [
      'Form a rigid plank line from heels through hips to shoulders',
      'Hands just outside shoulder width, fingers spread for stability',
      'Lower elbows at ~45° to your torso (not 90° flared out)',
      'Touch or hover chest at the bottom — do not stop halfway',
      'Full lockout at the top — do not rush past this',
      'Squeeze core and glutes throughout the entire movement',
    ],
    commonMistakes: [
      '❌ Hips sagging (weak core — stop, squeeze abs harder)',
      '❌ Hips piked too high (looks like a mountain)',
      '❌ Flaring elbows out to 90° (puts shoulder at injury risk)',
      '❌ Partial reps — not reaching full depth or full extension',
      '❌ Head dropping forward (keep chin tucked slightly)',
    ],
    cameraSetup: [
      '📏 Distance: Laptop 4–5 ft (1.2–1.5 m) to your side',
      '📐 Height: Laptop camera at FLOOR LEVEL (on the ground)',
      '📷 Angle: Strictly from the side (90° profile view)',
      '🧍 Framing: Head, shoulders, hips and feet all visible',
    ],
    breathingCue: 'Inhale as you lower → Exhale as you push up',
    skeletonFrames: [
      { label: 'Top — Plank', elbowAngle: 170 },
      { label: 'Lowering', elbowAngle: 120 },
      { label: 'Bottom (Chest Down)', elbowAngle: 85 },
      { label: 'Pushing Up', elbowAngle: 120 },
      { label: 'Full Lockout', elbowAngle: 170 },
    ],
  },

  plank: {
    youtubeId: '1OC_yjcMcpk',
    youtubeTitle: 'How to Do a Plank with Perfect Form',
    keyPoints: [
      'Forearms on floor, elbows directly under shoulders',
      'Body forms one straight line: ankle → hip → shoulder → ear',
      'Pull navel in toward spine — brace like taking a punch',
      'Squeeze glutes to prevent hip sag',
      'Breathe steadily — do not hold your breath',
    ],
    commonMistakes: [
      '❌ Hips dropping (most common — tighten core NOW)',
      '❌ Hips rising too high (pike position)',
      '❌ Head hanging down or craning upward',
      '❌ Holding breath (increases blood pressure unnecessarily)',
    ],
    cameraSetup: [
      '📏 Distance: Laptop 4–5 ft to your side on the floor',
      '📐 Height: Camera at floor/ground level',
      '📷 Angle: Pure side profile — 90° from your body',
      '🧍 Framing: Whole body from toes to head in frame',
    ],
    breathingCue: 'Breathe steadily in through nose, out through mouth',
    skeletonFrames: [
      { label: 'Good Plank', spineAngle: 178 },
      { label: 'Hip Sag ❌', spineAngle: 148 },
      { label: 'Hip Pike ❌', spineAngle: 210 },
    ],
  },

  lunge: {
    youtubeId: 'eFWCn5iEbTU',
    youtubeTitle: 'How to Do Lunges with Perfect Form',
    keyPoints: [
      'Step forward so front shin is vertical (knee above ankle)',
      'Lower back knee hovers just above the floor',
      'Keep torso upright — do not lean forward',
      'Push back to start through the front heel',
      'Alternate legs each rep, or do all reps one side then switch',
    ],
    commonMistakes: [
      '❌ Front knee collapsing inward',
      '❌ Leaning torso forward excessively',
      '❌ Back knee crashing to the floor',
      '❌ Short stride making front knee shoot over toes',
    ],
    cameraSetup: [
      '📷 Angle: 45°–90° side profile to track front knee position',
      '📏 Distance: 5–7 ft away, full body visible',
    ],
    breathingCue: 'Inhale as you step and lower → Exhale as you push back up',
    skeletonFrames: [
      { label: 'Standing', frontKnee: 175 },
      { label: 'Step & Lower', frontKnee: 90 },
      { label: 'Push Back', frontKnee: 140 },
    ],
  },

  // ─── PULL-UPS ──────────────────────────────────────────────────────────────

  pullup: {
    youtubeId: 'eGo4IYlbE5g',
    youtubeTitle: 'How to Do Your First Pull-Up — Perfect Form',
    keyPoints: [
      'Overhand (pronated) grip slightly wider than shoulder-width',
      'Start from a DEAD HANG — arms fully extended, shoulders active',
      'Depress scapulae first (pull shoulder blades down and together)',
      'Drive elbows toward the floor/hips — not backward',
      'Chin clears the bar at the top (or forehead to bar)',
      'Lower SLOWLY back to full dead hang — do not drop',
    ],
    commonMistakes: [
      '❌ Kipping / swinging (hides weak muscles, risk of injury)',
      '❌ Not reaching dead hang at bottom (half reps = slower progress)',
      '❌ Using only arms — back muscles should do most of the work',
      '❌ Shrugging shoulders up instead of depressing them',
      '❌ Bar hitting chin but chest never touching bar height',
    ],
    cameraSetup: [
      '📏 Distance: Laptop 6–8 ft in front of the door/bar',
      '📐 Height: Camera at chest/mid-torso height',
      '📷 Angle: Front view — bar visible at top of frame, feet at bottom',
      '🚪 Setup: Use a door pull-up bar in a doorframe',
      '⚠️ Safety: Ensure bar is locked/rated for your weight before use',
    ],
    breathingCue: 'Exhale as you pull up → Inhale as you lower down',
    skeletonFrames: [
      { label: 'Dead Hang', elbowAngle: 170 },
      { label: 'Pulling Up', elbowAngle: 110 },
      { label: 'Chin Over Bar ✓', elbowAngle: 60 },
      { label: 'Lowering', elbowAngle: 110 },
      { label: 'Dead Hang', elbowAngle: 170 },
    ],
  },

  chin_up: {
    youtubeId: 'brhRXlOhsAM',
    youtubeTitle: 'Chin-Up vs Pull-Up — Proper Form Guide',
    keyPoints: [
      'Underhand (supinated) grip at shoulder-width',
      'Biceps are more active than pull-up — great for arm growth',
      'Same dead-hang start and chin-over-bar finish',
      'Elbows travel slightly more forward than in pull-ups',
    ],
    commonMistakes: [
      '❌ Letting elbows flare wide to the sides',
      '❌ Neck straining to get chin over bar',
      '❌ Short range of motion — not fully extending at bottom',
    ],
    cameraSetup: [
      '📏 Distance: 6–8 ft in front of door bar',
      '📷 Angle: Front view — full body from hands to feet',
    ],
    breathingCue: 'Exhale on the pull-up → Inhale on the way down',
    skeletonFrames: [
      { label: 'Dead Hang', elbowAngle: 170 },
      { label: 'Chin Over Bar', elbowAngle: 60 },
    ],
  },

  bar_hang: {
    youtubeId: 'fqx6CBKMtIw',
    youtubeTitle: 'Dead Hang — Benefits, Form & How Long to Hold',
    keyPoints: [
      'Simply hang with arms fully extended from the bar',
      'Actively depress and retract scapulae (don\'t just passively hang)',
      'Builds grip strength, decompresses spine, strengthens shoulders',
      'Start with 3 × 20-second hangs, build to 60 seconds',
    ],
    commonMistakes: [
      '❌ Passive hanging (shrugging shoulders up — engage them down)',
      '❌ Bending elbows — keep arms straight',
    ],
    cameraSetup: [
      '📏 Distance: 5–7 ft in front of bar',
      '📷 Angle: Front view, bar at top of frame',
    ],
    breathingCue: 'Breathe steadily — do not hold breath during the hang',
    skeletonFrames: [
      { label: 'Dead Hang', elbowAngle: 170 },
    ],
  },

  // ─── DUMBBELLS ────────────────────────────────────────────────────────────

  dumbbell_curl: {
    youtubeId: 'ykJmrZ5v0Oo',
    youtubeTitle: 'How to Do Dumbbell Bicep Curls with Perfect Form',
    keyPoints: [
      'Start with dumbbells at sides, palms forward (supinated)',
      'Pin your elbows firmly against your ribs — they must NOT move',
      'Curl up until biceps are fully contracted (forearm touches bicep)',
      'At the top, externally rotate slightly (little-finger side up)',
      'Lower SLOWLY (3 seconds down) — the eccentric builds more muscle',
      'Full extension at the bottom — do not curl from halfway',
    ],
    commonMistakes: [
      '❌ Swinging body back to generate momentum (cheating)',
      '❌ Elbows drifting forward during the curl',
      '❌ Dropping weight fast on the way down (wasted eccentric)',
      '❌ Partial range — not fully extending at bottom',
      '❌ Both arms not moving together',
    ],
    cameraSetup: [
      '📏 Distance: 5–7 ft directly in front',
      '📷 Angle: Front view — arms and torso must be visible',
      '📐 Height: Camera at torso/chest height',
    ],
    breathingCue: 'Exhale as you curl up → Inhale as you lower down',
    skeletonFrames: [
      { label: 'Arms Extended', elbowAngle: 165 },
      { label: 'Curling', elbowAngle: 100 },
      { label: 'Peak Contraction', elbowAngle: 50 },
      { label: 'Lowering', elbowAngle: 100 },
    ],
  },

  hammer_curl: {
    youtubeId: 'TwD-YGVP4Bk',
    youtubeTitle: 'Hammer Curl — Perfect Form for Bigger Arms',
    keyPoints: [
      'Neutral grip: thumbs pointing up, palms facing each other',
      'Same movement as bicep curl but neutral wrist position',
      'Hits brachialis (between bicep and tricep) — adds arm thickness',
      'Keep upper arms pinned to sides — only forearms move',
    ],
    commonMistakes: [
      '❌ Rotating the wrist to supinate during the curl',
      '❌ Swinging body — strict form only',
    ],
    cameraSetup: [
      '📏 Distance: 5–7 ft in front',
      '📷 Angle: Front or slight 45° — both arms visible',
    ],
    breathingCue: 'Exhale up → Inhale down',
    skeletonFrames: [
      { label: 'Bottom', elbowAngle: 165 },
      { label: 'Peak', elbowAngle: 50 },
    ],
  },

  dumbbell_shoulder_press: {
    youtubeId: 'B-aVuyhvLHU',
    youtubeTitle: 'Dumbbell Shoulder Press — Perfect Form Guide',
    keyPoints: [
      'Start: dumbbells at ear level, elbows at ~90° (goalpost position)',
      'Press STRAIGHT up overhead — not forward',
      'At lockout: arms fully extended, biceps close to ears',
      'BRACE YOUR CORE throughout — no lower back arch',
      'Lower slowly back to ear level for each rep',
    ],
    commonMistakes: [
      '❌ Arching lower back excessively (dangerous — tighten abs)',
      '❌ Pressing forward instead of straight up',
      '❌ One arm leading the other (control symmetry)',
      '❌ Not reaching full overhead lockout',
    ],
    cameraSetup: [
      '📏 Distance: 5–7 ft in front or slight angle',
      '📷 Angle: Front view — full overhead range must be visible',
      '⚠️ Seated variation: Sit on a chair with back support as a beginner',
    ],
    breathingCue: 'Exhale as you press up → Inhale as you lower',
    skeletonFrames: [
      { label: 'Rack Position', armAngle: 85 },
      { label: 'Pressing Up', armAngle: 130 },
      { label: 'Full Lockout', armAngle: 165 },
      { label: 'Lowering', armAngle: 110 },
    ],
  },

  dumbbell_lateral_raise: {
    youtubeId: 'FeKT5RQJRR0',
    youtubeTitle: 'Lateral Raises — The Correct Way for Shoulder Growth',
    keyPoints: [
      'Slight bend at the elbow (10–15°) — do not use straight arms',
      'Raise to shoulder height ONLY — no higher (impingement risk)',
      'Lead with elbows, not wrists — pour the glass motion',
      'Lower in 3 seconds — slow eccentric = more shoulder growth',
      'Slight forward lean (10°) puts medial delt under more tension',
    ],
    commonMistakes: [
      '❌ Raising above shoulder level (impingement risk)',
      '❌ Using body momentum / swinging',
      '❌ Straight arms — always keep slight elbow bend',
      '❌ Dropping arms too fast (wasted eccentric)',
    ],
    cameraSetup: [
      '📏 Distance: 6–8 ft in front',
      '📷 Angle: Front view — both arms and shoulders visible',
    ],
    breathingCue: 'Exhale as you raise → Inhale as you lower',
    skeletonFrames: [
      { label: 'Arms at Sides', abduction: 15 },
      { label: 'Shoulder Level', abduction: 85 },
      { label: 'Lowering', abduction: 50 },
    ],
  },

  dumbbell_bent_over_row: {
    youtubeId: 'FWJR5Ve8bnQ',
    youtubeTitle: 'Dumbbell Bent-Over Row — Perfect Form for Back Gains',
    keyPoints: [
      'Hip hinge to ~45° — back FLAT (not rounded), chest up',
      'Row dumbbells to your LOWER RIBS (not upper chest)',
      'At the top: squeeze shoulder blades together hard',
      'Upper arms travel close to body — not flaring wide',
      'Lower with control, feel the lat stretch at the bottom',
    ],
    commonMistakes: [
      '❌ Rounding the lower back (most dangerous mistake)',
      '❌ Pulling to upper chest (activates rear delts, not lats)',
      '❌ Torso rocking up to generate momentum',
      '❌ Dropping dumbbells fast without control',
    ],
    cameraSetup: [
      '📷 Angle: Side profile (45°–90°) to monitor back flatness',
      '📏 Distance: 5–7 ft',
      '📐 Height: Camera at torso/mid-body height',
    ],
    breathingCue: 'Exhale as you row up → Inhale as you lower',
    skeletonFrames: [
      { label: 'Hip Hinge 45°', torsoAngle: 45, elbowAngle: 165 },
      { label: 'Rowing Up', elbowAngle: 85 },
      { label: 'Peak Squeeze', elbowAngle: 65 },
    ],
  },

  dumbbell_tricep_extension: {
    youtubeId: 'YbX7Wd8jQ-Q',
    youtubeTitle: 'Overhead Tricep Extension — Form, Tips & Mistakes',
    keyPoints: [
      'Hold ONE dumbbell vertically with both hands above head',
      'Upper arms stay perfectly vertical and still throughout',
      'Only your FOREARMS move — lower the weight behind your head',
      'Go as low as comfortable (biceps touching ears if possible)',
      'Extend to full overhead lockout at the top',
    ],
    commonMistakes: [
      '❌ Letting elbows flare outward (reduces tricep isolation)',
      '❌ Upper arms tilting forward instead of staying vertical',
      '❌ Partial range — not going low enough behind the head',
    ],
    cameraSetup: [
      '📷 Angle: Side profile — camera sees elbow bend clearly',
      '📏 Distance: 4–6 ft',
    ],
    breathingCue: 'Inhale as you lower behind head → Exhale as you extend up',
    skeletonFrames: [
      { label: 'Arms Extended', elbowAngle: 165 },
      { label: 'Lowering Behind Head', elbowAngle: 65 },
      { label: 'Full Extension', elbowAngle: 165 },
    ],
  },

  // ─── CURL ROD ─────────────────────────────────────────────────────────────

  barbell_curl: {
    youtubeId: 'kwG2ipFRgfo',
    youtubeTitle: 'Barbell Curl — How to Get More Out of Every Rep',
    keyPoints: [
      'EZ-bar reduces wrist strain vs straight bar — good for beginners',
      'Underhand grip, hands just outside hip width',
      'Strict form ONLY — zero body swing at any point',
      'At the top: bar should be near upper chest, fully contracted',
      'Lower in 3 seconds — slow negatives build more bicep size',
    ],
    commonMistakes: [
      '❌ Rocking the torso back (using lower back as a lever)',
      '❌ Bar tilting — grip and pull must be symmetrical',
      '❌ Partial reps — bar must come all the way down and up',
    ],
    cameraSetup: [
      '📏 Distance: 5–7 ft in front',
      '📷 Angle: Front view or slight 45°',
    ],
    breathingCue: 'Exhale as you curl up → Inhale as you lower',
    skeletonFrames: [
      { label: 'Full Extension', elbowAngle: 165 },
      { label: 'Peak Squeeze', elbowAngle: 50 },
    ],
  },

  romanian_deadlift: {
    youtubeId: 'hCDzSR6bW10',
    youtubeTitle: 'Romanian Deadlift — The Most Important Form Tips',
    keyPoints: [
      'Start standing with bar against thighs',
      'Push HIPS BACKWARD (not down) — like closing a drawer with your glutes',
      'Knees stay SOFT (slight bend ~15°) — do not squat',
      'Bar slides down your legs, stays close to shins',
      'Lower until you feel hamstring stretch — usually shin height',
      'Drive hips FORWARD to stand — squeeze glutes at top',
    ],
    commonMistakes: [
      '❌ Squatting down instead of hinging at hips',
      '❌ Rounding the lower back (most dangerous mistake)',
      '❌ Bar drifting away from legs (increases lower back stress)',
      '❌ Locking knees completely (should stay soft throughout)',
    ],
    cameraSetup: [
      '📷 Angle: Strict side profile (90°) — only way to see the hip hinge',
      '📏 Distance: 6–8 ft',
      '📐 Height: Camera at hip/mid-torso level',
    ],
    breathingCue: 'Inhale and brace before hinging → Exhale as you drive back up',
    skeletonFrames: [
      { label: 'Standing Tall', hipAngle: 170 },
      { label: 'Hip Hinge', hipAngle: 110 },
      { label: 'Full Stretch', hipAngle: 85 },
      { label: 'Driving Up', hipAngle: 130 },
    ],
  },

  // ─── RESISTANCE TUBES ────────────────────────────────────────────────────

  band_pull_apart: {
    youtubeId: 'IDq7SuSKfJI',
    youtubeTitle: 'Band Pull-Apart — Fix Your Posture and Build Rear Delts',
    keyPoints: [
      'Hold band at chest height with both arms extended forward',
      'Arms must stay STRAIGHT throughout — no elbow bending',
      'Pull APART by squeezing shoulder blades together (not just pulling arms back)',
      'Touch band to chest at the end of each rep',
      'Return slowly under tension — do not let band snap back',
    ],
    commonMistakes: [
      '❌ Bending the elbows (makes it a row, not a pull-apart)',
      '❌ Using too strong a band (forces elbow bend)',
      '❌ Letting band snap back (lose the eccentric benefit)',
    ],
    cameraSetup: [
      '📷 Angle: Front view — wrist spread must be visible',
      '📏 Distance: 5–7 ft in front',
    ],
    breathingCue: 'Exhale as you pull apart → Inhale as you return',
    skeletonFrames: [
      { label: 'Band in Front', spread: 1.0 },
      { label: 'Pulling Apart', spread: 1.8 },
      { label: 'Full Retraction', spread: 2.5 },
    ],
  },

  resistance_band_row: {
    youtubeId: 'GZbfZ033f74',
    youtubeTitle: 'Resistance Band Row — Form Guide',
    keyPoints: [
      'Anchor band at mid-height (door hook, pole, or partner)',
      'Sit or stand — keep torso UPRIGHT (do not lean back to pull)',
      'Pull handles to lower ribs, elbows past hips',
      'Squeeze shoulder blades together at the peak',
      'Control the band back — 2–3 second eccentric',
    ],
    commonMistakes: [
      '❌ Leaning back using body weight instead of back muscles',
      '❌ Pulling to upper chest (rear delts, not lats)',
    ],
    cameraSetup: [
      '📷 Angle: Side profile to monitor torso angle',
      '📏 Distance: 4–6 ft',
    ],
    breathingCue: 'Exhale as you pull → Inhale as you release',
    skeletonFrames: [
      { label: 'Extended', elbowAngle: 165 },
      { label: 'Peak Pull', elbowAngle: 75 },
    ],
  },

  // ─── AB ROLLER ────────────────────────────────────────────────────────────

  ab_roller_rollout: {
    youtubeId: 'YAmte7QMoFI',
    youtubeTitle: 'Ab Wheel Rollout — Beginner Guide (Safe & Effective)',
    keyPoints: [
      '⚠️ BEGINNER: Start with SMALL rolls — only go 20–30 cm forward',
      'Kneel on a mat — protects knees',
      'HOLLOW BODY first: tuck pelvis, brace core BEFORE rolling out',
      'Exhale HARD as you roll out to maximize core engagement',
      'Only roll as far as you can hold perfect form — back must NOT arch',
      'Pull back using your LATS and ABS — not by pushing with arms',
    ],
    commonMistakes: [
      '❌ Rolling too far before core is strong enough (back injury risk)',
      '❌ Hips sagging / lower back hyperextending (STOP immediately)',
      '❌ Not bracing core before beginning the roll',
      '❌ Using arms to push back instead of pulling with abs/lats',
    ],
    cameraSetup: [
      '📷 Angle: Strict side profile — only way to see lower back position',
      '📏 Distance: 4–5 ft, camera at floor/mat level',
      '📐 Height: Camera as low as possible (place on floor)',
      '⚠️ SAFETY: If the AI flags lower back sag — STOP that set immediately',
    ],
    breathingCue: 'Exhale forcefully as you roll out → Inhale as you pull back',
    skeletonFrames: [
      { label: 'Start — Kneeling', hipAngle: 85 },
      { label: 'Rolling Out', hipAngle: 130 },
      { label: 'Full Extension', hipAngle: 160 },
      { label: 'Pulling Back', hipAngle: 110 },
    ],
  },
};
