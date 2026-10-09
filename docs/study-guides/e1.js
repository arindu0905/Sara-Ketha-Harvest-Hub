const { table, qa, note, ul, ol, FOUNDATIONS } = require('./common');

module.exports = {
  id: 'E1',
  file: 'E1_Farmer_Crop_AI_Advisory_Study_Guide',
  title: 'Epic 1 – Farmer, Crop & AI Advisory Management',
  sub: 'Concepts, validations, demo script and viva questions',
  body: `
<h2>1. Epic overview</h2>
<p>Epic 1 manages <b>who the farmers are and what they grow</b>: self-registration, officer-assisted registration, verification, profiles and documents, crop registration and history, multilingual (English / Sinhala / Tamil) use, and the <b>conversational crop-advisory assistant</b> that recommends crops with suitability scores and reasons.</p>
<p><b>Stakeholders:</b> Farmer (primary), Collection Centre Officer (primary), Agricultural Officers (secondary – advisory accuracy).</p>

<h3>1.1 Story map – screen → API → table</h3>
${table(['Story', 'What the user does', 'Screen (frontend)', 'API (backend)', 'Tables'], [
  ['<b>E1-US1</b> <span class="pill">Sprint 1</span>', 'Farmer creates own account', '<code>RegisterPage</code>', '<code>POST /api/auth/register</code>', 'auth.users, profiles, farmers'],
  ['<b>E1-US2</b> <span class="pill">Sprint 1</span>', 'Choose English / Sinhala / Tamil', '<code>LanguageContext</code>, language selector', 'none (client side, saved in localStorage)', '–'],
  ['<b>E1-US3</b> <span class="pill">Sprint 1</span>', 'Officer registers and manages farmers', '<code>RegisterFarmer</code>, <code>FarmerDirectory</code>', '<code>POST /api/farmers</code>, <code>PUT /api/farmers/:id</code>', 'farmers'],
  ['<b>E1-US4</b> <span class="pill">Sprint 1</span>', 'Officer verifies / rejects registrations', '<code>FarmerVerification</code>', '<code>PATCH /api/farmers/:id/status</code>', 'farmers, profiles, notifications'],
  ['<b>E1-US5</b> <span class="pill">Sprint 1</span>', 'Farmer views and edits own profile', '<code>FarmerProfile</code>', '<code>GET /api/farmers/me</code>, <code>GET/PUT /api/farmers/:id</code>', 'farmers'],
  ['<b>E1-US6</b> <span class="pill">Sprint 1</span>', 'Farmer registers crops', '<code>RegisterCrop</code>', '<code>POST /api/crops</code>', 'farmer_crops'],
  ['<b>E1-US7</b>', 'Farmer views crop history', '<code>FarmerCrops</code>', '<code>GET /api/crops</code>, <code>GET /api/farmers/:id/crops</code>', 'farmer_crops'],
  ['<b>E1-US8</b>', 'Officer searches / filters farmers', '<code>FarmerDirectory</code>', '<code>GET /api/farmers?search=&district=&verification_status=&page=</code>', 'farmers'],
  ['<b>E1-US9</b>', 'Farmer uses the crop-advisor bot', '<code>FarmerCropBotModal</code>', '<code>GET /api/bot/prompt</code>, <code>POST /api/bot/recommend</code>', 'none (rule tables in code)'],
  ['<b>E1-US10</b>', 'Farmer gives location, previous crop, soil via the bot', '<code>FarmerCropBotModal</code> (3 questions)', '<code>POST /api/bot/recommend</code>', '–'],
  ['<b>E1-US11</b>', 'See recommendations with scores and reasons', '<code>FarmerCropBotModal</code> result cards', 'response: <code>suitability_score</code>, <code>score_breakdown</code>, <code>rationale</code>', '–'],
  ['Epic text: documents', 'Upload / verify NIC, land deed, passbook', '<code>FarmerDocuments</code> (profile + verification page)', '<code>/api/farmers/:id/documents</code>', 'farmer_documents + private storage bucket']
])}
${note('tip', '<b>Sprint 1 scope</b> (from the Sprint 0 document): E1-US1 to US6. US7–US11 are later-sprint stories, but all are implemented.')}

<h2>2. Core concepts you must be able to explain</h2>

<h3>2.1 Two ways a farmer gets into the system</h3>
${table(['', 'Self-registration (US1)', 'Officer registration (US3)'], [
  ['Who', 'Farmer, from the public site', 'Collection Centre Officer (or admin)'],
  ['Creates', 'Login account (Supabase Auth user) + <code>profiles</code> row + <code>farmers</code> row', 'A <code>farmers</code> record (a farmer who may not have a login yet, e.g. walk-in)'],
  ['Starting state', '<code>verification_status = pending</code>, profile <code>account_status = pending</code>', 'Created by staff; linked to a login later through <code>profile_id</code>'],
  ['Details captured', 'Name, email, password (+ phone)', 'NIC, phone, address, district, farm, bank, emergency contact, centre'],
  ['Why two paths', 'Farmers with phones register themselves; many rural farmers need staff help', '']
])}

<h3>2.2 Farmer verification life-cycle (E1-US4)</h3>
<div class="flow">Register ──► verification_status = PENDING   (profile account_status = pending → LOGIN BLOCKED, HTTP 403)
                         │
        Officer reviews identity details + documents
                         │
        ┌────────────────┴─────────────────┐
     VERIFIED                           REJECTED
  profile → active                  profile → inactive
  farmer can log in,                farmer cannot log in
  book deliveries, add crops        (message: contact the centre)
  notification: "Registration approved"   notification with the officer\'s note</div>
<p><b>Why it exists:</b> only verified farmers may use collection services and receive payments, which protects the centre from fake or duplicate farmers. Verification stores <code>verified_by</code> and <code>verified_at</code> (accountability).</p>

<h3>2.3 Farmer–user link</h3>
<p>A <code>farmers</code> row has <code>profile_id</code> (UNIQUE, references <code>profiles</code>). That one column connects a login to farmer data. <code>GET /api/farmers/me</code> finds the logged-in farmer through it, and ownership checks compare it with the record being accessed.</p>

<h3>2.4 Codes, masking and uniqueness</h3>
${ul([
  '<b>Farmer code</b> (e.g. <code>FRM-…</code>) is generated by the database function <code>generate_farmer_code</code> – unique, human friendly, never typed by users.',
  '<b>NIC is UNIQUE</b> in the database (and pre-checked by the API → <b>409</b> "A farmer with this NIC number already exists").',
  '<b>Bank account masking:</b> only <code>****1234</code> (last four digits) is stored in <code>account_number_masked</code>; the full number is not kept.'
])}

<h3>2.5 Multilingual support (E1-US2)</h3>
${ul([
  '<code>LanguageContext</code> holds the current language (<code>en</code> | <code>si</code> | <code>ta</code>). The choice is saved in <code>localStorage</code> (<code>hh_language</code>) so it survives reloads, and the page language attribute and a body CSS class are updated (for the correct Sinhala / Tamil fonts).',
  'Components call <code>t(key)</code>. If a key is missing in Sinhala/Tamil it <b>falls back to English</b> so the UI never shows blank text.',
  'Roles have translated labels (<code>role_farmer</code> …) and dates are formatted with the <code>si-LK</code> / <code>ta-LK</code> locale.',
  'The crop advisor receives the language (<code>lang</code>) and answers in it; crop names are returned in all three languages.'
])}

<h3>2.6 The crop advisor (E1-US9 / US10 / US11) – how the "AI" really works</h3>
<p>The assistant is a <b>conversation</b> that asks three questions, then calls <code>POST /api/bot/recommend</code>:</p>
${ol(['<b>Location</b> – which district (the 26 districts / areas offered in the three languages, with search and agro-zone filter).', '<b>Previous crop</b> – quick buttons or free text (names in English / Sinhala / Tamil are normalised).', '<b>Soil</b> – acidic / slightly acidic / neutral / alkaline, an exact pH (3–10), or "I don\'t know".'])}
<p>Environmental conditions (rainfall, climate zone, altitude, soil types) come from a built-in <b>district profile</b> for the chosen district.</p>

<h4>Scoring model (0–100) – transparent, not random</h4>
${table(['Factor', 'Max', 'How it is computed'], [
  ['Location fit', '40', 'Expert-recommended crop for this district after the previous crop: rank 1 = 40, rank 2 = 36, rank 3 = 32; a primary crop of the district = 28; otherwise 8.'],
  ['Crop rotation', '30', 'Same crop as last season = 0 (warning); listed "avoid after" = 0; same crop family = 4; no history = 18; a <b>legume after a non-legume = 30</b> (restores nitrogen); a different family = 24.'],
  ['Soil pH', '15', 'Full marks inside the crop\'s preferred pH range, falling linearly to 0 at 1.5 pH units outside. pH not given → neutral 9.'],
  ['Rainfall', '15', 'District annual rainfall (mid-point) versus the crop\'s tolerated range; falls to 0 at 1000 mm outside. Unknown → neutral 8.']
])}
${ul([
  'Score = <b>location + rotation + soil pH + rainfall</b>, rounded. Every crop is scored (17 crops with known pH, rainfall and family data) and the <b>top 3</b> are returned.',
  '<b>Rotation violations are never recommended</b> (same crop, same family, "avoid after" list) – they are filtered out before ranking.',
  'The response includes <code>score_breakdown</code> (points + a note per factor), so the farmer sees <i>why</i> a crop scored as it did (US11 "scores and reasons").',
  '<b>Gemini (optional):</b> if a <code>GEMINI_API_KEY</code> is configured, the Gemini model only <i>phrases the explanation</i> in the farmer\'s language. It does not choose the crops or the scores. Without a key the built-in multilingual rationale is used (<code>ai_source: "fallback"</code>).'
])}
${note('warn', '<b>Be honest about the proposal:</b> the Sprint 0 document mentions a Java ML / Weka Random Forest. The delivered advisor uses an <b>expert-rule scoring model written in TypeScript</b> (plus optional Gemini for wording). A trained Java model prototype exists in the <code>ml-service/</code> folder but is not what the live bot calls. Explain it as: "we chose a transparent, explainable scoring model because farmers need reasons, and it works without training data".')}

<h4>Worked example (illustrative numbers)</h4>
<p>Farmer in a dry-zone district grew <b>Rice</b>, soil pH 6.0. For <b>Cowpea</b>: location 36 (rank 2 recommended) + rotation 30 (legume after cereal) + pH 15 (inside range) + rainfall 15 (inside tolerated range) = <b>96/100</b>. For <b>Rice again</b>: rotation = 0 with a warning, so it is excluded from the recommendations.</p>

<h2>3. Validations (the heart of the viva)</h2>

<h3>3.1 Registration – E1-US1</h3>
${table(['Field', 'Frontend (Zod)', 'Backend (Zod, <code>registerSchema</code>)', 'Error'], [
  ['Full name', 'min 2 characters', '2 – 100 characters', '"Full name must be at least 2 characters"'],
  ['Email', 'valid email', 'valid email', '"Invalid email address"; duplicate → <b>409</b> "An account with this email already exists"'],
  ['Password', 'min 8, 1 uppercase, 1 lowercase, 1 number', 'same four rules', 'one message per rule'],
  ['Confirm password', 'must equal password', '(client only)', '"Passwords do not match"'],
  ['Phone (optional)', '(not on the form)', 'if given: exactly 10 digits starting with 0', '"Phone must be exactly 10 digits and start with 0"'],
  ['Role', '<code>farmer</code> or <code>buyer</code> only', '<code>z.enum(["farmer","buyer"])</code>, default farmer', 'any other role (e.g. administrator) is rejected with <b>400</b>']
])}
${ul([
  '<b>Privilege-escalation fix:</b> the public endpoint accepts only farmer/buyer. Staff accounts are created by an administrator – nobody can self-register as admin by editing the request.',
  'New farmer → <code>verification_status = pending</code>; message: "Your account requires verification by a Collection Officer…".',
  'Passwords are handled by <b>Supabase Auth</b> (salted hashing, never stored in plain text). The app never returns or logs the password.'
])}

<h3>3.2 Login rules (relates to US1/US4)</h3>
${table(['Situation', 'Result'], [
  ['Wrong email or password', '<b>401</b> "Invalid email or password" (same message for both – no user enumeration)'],
  ['Account suspended / inactive', '<b>403</b> with explanation'],
  ['Farmer with <code>pending</code> verification', '<b>403</b> "…pending verification by a Collection Officer or Admin. You cannot log in until your account is verified."'],
  ['Farmer <code>rejected</code>', '<b>403</b> "…verification was rejected. Please contact a Collection Centre Officer or Admin."'],
  ['Valid and verified', '200 + access token + refresh token + user (id, name, role) → redirect to the role\'s dashboard']
])}

<h3>3.3 Officer registers a farmer – E1-US3</h3>
${table(['Field', 'Rule', 'Message'], [
  ['NIC number *', '<code>^(\\d{9}[VvXx]|\\d{12})$</code> – old format 9 digits + V/X, or new format 12 digits', '"NIC must be old format (9 digits + V or X…) or new format (12 digits…)"'],
  ['Phone *', '<code>^0\\d{9}$</code> – exactly 10 digits starting with 0', '"Phone must be exactly 10 digits and start with 0 (e.g. 0771234567)"'],
  ['Full name *', '2 – 100 characters', ''],
  ['Address *', 'at least 5 characters', ''],
  ['District *', 'at least 2 characters', ''],
  ['Email', 'optional, but must be a valid email if given', ''],
  ['Farm size (acres)', 'optional, must be a positive number', ''],
  ['Emergency contact phone', 'optional; if given, same format as phone (10 digits starting with 0)', '"Phone must be exactly 10 digits…"'],
  ['Bank account number', 'optional; if given, 6 to 20 digits only; stored only as <code>****last4</code>', '"Account number must be 6 to 20 digits"'],
  ['Assigned centre', 'optional, must be a valid UUID', ''],
  ['NIC uniqueness', 'checked before insert and by a UNIQUE constraint', '<b>409</b> "A farmer with this NIC number already exists"'],
  ['Who may call it', '<code>requireRole(collection_centre_officer, administrator)</code>', '<b>403</b> for any other role']
])}
<p>The same NIC and phone patterns are used in the <b>frontend form</b> (so users see the error immediately) and again on the <b>server</b> (the one that really protects the data).</p>

<h3>3.4 Profile update – E1-US5</h3>
${ul([
  '<b>Ownership:</b> a farmer can update only their own record – otherwise <b>403</b> "You can only update your own farmer profile".',
  '<b>Whitelist (mass-assignment protection):</b> a farmer may change only: full name, email, phone, address, district, divisional secretariat, farm name/location/size, bank details, emergency contact, preferred language. Staff may additionally change NIC, assigned centre and notes. <b>Verification status can never be changed through this endpoint.</b>',
  'Optional fields use the same NIC / phone formats; blank or null values do <b>not</b> overwrite existing data.',
  'Bank account number is converted to <code>****last4</code> before saving. On the profile screen the field is labelled <b>New account number</b> (blank = keep the current one) and accepts digits only.',
  'Emergency contact phone and bank account follow the same formats as in registration. <b>Duplicate NIC</b> while editing returns <b>409</b> "A farmer with this NIC number already exists".',
  'Frontend shows inline messages as the user types (<code>validatePhone</code>, <code>validateNIC</code>).'
])}

<h3>3.5 Verification – E1-US4</h3>
${table(['Rule', 'Detail'], [
  ['Who', 'collection_centre_officer or administrator only (403 otherwise)'],
  ['Allowed values', '<code>verification_status</code> ∈ unverified, pending, verified, rejected; <code>account_status</code> ∈ active, inactive, suspended, pending – anything else → <b>400</b>'],
  ['Side effects', 'verified → stores verified_by / verified_at, profile becomes <b>active</b>; rejected → profile <b>inactive</b>; farmer gets an in-app notification (and an email if SMTP is configured)'],
  ['Effect elsewhere', 'Unverified farmers cannot log in, and cannot book appointments or deliver produce (checked again in the appointment controller)']
])}

<h3>3.6 Crops – E1-US6 / US7</h3>
${table(['Field', 'Rule'], [
  ['farmer_id, category_id', 'required, valid UUIDs'],
  ['variety_id', 'optional UUID'],
  ['cultivated_area_acres, expected_quantity_kg', 'optional, must be positive numbers (frontend also sets <code>min="0"</code>)'],
  ['planting_date, expected_harvest_date', 'optional, real <code>YYYY-MM-DD</code> dates. <b>Planting date cannot be in the past</b> (the calendar also greys out earlier days), <b>expected harvest cannot be in the past or before the planting date</b>. Checked in the form and again on the server (Sri Lanka time) → <b>400</b> "Planting date cannot be in the past". On edit, an old planting date is allowed to stay as it was.'],
  ['farming_method', 'enum: organic, conventional, hydroponic, mixed (default conventional)'],
  ['Ownership', 'a <b>farmer\'s crop is always saved under their own farmer id</b> (a different <code>farmer_id</code> in the request is ignored); reading, editing or deleting another farmer\'s crop → <b>403</b>; the crop list for a farmer returns only their crops'],
  ['Delete', 'tries a real delete; if the crop is already referenced elsewhere (foreign key) it is <b>deactivated</b> (<code>is_active = false</code>) so history stays intact']
])}
${ul(['<b>Crop history (US7)</b> is the list of all crops of that farmer, newest first, including inactive ones when requested (<code>is_active=all</code>).', 'Categories and varieties are managed by the administrator only (farmers just choose from them).'])}

<h3>3.7 Search and filter – E1-US8</h3>
${ul([
  'Search matches <b>name, farmer code, NIC or phone</b> (case-insensitive), plus filters for district, verification status, centre and account status; results are paginated (<code>limit</code> maximum 100, <code>page</code> at least 1).',
  '<b>Injection protection:</b> the text is passed through <code>safeSearch()</code>, which strips <code>, ( ) % * \\</code> and cuts it to 60 characters. Without this, a crafted search string could change the structure of the PostgREST <code>.or()</code> filter.',
  'A logged-in <b>farmer calling this endpoint sees only their own record</b>.'
])}

<h3>3.8 Crop advisor – E1-US9 / US10 / US11</h3>
${table(['Check', 'Rule / result'], [
  ['Access', 'must be logged in as farmer or collection centre officer (<code>authenticate + requireRole</code>)'],
  ['Rate limit', '<b>30 requests per 15 minutes</b> per client → <b>429</b> "Too many crop advisory requests" (protects the optional paid LLM)'],
  ['District', 'required and must match one of the district profiles → otherwise <b>400</b> "Unknown district …"'],
  ['Soil pH', 'optional; if given must be a number between <b>3 and 10</b> → otherwise <b>400</b> "Soil pH must be a number between 3 and 10". The chat also validates this before sending.'],
  ['Language', 'anything other than si / ta is treated as en'],
  ['Previous crop', 'normalised (English, Sinhala, Tamil keywords) – unknown text is treated as no previous crop'],
  ['Output', 'top 3 crops, <code>suitability_score</code>, <code>score_breakdown</code>, rationale in the selected language, season, water need, profitability, district profile, <code>ai_source</code>']
])}

<h3>3.9 Farmer documents (epic description)</h3>
${table(['Rule', 'Detail'], [
  ['Types', 'NIC, land deed, bank passbook, farmer certificate, other'],
  ['Files', 'JPG, PNG, WEBP or PDF only; <b>5 MB maximum</b>; empty files rejected (400)'],
  ['Storage', 'private bucket <code>farmer-documents</code>; downloads through <b>signed URLs valid for 10 minutes</b>'],
  ['Access', 'farmer: own documents only (403 otherwise); officer/admin: all, and can mark a document <b>Verified</b>'],
  ['File name', 'sanitised (<code>[^\\w.\\- ]</code> → <code>_</code>) to prevent path tricks']
])}

<h2>4. Suggested live demo (5–7 minutes)</h2>
${ol([
  'Open the landing page → switch language to Sinhala/Tamil (US2). Show it stays after refresh.',
  'Register a new farmer. Try a weak password to show validation messages (US1). Submit a valid one.',
  'Try to log in immediately → blocked "pending verification" (shows US4 rule).',
  'Log in as officer → <b>Farmer Verification</b> → open the new farmer, check details and documents, <b>Approve</b> (US4). Show the farmer notification.',
  'As officer open <b>Register Farmer</b>: enter a wrong NIC / phone to show validation, then a valid one (US3). Re-enter the same NIC → duplicate error.',
  'Use <b>Farmer Directory</b>: search by name / NIC, filter by status and district (US8).',
  'Log in as the farmer → <b>Profile</b>: edit phone with a bad value, then a good one; upload a document (US5).',
  '<b>Register crop</b>, then <b>My crops</b> for the history (US6, US7).',
  'Open the <b>Crop Advisor</b>: district → previous crop → soil; show the three results, the scores and the breakdown (US9–US11); switch language and ask again.'
])}

<h2>5. Likely viva questions and model answers</h2>
${qa([
  ['Why can a farmer not log in right after registering?', 'Because registration creates the farmer in <b>pending</b> state. A collection officer must verify identity first (US4). This stops fake farmers receiving payments. The login endpoint checks the verification status and returns 403 with an explanation.'],
  ['How do you stop someone registering as an administrator?', 'The public register endpoint validates <code>role</code> with a Zod enum that allows only <b>farmer</b> and <b>buyer</b>. Staff accounts are created by an administrator. We fixed an earlier version that accepted any role.'],
  ['What is the difference between authentication and authorisation here?', 'Authentication = Supabase checks email/password and issues a JWT. Authorisation = <code>requireRole</code> checks the role from the <code>profiles</code> table, and ownership helpers make sure a farmer only touches their own records.'],
  ['Where do you validate and why in three places?', 'Frontend Zod for instant feedback; backend Zod middleware for security because the client can be bypassed; database constraints (NOT NULL, UNIQUE NIC, enums) for integrity. The server is the source of truth.'],
  ['Explain the NIC validation.', 'Sri Lankan NIC has two formats: old = 9 digits followed by V or X (e.g. 781234567V), new = 12 digits. Regex: <code>^(\\d{9}[VvXx]|\\d{12})$</code>. It is also UNIQUE in the database, so a duplicate returns 409.'],
  ['How is the phone number validated?', 'Exactly 10 digits starting with 0: <code>^0\\d{9}$</code>, for example 0771234567.'],
  ['What stops a farmer editing their own verification status?', 'The update endpoint copies only whitelisted columns (mass-assignment protection); verification status is not on the farmer whitelist and the status endpoint is restricted to officers/admins.'],
  ['Can farmer A see farmer B\'s profile or crops?', 'No. Profile, crop, document and payment endpoints call an ownership check and return 403. The farmer list endpoint returns only the farmer\'s own row.'],
  ['How does the language switch work and what if a translation is missing?', 'A React context stores the language in state and localStorage. <code>t(key)</code> returns the Sinhala/Tamil text or falls back to English, so nothing is blank.'],
  ['How does the crop advisor decide?', 'Score out of 100 = location 40 + rotation 30 + soil pH 15 + rainfall 15. Each crop has pH and rainfall ranges and a crop family; district profiles hold rainfall and expert recommendations. We return the top 3 and show the per-factor breakdown.'],
  ['Is it really AI / machine learning?', 'It is an explainable <b>rule-based scoring engine</b>. Optional Gemini only rewrites the explanation in the farmer\'s language; it never picks crops. A Weka/Java prototype was explored in <code>ml-service</code>. We chose a transparent model because farmers need reasons and we had no labelled training data.'],
  ['Why is rotation important?', 'Growing the same crop or the same family repeatedly builds up pests and disease and depletes nutrients, while a legume after a cereal fixes nitrogen. Rotation violations are never recommended.'],
  ['What happens if the farmer does not know their soil pH?', 'They choose "I don\'t know". The pH factor then gets a neutral score (9/15) and the note says pH was not provided.'],
  ['How do you protect the advisor from abuse?', 'Login required, restricted to farmer/officer roles, 30 requests per 15 minutes, and strict input checks (district must exist, pH 3–10).'],
  ['How are search strings made safe?', 'The search term goes through <code>safeSearch()</code> that removes the characters that have a meaning in a PostgREST filter and limits the length, preventing filter injection.'],
  ['Why mask the bank account?', 'Least-privilege on sensitive data: only the last four digits are stored, enough for a farmer to recognise the account but useless to an attacker.'],
  ['How are documents protected?', 'Private storage bucket, type and size checks, ownership checks and 10-minute signed links; staff can mark a document verified.'],
  ['What would you improve next?', 'Real ML trained on historical yield data (the Weka prototype), email/SMS verification at registration, date validation for planting vs harvest, and soil test integration.']
])}

<h2>6. Know your limitations (answer honestly if asked)</h2>
${ul([
  'The advisor is rule-based, not a trained model (see 2.6). Its district knowledge tables are written by hand and could be reviewed by an agricultural officer.',
  'There is no email/phone confirmation at registration (accounts are created already confirmed); the officer verification step is the control.',
  'The app keeps the access token in <code>localStorage</code> (common in SPAs, but exposed if the site had an XSS bug); helmet and input validation reduce that risk.',
  'Registration also stores a bcrypt copy of the password hash in the profile table in addition to Supabase Auth – Supabase Auth remains the real credential store.',
  'Automated tests (72 in total) cover the advisor scoring and all E1 validation rules (registration, farmer and crop formats, dates, soil pH); the screens themselves were checked manually.'
])}

<h2>7. Where to find it in the code</h2>
${table(['Concern', 'File'], [
  ['Zod schemas (register, farmer, crop)', '<code>backend/src/schemas/validationSchemas.ts</code>'],
  ['Auth middleware, <code>requireRole</code>, <code>validate</code>', '<code>backend/src/middleware/auth.ts</code>'],
  ['Register / login', '<code>backend/src/controllers/authController.ts</code>'],
  ['Farmer CRUD, search, verification', '<code>backend/src/controllers/farmerController.ts</code>'],
  ['Ownership helpers', '<code>backend/src/services/access.ts</code>'],
  ['Crops', '<code>backend/src/controllers/cropController.ts</code>'],
  ['Documents', '<code>backend/src/controllers/farmerDocumentController.ts</code>'],
  ['Advisor scoring', '<code>backend/src/services/cropAdvisor.ts</code> (+ <code>botController.ts</code>)'],
  ['Advisor tests', '<code>backend/src/__tests__/cropAdvisor.test.ts</code>'],
  ['Frontend pages', '<code>frontend/src/pages/auth/*</code>, <code>pages/farmer/*</code>, <code>pages/officer/*</code>, <code>components/bot/FarmerCropBotModal.tsx</code>, <code>contexts/LanguageContext.tsx</code>']
])}
${FOUNDATIONS}
`
};
