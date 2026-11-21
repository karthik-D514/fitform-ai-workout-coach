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
    youtubeId: 'ASdvN_XEl_c',
    youtubeTitle: 'Planks for Beginners — Bowflex',
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
    youtubeId: 'fq9gDvNZQ2c',
    youtubeTitle: 'How To Dead Hang Correctly? — FitnessFAQs',
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
    youtubeId: '3VcKaXpzqRo',
    youtubeTitle: 'How To: Dumbbell Side Lateral Raise — ScottHermanFitness',
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
    youtubeId: 'SuvO4TBwSu4',
    youtubeTitle: 'Band Pull-Apart Exercise Tutorial — Movement Physio',
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
    youtubeId: 'MinlHnG7j4k',
    youtubeTitle: 'How to Use the Ab Roller With Perfect Form — DEMIC',
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

  // ─── WARM-UP & MOBILITY ──────────────────────────────────────────────────

  warmup_arm_circles: {
    youtubeId: 'HMxqtrsNz60',
    youtubeTitle: 'Beginner Standing Arm Circles & Shoulder Mobility — Hit My Macros',
    keyPoints: [
      'Stand tall, feet shoulder-width apart, core lightly engaged',
      'Extend arms straight out to sides at exact shoulder height',
      'Keep elbows locked straight with long reach through fingertips',
      'Rotate in smooth rhythmic circles (forward first, then backward)',
      'Gradually expand circle diameter as shoulder joints warm up',
    ],
    commonMistakes: [
      '❌ Letting elbows bend excessively (keeps arms straight)',
      '❌ Dropping arms below shoulder level (reduces deltoid recruitment)',
      '❌ Shrugging shoulders up toward ears (keep traps relaxed)',
    ],
    cameraSetup: [
      '📷 Angle: Front view so camera sees full arm span',
      '📏 Distance: 6–8 ft back to fit outstretched arms',
      '📐 Height: Waist or chest height',
    ],
    breathingCue: 'Inhale through nose, exhale through mouth steadily',
    skeletonFrames: [
      { label: 'Arms Level', elbowAngle: 175 },
      { label: 'Circle Apex', elbowAngle: 170 },
      { label: 'Full Rotation', elbowAngle: 175 },
    ],
  },

  warmup_torso_twists: {
    youtubeId: 'cLuKHx--qJw',
    youtubeTitle: 'Standing Torso Twists Mobility & Warm-Up — Anastasia Arnold',
    keyPoints: [
      'Stand with wide athletic stance, knees slightly bent (soft)',
      'Keep pelvis and hips square to the front',
      'Rotate through thoracic spine (upper/mid back) rather than lumbar',
      'Let arms swing naturally and loosely with rotation',
      'Maintain tall upright posture throughout rotation',
    ],
    commonMistakes: [
      '❌ Twisting solely from hips or knees (mobilize upper spine)',
      '❌ Lateral torso leaning side-to-side (rotate along vertical axis)',
      '❌ Locking knees straight (keep knees soft)',
    ],
    cameraSetup: [
      '📷 Angle: Front view with head, shoulders, and hips visible',
      '📏 Distance: 6–8 ft away',
      '📐 Height: Chest or waist level',
    ],
    breathingCue: 'Exhale on each outward twist, inhale returning to center',
    skeletonFrames: [
      { label: 'Center Stance', twistAngle: 0 },
      { label: 'Left Rotation', twistAngle: 30 },
      { label: 'Right Rotation', twistAngle: -30 },
    ],
  },

  warmup_air_squats: {
    youtubeId: 'C_VtOYc6j5c',
    youtubeTitle: 'Mobility Air Squats for Joint Lubrication',
    keyPoints: [
      'Feet shoulder-width apart, toes turned outward 15–25°',
      'Focus on smooth rhythmic cadence rather than heavy load',
      'Squat to parallel or comfortable mobility depth (~110°)',
      'Pause 1 second at the bottom to open hip capsules',
      'Drive knees actively outward in line with toes',
    ],
    commonMistakes: [
      '❌ Dropping chest excessively (keep eyes looking straight ahead)',
      '❌ Knees caving inward (push knees out over pinky toes)',
      '❌ Bouncing violently out of bottom (use controlled tempo)',
    ],
    cameraSetup: [
      '📷 Angle: Front view or 45° angle',
      '📏 Distance: 6–8 ft away with full body visible',
      '📐 Height: Knee or waist level',
    ],
    breathingCue: 'Inhale descending → Exhale ascending to standing',
    skeletonFrames: [
      { label: 'Standing', kneeAngle: 175 },
      { label: 'Mobility Depth', kneeAngle: 110 },
      { label: 'Lockout', kneeAngle: 175 },
    ],
  },

  dumbbell_floor_press: {
    youtubeId: 'k8fvMnz42-g',
    youtubeTitle: 'Dumbbell Floor Press Form & Technique',
    keyPoints: [
      'Lie flat on back with knees bent and feet firmly planted',
      'Elbows tucked at ~45–60° angle to protect shoulders',
      'Press dumbbells straight up to full lockout over mid-chest',
      'Lower under control until upper arms / triceps gently touch floor',
      'Pause briefly on the floor to eliminate bounce and engage pectorals',
    ],
    commonMistakes: [
      '❌ Flaring elbows out at 90° (stresses anterior rotator cuff)',
      '❌ Bouncing elbows violently off the hard floor',
      '❌ Uneven press where dominant arm presses faster than weaker arm',
    ],
    cameraSetup: [
      '📷 Angle: Side-angle or 45° view from floor level',
      '📏 Distance: 6–8 ft away showing upper body and floor contact',
      '📐 Height: Floor level or low stool (12–18 inches)',
    ],
    breathingCue: 'Inhale lowering to floor → Exhale forcefully pressing up to lockout',
    skeletonFrames: [
      { label: 'Floor Touch', elbowAngle: 90 },
      { label: 'Mid-Press', elbowAngle: 125 },
      { label: 'Top Lockout', elbowAngle: 165 },
    ],
  },

  diamond_pushup: {
    youtubeId: 'PPTj-MW2tcs',
    youtubeTitle: 'Perfect Diamond Push-Up Technique',
    keyPoints: [
      'Hands close together under chest forming a diamond or triangle shape',
      'Keep core rigid and hips level in a straight plank line (>160°)',
      'Lower chest until nearly touching hands (elbow angle ≤85°)',
      'Keep elbows tucked close to ribcage throughout movement',
      'Lock out arms at the top for maximum tricep contraction',
    ],
    commonMistakes: [
      '❌ Sagging hips or hyperextending lower back',
      '❌ Cutting depth short (half reps)',
      '❌ Flaring elbows outward excessively instead of back',
    ],
    cameraSetup: [
      '📷 Angle: 45° angle or side profile',
      '📏 Distance: 6–8 ft away showing full head-to-heel plank',
      '📐 Height: Knee level or floor level',
    ],
    breathingCue: 'Inhale lowering chest to hands → Exhale driving up to lockout',
    skeletonFrames: [
      { label: 'Top Plank', elbowAngle: 165, spineAngle: 175 },
      { label: 'Bottom Diamond', elbowAngle: 80, spineAngle: 170 },
      { label: 'Lockout', elbowAngle: 165, spineAngle: 175 },
    ],
  },

  single_arm_dumbbell_row: {
    youtubeId: 'i9BJwVCK5VQ',
    youtubeTitle: 'Single Arm Dumbbell Row Tutorial',
    keyPoints: [
      'Hinge hips back with flat spine at ~45–60° torso angle',
      'One hand supported on stable surface, other arm holding dumbbell',
      'Pull dumbbell towards hip crease leading with the elbow (≤80°)',
      'Squeeze lat hard at top peak contraction',
      'Lower weight under control to full stretch (>150° elbow)',
    ],
    commonMistakes: [
      '❌ Twisting torso or jerking momentum to swing weight up',
      '❌ Rounding lower back (keep spine braced and neutral)',
      '❌ Pulling to chest instead of pocket/hip',
    ],
    cameraSetup: [
      '📷 Angle: Side profile showing torso hinge and working arm',
      '📏 Distance: 6–8 ft away',
      '📐 Height: Hip or waist level',
    ],
    breathingCue: 'Inhale on deep stretch → Exhale pulling dumbbell to hip',
    skeletonFrames: [
      { label: 'Stretch', elbowAngle: 155, torsoAngle: 50 },
      { label: 'Peak Row', elbowAngle: 75, torsoAngle: 50 },
    ],
  },

  pike_pushup: {
    youtubeId: 'eG20L9cl81w',
    youtubeTitle: 'Pike Push Ups Made Easy',
    keyPoints: [
      'Form inverted V-shape (pike) with hips high (hip angle ≤105°)',
      'Look slightly forward towards hands, head neutral',
      'Lower top of head forward between and slightly ahead of hands (elbow ≤90°)',
      'Press through shoulders pushing head back between arms at lockout (>155°)',
      'Maintain pike angle without dropping hips into regular pushup',
    ],
    commonMistakes: [
      '❌ Dropping hips flat into regular pushup (loses shoulder emphasis)',
      '❌ Flaring elbows sideways instead of tracking 45° backward',
      '❌ Not pushing head back through window at top lockout',
    ],
    cameraSetup: [
      '📷 Angle: Direct side profile showing inverted V hip pike',
      '📏 Distance: 7–9 ft away',
      '📐 Height: Waist level',
    ],
    breathingCue: 'Inhale lowering head towards floor → Exhale pressing up and through',
    skeletonFrames: [
      { label: 'Pike Lockout', elbowAngle: 165, hipAngle: 95 },
      { label: 'Bottom Pike', elbowAngle: 85, hipAngle: 95 },
    ],
  },

  band_face_pull: {
    youtubeId: 'Qij3pSB-gNk',
    youtubeTitle: 'Face Pulls with Resistance Band',
    keyPoints: [
      'Anchor resistance band at eye or forehead height using door anchor',
      'Stand upright with core braced, holding handles with thumbs pointing back',
      'Pull band directly towards bridge of nose or eyes, splitting hands apart',
      'Flourish elbows high and wide, externally rotating shoulders (elbow ≤75°)',
      'Squeeze rear deltoids and upper back for 1 full second',
    ],
    commonMistakes: [
      '❌ Leaning backward excessively or using torso sway',
      '❌ Dropping elbows low turning movement into a row',
      '❌ Rushing reps without holding the rear delt contraction',
    ],
    cameraSetup: [
      '📷 Angle: Front-facing or 45° angle',
      '📏 Distance: 6–8 ft away showing head, shoulders, and door anchor',
      '📐 Height: Chest or eye level',
    ],
    breathingCue: 'Inhale returning arms forward → Exhale pulling band to face',
    skeletonFrames: [
      { label: 'Forward Reach', elbowAngle: 155 },
      { label: 'Peak Face Pull', elbowAngle: 70 },
    ],
  },

  ez_bar_skull_crusher: {
    youtubeId: 'h4l3cpeNtbE',
    youtubeTitle: 'How to Do Skull Crushers Properly',
    keyPoints: [
      'Lie flat on mat holding EZ curl bar with close overhand grip',
      'Upper arms vertical or angled slightly back (~75–90° to torso)',
      'Keep upper arms stationary; bend only at elbows',
      'Lower bar slowly towards forehead or crown until deep tricep stretch (≤75°)',
      'Extend elbows smoothly to full tricep lockout (>155°)',
    ],
    commonMistakes: [
      '❌ Flaring elbows outwards (keep elbows tracked in tight)',
      '❌ Moving upper arms back and forth turning it into a pullover or press',
      '❌ Banging bar against skull — maintain strict tempo and control',
    ],
    cameraSetup: [
      '📷 Angle: Side profile showing upper arm angle and elbow bend',
      '📏 Distance: 6–8 ft away from floor level',
      '📐 Height: 12–24 inches off floor',
    ],
    breathingCue: 'Inhale lowering bar towards forehead → Exhale locking out triceps',
    skeletonFrames: [
      { label: 'Top Lockout', elbowAngle: 165, armDrift: 5 },
      { label: 'Deep Stretch', elbowAngle: 70, armDrift: 8 },
    ],
  },

  band_tricep_pushdown: {
    youtubeId: 'PkGesjlH7RQ',
    youtubeTitle: 'Resistance Band Triceps Pushdown',
    keyPoints: [
      'Anchor band high above head using secure door anchor',
      'Grip band handles with elbows pinned tight against ribs',
      'Hinge slightly at hips with braced core',
      'Push band down until elbows are completely locked out (>155°)',
      'Allow forearms to rise up until elbows bend past 90° for full stretch',
    ],
    commonMistakes: [
      '❌ Letting elbows flare forward and back (keep elbows glued to ribs)',
      '❌ Using bodyweight momentum or leaning into the band',
      '❌ Partial lockout at the bottom',
    ],
    cameraSetup: [
      '📷 Angle: Side profile or 45° angle showing pinned elbows',
      '📏 Distance: 6–8 ft away',
      '📐 Height: Chest or waist level',
    ],
    breathingCue: 'Inhale on forearm rise → Exhale snapping elbows into full lockout',
    skeletonFrames: [
      { label: 'Stretch', elbowAngle: 80 },
      { label: 'Full Lockout', elbowAngle: 165 },
    ],
  },

  dumbbell_goblet_squat: {
    youtubeId: 'lRYBbchqxtI',
    youtubeTitle: 'How to Do a Goblet Squat',
    keyPoints: [
      'Hold dumbbell vertically against chest with both hands under bell',
      'Feet slightly wider than shoulder-width, toes turned 15–20° out',
      'Break at hips and knees together, sitting down between thighs',
      'Squat until hip crease is below knee level (knee angle ≤95°)',
      'Keep chest tall and upright throughout the descent (<40° torso lean)',
      'Push through whole foot and drive knees outwards on ascent',
    ],
    commonMistakes: [
      '❌ Knees caving inward (valgus collapse)',
      '❌ Tilting torso forward or dropping the dumbbell away from chest',
      '❌ Cutting squat depth above parallel',
    ],
    cameraSetup: [
      '📷 Angle: 45° angle or front view to assess both depth and knee tracking',
      '📏 Distance: 7–9 ft away with full body visible',
      '📐 Height: Waist level',
    ],
    breathingCue: 'Inhale and brace core at top → Squat deep → Exhale driving up',
    skeletonFrames: [
      { label: 'Standing', kneeAngle: 175, torsoAngle: 10 },
      { label: 'Parallel Depth', kneeAngle: 90, torsoAngle: 25 },
      { label: 'Lockout', kneeAngle: 175, torsoAngle: 10 },
    ],
  },

  bulgarian_split_squat: {
    youtubeId: 'or1frhkjBDc',
    youtubeTitle: 'Bulgarian Split Squat Setup & Form Tips',
    keyPoints: [
      'Rear foot elevated on sturdy chair, bench, or couch behind you',
      'Front foot positioned so shin remains relatively vertical during descent',
      'Lower rear knee straight down toward floor until front knee reaches ≤95°',
      'Maintain slight forward torso lean to maximize glute and quad engagement',
      'Drive up through front heel and midfoot to full standing position',
    ],
    commonMistakes: [
      '❌ Front knee caving inward (push knee out tracking over middle toes)',
      '❌ Front foot too close causing rear knee jamming or heel lifting',
      '❌ Collapsing torso onto front thigh',
    ],
    cameraSetup: [
      '📷 Angle: Side profile or 45° view showing front knee angle and depth',
      '📏 Distance: 7–9 ft away',
      '📐 Height: Knee or waist level',
    ],
    breathingCue: 'Inhale descending into lunge → Exhale driving through front heel',
    skeletonFrames: [
      { label: 'Top Stance', kneeAngle: 165 },
      { label: 'Bottom Lunge', kneeAngle: 85 },
      { label: 'Top Stance', kneeAngle: 165 },
    ],
  },

  weighted_glute_bridge: {
    youtubeId: 'euDIvpBWmDg',
    youtubeTitle: 'Dumbbell Glute Bridge Setup & Form',
    keyPoints: [
      'Lie on back with knees bent ~90° and feet flat on floor shoulder-width',
      'Place dumbbell securely across hips, held steady with both hands',
      'Drive through heels and squeeze glutes hard to lift hips',
      'Form straight diagonal line from knees through hips to shoulders (≥165°)',
      'Hold peak squeeze for 1 second without hyperextending lumbar spine (≤190°)',
    ],
    commonMistakes: [
      '❌ Hyperextending lower back at top instead of squeezing glutes',
      '❌ Lifting on toes instead of driving through heels',
      '❌ Letting knees collapse inward during hip drive',
    ],
    cameraSetup: [
      '📷 Angle: Side profile from floor level showing hip extension line',
      '📏 Distance: 6–8 ft away',
      '📐 Height: 12–18 inches off floor',
    ],
    breathingCue: 'Inhale on floor → Exhale driving hips upward to glute contraction',
    skeletonFrames: [
      { label: 'Bottom Bridge', hipAngle: 110 },
      { label: 'Full Lockout', hipAngle: 175 },
    ],
  },

  standing_calf_raise: {
    youtubeId: 'ADITZCcUyVo',
    youtubeTitle: 'Standing Dumbbell Calf Raises',
    keyPoints: [
      'Hold dumbbells at sides or stand with balls of feet elevated on an edge',
      'Keep knees almost straight with slight soft micro-bend',
      'Press through the balls of both big toes to raise heels as high as possible',
      'Squeeze calves hard at the peak for 1 second',
      'Lower heels slowly under control for a full 2-second stretch',
    ],
    commonMistakes: [
      '❌ Bouncing at the bottom with achilles recoil instead of muscle drive',
      '❌ Rolling onto outside edges of feet (keep pressure through big toe)',
      '❌ Bending knees to cheat the weight up',
    ],
    cameraSetup: [
      '📷 Angle: Side or 45° angle showing feet and lower legs clearly',
      '📏 Distance: 6–8 ft away',
      '📐 Height: Knee level',
    ],
    breathingCue: 'Inhale lowering to deep stretch → Exhale rising onto toes',
    skeletonFrames: [
      { label: 'Full Stretch', ankleAngle: 80 },
      { label: 'Peak Contraction', ankleAngle: 135 },
    ],
  },

  side_plank: {
    youtubeId: 'BFOyHDlY2UE',
    youtubeTitle: 'Fix Your Side Plank Form',
    keyPoints: [
      'Lie on side with elbow directly beneath shoulder and forearm flat',
      'Stack feet or stagger top foot in front for balance',
      'Lift hips off floor until body forms rigid diagonal line from head to heels (>160°)',
      'Keep core braced, glutes squeezed, and bottom hip elevated',
      'Hold isometric tension without allowing hips to sag toward floor',
    ],
    commonMistakes: [
      '❌ Hips sagging towards floor (push bottom hip upward)',
      '❌ Rolling top shoulder forward or backward (keep shoulders stacked)',
      '❌ Placing elbow too far out from under shoulder causing joint strain',
    ],
    cameraSetup: [
      '📷 Angle: Front-facing or 45° view showing straight diagonal body line',
      '📏 Distance: 6–8 ft away',
      '📐 Height: Floor or knee level',
    ],
    breathingCue: 'Maintain steady, controlled rhythmic breathing while bracing core',
    skeletonFrames: [
      { label: 'Active Hold', spineLine: 175 },
      { label: 'Sagging Warning', spineLine: 145 },
    ],
  },

  hollow_body_hold: {
    youtubeId: 'JnuYfsJ3CKg',
    youtubeTitle: 'How to Do a Hollow Body Hold',
    keyPoints: [
      'Lie flat on back and firmly press lower back into floor (no daylight)',
      'Raise shoulder blades off floor and extend arms overhead',
      'Lift legs 4–6 inches off floor with toes pointed (hip angle 140°–165°)',
      'Maintain "banana" or hollow body shape with tight abdominal compression',
      'If lower back arches off floor, bend knees slightly to regress until stronger',
    ],
    commonMistakes: [
      '❌ Lower back lifting or arching off the floor (instant form breakdown)',
      '❌ Tucking chin into chest excessively (keep neck neutral)',
      '❌ Holding breath (maintain shallow rhythmic breathing under tension)',
    ],
    cameraSetup: [
      '📷 Angle: Direct side profile at floor level showing lower back and body curve',
      '📏 Distance: 6–8 ft away',
      '📐 Height: Floor level (6–12 inches)',
    ],
    breathingCue: 'Breathe shallowly through the nose while maintaining maximum abdominal brace',
    skeletonFrames: [
      { label: 'Hollow Position', hipAngle: 150 },
    ],
  },

};
