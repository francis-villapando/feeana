-- ============================================================
-- Seed Script: 40 Taglish Classroom Feedback Entries
-- Target  : Session "Introduction to Game Programming" (CSEG2)
-- Course  : CSEG2 — Game Programming 1
-- Section : 3CS-C
-- Student : student@test.com (all 40 entries)
-- Faculty : faculty@test.com
-- ============================================================
-- How to run:
--   Option A (Supabase SQL Editor):
--     Copy-paste this entire file into your Supabase SQL Editor
--     at https://supabase.com/dashboard/project/narsikmkqjoxlfbonsqs/sql/new
--     and click "Run".
--
--   Option B (Local supabase CLI):
--     supabase db reset   (loads supabase/seed.sql automatically)
--
--   Option C (Direct psql):
--     psql "postgresql://..." -f supabase/seed.sql
-- ============================================================

-- Re-run safety: clear any existing feedback for the target session
DELETE FROM feedback
WHERE session_id = '3da770a1-ca05-422c-9b6b-c85f2f92dc4e';

-- Insert 40 Taglish/code-switched classroom feedback entries
-- All submitted by one student (f728d46a-0c73-4c93-b2b6-85b16ba47533)
INSERT INTO feedback (session_id, content, meta) VALUES

-- ======== relational coldness ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Parang suplado si sir, tinatanong ko sa Discord pero dinidedma lang ako.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Hindi nagre-reply si Sir sa MS Teams, parang ayaw niya kaming tulungan sa debugging.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== classroom tension ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Sobrang nakakatakot at high pressure tuwing Q&A, palaging galit at naninermon si ma''am.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Ang init lagi ng ulo ni Ma''am sa Zoom, nakaka-stress pumasok sa session niya.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Nakakatakot magtanong kay Sir, baka sermunan lang kami imbes na sagutin yung query.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== evaluation unfairness ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Parang ang unfair ng pag-grade, laging may paborito si sir sa section natin.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Bakit binabaan yung grade ko? Hindi man lang inexplain kung saan ako nagkamali sa logic.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Parang paborito ni sir yung kabilang group, mas mahaba siya mag-explain sa kanila.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== perceived marginalization ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Pakiramdam ko na-ooverlook ako sa class activities kasi laging yung maiingay lang ang pinapansin.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Feeling ko invisible ako sa class discussion, kahit nagre-raise hand ako, ''di ako napapansin.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== subject alienation ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Bakit ba natin pinag-aaralan ito? Parang wala namang practical application sa totoong buhay.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Sobrang boring at abstract ng Discrete Math, feeling ko ''di ko naman ito magagamit sa work.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Bakit kailangan pa i-solve ito manually? Parang wala namang sense sa modern programming.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== peer distraction ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Maingay masyado sa likod habang nagle-lecture, hindi ako makapag-focus dahil sa chismisan nila.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Yung mga classmates ko sa GC ang ingay, distract na distract ako habang nagle-lecture.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Sobrang toxic ng environment sa Discord, panay chismis imbes na tulungan sa coding.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== instructional cadence ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Sobrang bilis magsalita at mag-slide ni sir, hindi ko na ma-follow yung tempo ng lesson.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Ang bilis mag-next slide ni sir, ''di ko pa nasusundan yung logic nung current algorithm.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Medyo slow yung pacing, feeling ko sayang yung time kasi alam na namin yung basics.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== clarity deficit ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Ang gulo at malabo mag-explain si ma''am, walang magandang examples para magets namin.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Nalilito ako sa explanation, parang lalong sumasakit ulo ko sa gulo mag-explain.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Ang labo ng instructions sa activity, parang kailangan pa naming manghula kung ano yung output.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== abstract logic gap ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Ang hirap intindihin ng logical proofs at algorithms, parang andaming mathematical logic leaps.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Nahihirapan ako i-trace yung recursive calls, parang andaming logic leaps sa solution.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Hirap i-visualize nung Binary Search Tree rotations, ''di ko ma-follow yung logical steps.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== procedural bottleneck ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Nalilito ako sa step-by-step setup ng development environment at compiler configuration.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Stuck ako sa Docker installation, andaming errors na hindi ko alam kung paano i-resolve.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Palaging error yung environment variables ko, ''di ako makapag-proceed sa actual coding.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== conceptual misalignment ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Medyo nalilito pa rin ako sa pinagkaiba ng parameters vs arguments sa functions.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Akala ko gets ko na yung Inheritance, pero lito pa rin ako sa application ng Polymorphism.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Lito ako sa difference ng ''Pass by Value'' vs ''Pass by Reference'' sa implementation.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== design synthesis failure ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Nahihirapan akong pagsamahin yung visual layout design at yung dynamic backend state ng application.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Hirap i-connect yung database logic sa frontend UI components namin.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Hindi ko alam kung paano pagsasamahin yung Auth logic at yung State Management.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== feedback latency ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Matagal mag-feedback si ma''am, tapos na ang midterms pero hindi pa rin nachecheckan yung early assignments.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Finals na pero yung Lab 2 feedback wala pa rin, ''di namin alam kung tama yung coding style namin.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Tagal mag-update ng grades ni Ma''am, ''di namin alam kung papasa ba kami.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

-- ======== notation struggle ========
('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Palagi akong sumasablay sa syntax, nakakalimutan ko kung saan dapat ilagay yung curly braces at semicolons.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Syntax error lagi sa SQL, ''di ko makuha yung tamang placement ng double quotes at aliases.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb),

('3da770a1-ca05-422c-9b6b-c85f2f92dc4e',
 'Nakakalimutan ko lagi yong colon at indentation sa Python, nakaka-frustrate yung logic errors.',
 '{"submittedBy": "f728d46a-0c73-4c93-b2b6-85b16ba47533"}'::jsonb);

-- ============================================================
-- Verify
-- ============================================================
SELECT COUNT(*) AS total_seeded_feedback
FROM feedback
WHERE session_id = '3da770a1-ca05-422c-9b6b-c85f2f92dc4e';
