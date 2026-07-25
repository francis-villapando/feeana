import { createClient } from "@supabase/supabase-js";
import { adminExec, closeAdminSqlClient } from "../src/lib/db/adminSql";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SESSION_ID = "3da770a1-ca05-422c-9b6b-c85f2f92dc4e";

async function cleanupBeforeReseed(): Promise<void> {
  await adminExec([{ text: "DELETE FROM feedback WHERE session_id = $1", params: [SESSION_ID] }]);
}

async function main() {
  await cleanupBeforeReseed();
  console.log("Pre-seed cleanup complete.");

  console.log("Seeding test data via Supabase Admin...");

  // 1. Faculty profile
  const { data: faculty } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", "faculty@test.com")
    .maybeSingle();

  let facultyId = faculty?.id;
  if (!facultyId) {
    const { data: createdFac, error } = await supabaseAdmin
      .from("profiles")
      .insert({ email: "faculty@test.com", full_name: "Test Faculty", role: "faculty" })
      .select("id")
      .single();
    if (error) console.error("Faculty insert error:", error);
    facultyId = createdFac?.id;
  }

  // Student profile
  const { data: student } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", "student@test.com")
    .maybeSingle();

  let studentId = student?.id;
  if (!studentId) {
    const { data: createdStud, error } = await supabaseAdmin
      .from("profiles")
      .insert({ email: "student@test.com", full_name: "Test Student", role: "student" })
      .select("id")
      .single();
    if (error) console.error("Student insert error:", error);
    studentId = createdStud?.id;
  }

  // 2. Course CSEG2
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("id")
    .eq("code", "CSEG2")
    .maybeSingle();

  let courseId = course?.id;
  if (!courseId) {
    const { data: createdCourse, error } = await supabaseAdmin
      .from("courses")
      .insert({ code: "CSEG2", title: "Game Programming 1" })
      .select("id")
      .single();
    if (error) console.error("Course insert error:", error);
    courseId = createdCourse?.id;
  }

  // 3. Topic
  const { data: topic } = await supabaseAdmin
    .from("topics")
    .select("id")
    .eq("course_id", courseId!)
    .eq("title", "Introduction to Game Programming")
    .maybeSingle();

  let topicId = topic?.id;
  if (!topicId) {
    const { data: createdTopic, error } = await supabaseAdmin
      .from("topics")
      .insert({ course_id: courseId!, title: "Introduction to Game Programming" })
      .select("id")
      .single();
    if (error) console.error("Topic insert error:", error);
    topicId = createdTopic?.id;
  }

  // 4. ILOs
  const iloStatements = [
    {
      statement:
        "Apply fundamental game programming concepts to build a simple interactive application",
      bloom_level: "Apply",
    },
    {
      statement:
        "Analyze game mechanics and implement gameplay systems using object-oriented design",
      bloom_level: "Analyze",
    },
  ];

  for (const item of iloStatements) {
    const { data: existingIlo } = await supabaseAdmin
      .from("ilos")
      .select("id")
      .eq("course_id", courseId!)
      .eq("statement", item.statement)
      .maybeSingle();

    if (!existingIlo) {
      await supabaseAdmin.from("ilos").insert({
        course_id: courseId!,
        topic_id: topicId!,
        statement: item.statement,
        bloom_level: item.bloom_level,
      });
    }
  }

  // 5. Class 3CS-C
  const { data: cls } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("section", "3CS-C")
    .eq("course", "CSEG2")
    .maybeSingle();

  let classId = cls?.id;
  if (!classId) {
    const { data: createdCls, error } = await supabaseAdmin
      .from("classes")
      .insert({
        faculty_id: facultyId!,
        course_id: courseId!,
        course: "CSEG2",
        section: "3CS-C",
        name: "Game Programming 1 - 3CS-C",
        enroll_code: "CSEG2-3CSC-SEED",
      })
      .select("id")
      .single();
    if (error) console.error("Class insert error:", error);
    classId = createdCls?.id;
  }

  // 6. Enrollment
  if (classId && studentId) {
    await supabaseAdmin
      .from("enrollments")
      .upsert({ class_id: classId, student_id: studentId }, { onConflict: "class_id,student_id" });
  }

  // 7. Session
  const { data: session } = await supabaseAdmin
    .from("sessions")
    .select("id")
    .eq("id", SESSION_ID)
    .maybeSingle();

  if (!session && classId) {
    const { data: ilos } = await supabaseAdmin.from("ilos").select("id").eq("course_id", courseId!);
    const iloIds = (ilos ?? []).map((i) => i.id);

    await supabaseAdmin.from("sessions").insert({
      id: SESSION_ID,
      class_id: classId,
      course_id: courseId!,
      topic: "Introduction to Game Programming",
      status: "ended",
      target_bloom_level: "Apply",
      ilo_ids: iloIds,
      expected_responses: 40,
    });
  }

  // 8. Feedback entries (40 Taglish items)
  const { count } = await supabaseAdmin
    .from("feedback")
    .select("*", { count: "exact", head: true })
    .eq("session_id", SESSION_ID);

  if ((count ?? 0) === 0 && studentId) {
    const feedbackTexts = [
      "Medyo mabilis po ang pacing sa game loop topic.",
      "Maganda po ang explanation ng delta time pero kailangan ng more examples.",
      "Nahihirapan po ako sa vector math implementation.",
      "Clear po ang lecture pero kulang sa hands-on coding demo.",
      "Super helpful ng visual diagrams para sa collision detection!",
      "Sana po may downloadable starter code before session starts.",
      "Medyo confusing po ang difference ng Update at FixedUpdate.",
      "Gusto ko po ung interactive quiz at the end of class.",
      "Mabilis magturo si Sir pero nakakasabay naman pag nag-review.",
      "Kailangan po ng additional exercises for state management.",
      "Okay po ang pacing for basic concepts.",
      "Maganda po ung real-world game architecture breakdown.",
      "Medyo mahirap intindihin ung memory management part.",
      "Sana magbigay po ng sample project repo sa GitHub.",
      "Very engaging po ang session today!",
      "Nalilito po ako sa event handling and delegates.",
      "Sana may step-by-step tutorial guide sa LMS.",
      "Great job explaining component-based design pattern!",
      "Medyo kulang po ang time for Q&A after lecture.",
      "Naintindihan ko po nang maayos ung sprite animation tutorial.",
      "Mabilis po mag-code si Sir sa screen, hirap sundan.",
      "Clear and structured po ang slides.",
      "Kailangan po ng recap next meeting on physics engine.",
      "Sana po may recording available after class.",
      "Nakatulong po ung live debugging session.",
      "Medyo malabo po ung audio nung katapusan ng class.",
      "Maganda po ung discussion on framerate independence.",
      "Gusto ko po ung group activity today.",
      "Sana po bawasan ung theoretical slides and more code.",
      "Very clear explanation of object pooling pattern!",
      "Nahihirapan po ako intindihin ung coroutine lifecycle.",
      "Sana may supplementary reading material for advanced topics.",
      "Perfect pacing today, smooth flow of topics!",
      "Medyo mabilis po ang transitions between topics.",
      "Naintindihan ko na po kung bakit kailangan ng delta time.",
      "Maganda po ung practical application demo.",
      "Kailangan po ng breakdown on scene management.",
      "Great session! Excited to apply this in our project.",
      "Sana po mas mahaba ung hands-on workshop part.",
      "Overall solid session, clear objectives!",
    ];

    const feedbackRows = feedbackTexts.map((text) => ({
      session_id: SESSION_ID,
      student_id: studentId!,
      feedback_text: text,
    }));

    await supabaseAdmin.from("feedback").insert(feedbackRows);
    console.log(`Inserted ${feedbackRows.length} feedback entries.`);
  }

  console.log("Seeding complete!");
  await closeAdminSqlClient();
}

main().catch(console.error);
