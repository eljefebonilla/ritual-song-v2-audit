/**
 * Seed sacramental_songs table with Jeff's exact curated funeral music.
 * Source: Funeral_Music_Worksheet.md (St. Monica Catholic Community)
 * Run: npx tsx scripts/seed-funeral-songs.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SeedSong {
  title: string;
  composer: string | null;
  category: string;
  is_starred: boolean;
  notes?: string;
  psalm_number?: number;
}

interface StepDef {
  step_number: number;
  step_label: string;
  songs: SeedSong[];
}

// ─── STEP 1: PRELUDE (OPTIONAL) ─────────────────────────────────────────────
const step1: StepDef = {
  step_number: 1,
  step_label: "Prelude",
  songs: [
    { title: "O Danny Boy", composer: "Frederic Weatherly", category: "Traditional", is_starred: false },
    { title: "Go Rest High on That Mountain", composer: "Vince Gill", category: "Traditional", is_starred: false },
    { title: "Bridge Over Troubled Water", composer: "Simon & Garfunkel", category: "Contemporary", is_starred: false },
    { title: "Remember Me (from Coco)", composer: null, category: "Contemporary", is_starred: false },
    { title: "Tears In Heaven", composer: "Eric Clapton", category: "Contemporary", is_starred: false },
  ],
};

// ─── STEP 2: OPENING SONG ──────────────────────────────────────────────────
const step2: StepDef = {
  step_number: 2,
  step_label: "Opening Song",
  songs: [
    { title: "Amazing Grace", composer: "John Newton", category: "Traditional", is_starred: false },
    { title: "How Great Thou Art", composer: "Stuart K. Hine", category: "Traditional", is_starred: true },
    { title: "Morning Has Broken", composer: "Eleanor Farjeon", category: "Traditional", is_starred: false },
    { title: "On Eagle's Wings", composer: "Michael Joncas", category: "Traditional", is_starred: false },
    { title: "Come Unto Me", composer: "Bob Hurd", category: "Traditional", is_starred: true },
    { title: "I Am the Bread of Life", composer: "Suzanne Toolan", category: "Traditional", is_starred: true },
    // Spanish options
    { title: "Entre Tus Manos", composer: null, category: "Spanish", is_starred: false },
    { title: "Pan de Vida", composer: null, category: "Spanish", is_starred: false },
    { title: "Resucitó", composer: null, category: "Spanish", is_starred: false },
    { title: "Renuévame", composer: null, category: "Spanish", is_starred: false },
    { title: "Tuyo Soy", composer: null, category: "Spanish", is_starred: false },
  ],
};

// ─── STEP 3: RESPONSORIAL PSALM ─────────────────────────────────────────────
const step3: StepDef = {
  step_number: 3,
  step_label: "Responsorial Psalm",
  songs: [
    // Psalm 23
    { title: "Lyric Psalter (Ps 23)", composer: "Tony Alonso", category: "Traditional", is_starred: false, psalm_number: 23, notes: "R/. The Lord is my shepherd; there is nothing I shall want." },
    { title: "The Lord Is My Shepherd", composer: "Josh Blakesley", category: "Contemporary", is_starred: true, psalm_number: 23, notes: "R/. The Lord is my shepherd; there is nothing I shall want." },
    { title: "Shepherd Me, O God", composer: "Marty Haugen", category: "Contemporary", is_starred: true, psalm_number: 23, notes: "R/. The Lord is my shepherd; there is nothing I shall want." },
    // Psalm 25
    { title: "To You, O Lord", composer: "Janet Sullivan Whitaker", category: "Traditional", is_starred: false, psalm_number: 25, notes: "R/. To you, O Lord, I lift my soul." },
    { title: "To You, O Lord, I Lift Up My Soul", composer: "Bob Hurd", category: "Traditional", is_starred: false, psalm_number: 25, notes: "R/. To you, O Lord, I lift my soul." },
    { title: "To You, O Lord, I Lift Up My Soul", composer: "Francesca LaRosa", category: "Contemporary", is_starred: false, psalm_number: 25, notes: "R/. To you, O Lord, I lift my soul." },
    // Psalm 27
    { title: "Spirit & Psalm (Ps 27)", composer: "Cooper Ray", category: "Traditional", is_starred: false, psalm_number: 27, notes: "R/. The Lord is my light and my salvation." },
    { title: "The Lord Is My Light and My Salvation", composer: "Francesca LaRosa", category: "Contemporary", is_starred: false, psalm_number: 27, notes: "R/. The Lord is my light and my salvation." },
    // Psalm 42
    { title: "As the Deer Longs", composer: "Bob Hurd", category: "Traditional", is_starred: false, psalm_number: 42, notes: "R/. My soul is thirsting for the living God." },
    { title: "My Soul is Thirsting for the Living God", composer: "Francesca LaRosa", category: "Contemporary", is_starred: false, psalm_number: 42, notes: "R/. My soul is thirsting for the living God." },
    // Psalm 63
    { title: "Spirit & Psalm (Ps 63)", composer: "Curtis Stephan", category: "Traditional", is_starred: false, psalm_number: 63, notes: "R/. My soul is thirsting for you, O Lord my God." },
    { title: "My Soul Is Thirsting", composer: "Steve Angrisano", category: "Contemporary", is_starred: false, psalm_number: 63, notes: "R/. My soul is thirsting for you, O Lord my God." },
    { title: "My Soul Is Thirsting for You, O Lord My God", composer: "Francesca LaRosa", category: "Contemporary", is_starred: false, psalm_number: 63, notes: "R/. My soul is thirsting for you, O Lord my God." },
    // Psalm 103
    { title: "The Lord Is Kind and Merciful", composer: "Ricky Manalo", category: "Traditional", is_starred: false, psalm_number: 103, notes: "R/. The Lord is kind and merciful." },
    { title: "The Lord Is Kind and Merciful", composer: "Craig and Kristen Colson", category: "Contemporary", is_starred: false, psalm_number: 103, notes: "R/. The Lord is kind and merciful." },
    { title: "The Lord Is Kind and Merciful", composer: "Francesca LaRosa", category: "Contemporary", is_starred: false, psalm_number: 103, notes: "R/. The Lord is kind and merciful." },
    // Psalm 116
    { title: "In the Presence of God", composer: "Tom Kendzia", category: "Traditional", is_starred: false, psalm_number: 116, notes: "R/. I will walk in the presence of the Lord in the land of the living." },
    { title: "I Will Walk in the Presence of the Lord", composer: "Francesca LaRosa", category: "Contemporary", is_starred: false, psalm_number: 116, notes: "R/. I will walk in the presence of the Lord in the land of the living." },
    // Psalm 122
    { title: "I Rejoiced When I Heard Them Say", composer: "Francesca LaRosa", category: "Contemporary", is_starred: false, psalm_number: 122, notes: "R/. I rejoiced when I heard them say: let us go to the house of the Lord." },
    { title: "Let Us Go Rejoicing (Spirit & Song)", composer: "Sarah Hart", category: "Contemporary", is_starred: false, psalm_number: 122, notes: "R/. Let us go rejoicing to the house of the Lord." },
    // Psalm 130
    { title: "Spirit & Song (Ps 130)", composer: "Ben Walther", category: "Traditional", is_starred: false, psalm_number: 130, notes: "R/. Out of the depths, I cry to you, Lord." },
    { title: "Out of the Depths", composer: "Scott Soper", category: "Traditional", is_starred: false, psalm_number: 130, notes: "R/. Out of the depths, I cry to you, Lord." },
    { title: "I Hope in the Lord, I Trust In His Word", composer: "Francesca LaRosa", category: "Contemporary", is_starred: false, psalm_number: 130, notes: "R/. I hope in the Lord, I trust in his word." },
    // Psalm 143
    { title: "O Lord, Hear My Prayer", composer: "Francesca LaRosa", category: "Contemporary", is_starred: false, psalm_number: 143, notes: "R/. O Lord, hear my prayer." },
  ],
};

// ─── STEP 4: GOSPEL ACCLAMATION ─────────────────────────────────────────────
const step4: StepDef = {
  step_number: 4,
  step_label: "Gospel Acclamation",
  songs: [
    // Traditional
    { title: "Celtic Alleluia", composer: "Christopher Walker", category: "Traditional", is_starred: false },
    { title: "Easter Alleluia", composer: "Marty Haugen", category: "Traditional", is_starred: false },
    { title: "Halle Halle", composer: "Marty Haugen", category: "Traditional", is_starred: false },
    { title: "Mass of Joy and Peace", composer: "Tony Alonso", category: "Traditional", is_starred: false },
    { title: "Santa Clara Mass", composer: "Bob Hurd", category: "Traditional", is_starred: false },
    // Contemporary
    { title: "Hallelujah", composer: "Leonard Cohen", category: "Contemporary", is_starred: false, notes: "Adapted for Liturgy" },
    { title: "Misa del Mundo", composer: "Jesse Manibusan", category: "Contemporary", is_starred: false },
    { title: "Mass of a Joyful Heart", composer: "Steve Angrisano", category: "Contemporary", is_starred: false },
    { title: "Mass of Glory", composer: "Canedo/Hurd/MacAller", category: "Contemporary", is_starred: false },
    { title: "Mass of Restoration", composer: "Joshua Blakesley", category: "Contemporary", is_starred: false },
    { title: "Mass of Renewal", composer: "Curtis Stephan", category: "Contemporary", is_starred: false },
    { title: "Mass of St. Mary Magdalene", composer: "Sarah Hart", category: "Contemporary", is_starred: false },
    // Lenten Traditional
    { title: "Mass of Christ the Savior (Lenten)", composer: "Dan Schutte", category: "Lenten", is_starred: false },
    { title: "Mass of Joy and Peace (Lenten)", composer: "Tony Alonso", category: "Lenten", is_starred: false },
    { title: "Mass of Christ Light of Nations (Lenten)", composer: "Tony Alonso", category: "Lenten", is_starred: false },
    { title: "Mass of Spirit and Grace (Lenten)", composer: "Ricky Manalo, CSP", category: "Lenten", is_starred: false },
    { title: "Santa Clara Mass (Lenten)", composer: "Bob Hurd", category: "Lenten", is_starred: false },
    // Lenten Contemporary
    { title: "Mass of a Joyful Heart (Lenten)", composer: "Steve Angrisano", category: "Lenten", is_starred: false },
    { title: "Mass of Glory (Lenten)", composer: "Canedo/Hurd/MacAller", category: "Lenten", is_starred: false },
    { title: "Mass of Renewal (Lenten)", composer: "Curtis Stephan", category: "Lenten", is_starred: false },
    { title: "Mass of St. Mary Magdalene (Lenten)", composer: "Sarah Hart", category: "Lenten", is_starred: false },
  ],
};

// ─── STEP 5: GIFTS SONG ────────────────────────────────────────────────────
const step5: StepDef = {
  step_number: 5,
  step_label: "Gifts Song",
  songs: [
    // Traditional
    { title: "All Shall Be Well", composer: "Barbara Bridge", category: "Traditional", is_starred: false },
    { title: "Amazing Grace", composer: "John Newton", category: "Traditional", is_starred: false },
    { title: "Ave Maria", composer: "Franz Schubert", category: "Traditional", is_starred: false },
    { title: "Ave Maria", composer: "Charles Gounod & Bach", category: "Traditional", is_starred: false },
    { title: "Carry Me Home", composer: "Rick Modlin & Owen Alstott", category: "Traditional", is_starred: false },
    { title: "Deep Peace", composer: "Barbara Bridge", category: "Traditional", is_starred: false },
    { title: "Holy Is His Name", composer: "John Michael Talbot", category: "Traditional", is_starred: false },
    { title: "I Have Loved You", composer: "Michael Joncas", category: "Traditional", is_starred: false },
    { title: "I Know That My Redeemer Lives", composer: "Janet Sullivan Whitaker", category: "Traditional", is_starred: false },
    { title: "In Every Age", composer: "Janet Sullivan Whitaker", category: "Traditional", is_starred: false },
    { title: "It Is Well With My Soul", composer: "Horatio Spafford & Philip Bliss", category: "Traditional", is_starred: true },
    { title: "Precious Lord, Take My Hand", composer: null, category: "Traditional", is_starred: false },
    { title: "Saints and Beloved of God", composer: "Dan Schutte", category: "Traditional", is_starred: false },
    // Contemporary
    { title: "Hold On", composer: "Adam Tice, Arr. by Sally Ann Morris", category: "Contemporary", is_starred: true },
    { title: "It Is Well", composer: "Kristene DiMarco", category: "Contemporary", is_starred: false },
    { title: "Praise Before My Breakthrough", composer: "Bryan & Katie Torwalt", category: "Contemporary", is_starred: false },
    { title: "When We All Get to Heaven", composer: "Casting Crowns", category: "Contemporary", is_starred: false },
  ],
};

// ─── STEP 6: MASS SETTING ───────────────────────────────────────────────────
const step6: StepDef = {
  step_number: 6,
  step_label: "Mass Setting",
  songs: [
    // Traditional
    { title: "Mass of Christ Our Savior", composer: "Dan Schutte", category: "Traditional", is_starred: false, notes: "Holy, When We Eat This Bread, Amen, Lamb of God" },
    { title: "Mass of Creation", composer: "Marty Haugen", category: "Traditional", is_starred: false, notes: "Holy, When We Eat This Bread, Amen, Lamb of God" },
    { title: "Mass of Joy and Peace", composer: "Tony Alonso", category: "Traditional", is_starred: false, notes: "Holy, Save Us Savior, Amen, Lamb of God" },
    // Contemporary
    { title: "Mass for the Healing of the World", composer: "Trevor Thomson", category: "Contemporary", is_starred: false, notes: "Holy, When We Eat This Bread, Amen, Lamb of God" },
    { title: "Mass of Glory", composer: "Bob Hurd", category: "Contemporary", is_starred: false, notes: "Holy, We Proclaim Your Death, Amen, Lamb of God" },
    { title: "Mass of Restoration", composer: "Joshua Blakesley", category: "Contemporary", is_starred: false, notes: "Holy, Save Us Savior, Amen, Lamb of God" },
    // Additional Lamb of God
    { title: "Mass of the Holy Cross - Lamb of God", composer: null, category: "Traditional", is_starred: false, notes: "Additional Lamb of God option" },
    { title: "Mass of St Timothy - Lamb of God", composer: null, category: "Traditional", is_starred: false, notes: "Additional Lamb of God option" },
    { title: "Agnus Dei (Latin Chant)", composer: null, category: "Traditional", is_starred: false, notes: "Additional Lamb of God option" },
  ],
};

// ─── STEP 7: COMMUNION SONGS ────────────────────────────────────────────────
const step7: StepDef = {
  step_number: 7,
  step_label: "Communion Songs",
  songs: [
    // Traditional
    { title: "As the Deer Longs", composer: "Hurd", category: "Traditional", is_starred: false },
    { title: "Be Not Afraid", composer: "Bob Dufford, SJ", category: "Traditional", is_starred: true },
    { title: "Eye Has Not Seen", composer: "Marty Haugen", category: "Traditional", is_starred: false },
    { title: "Give Me Jesus", composer: "Sara Watkins", category: "Traditional", is_starred: false },
    { title: "Here I Am, Lord", composer: "Dan Schutte", category: "Traditional", is_starred: false },
    { title: "How Great Thou Art", composer: "Stuart K. Hine", category: "Traditional", is_starred: true },
    { title: "I Am the Bread of Life", composer: "Suzanne Toolan", category: "Traditional", is_starred: true },
    { title: "On Eagle's Wings", composer: "Michael Joncas", category: "Traditional", is_starred: true },
    // Contemporary
    { title: "Bread of Angels", composer: "Curtis Stephan", category: "Contemporary", is_starred: false },
    { title: "I Will Lift My Eyes", composer: "Tony Alonso", category: "Contemporary", is_starred: false },
    { title: "Pastures of the Lord", composer: "Curtis Stephan", category: "Contemporary", is_starred: false },
  ],
};

// ─── STEP 8: MEDITATION (OPTIONAL) ──────────────────────────────────────────
const step8: StepDef = {
  step_number: 8,
  step_label: "Meditation",
  songs: [
    // Traditional
    { title: "Goin' Home", composer: "Antonin Dvorak", category: "Traditional", is_starred: false },
    { title: "Hail Mary: Gentle Woman", composer: "Carey Landry", category: "Traditional", is_starred: false },
    { title: "May the Road Rise to Meet You", composer: "Lori True", category: "Traditional", is_starred: false },
    { title: "Take, Lord, Receive", composer: "John Foley, SJ", category: "Traditional", is_starred: false },
    // Contemporary
    { title: "Dancing With the Angels", composer: "Monk & Neagle", category: "Contemporary", is_starred: false },
    { title: "I Can Only Imagine", composer: "MercyMe", category: "Contemporary", is_starred: false },
    { title: "Scars In Heaven", composer: "Casting Crowns", category: "Contemporary", is_starred: false },
    { title: "Well Done", composer: "The Afters", category: "Contemporary", is_starred: false },
  ],
};

// ─── STEP 9: SONG OF FAREWELL ───────────────────────────────────────────────
const step9: StepDef = {
  step_number: 9,
  step_label: "Song of Farewell",
  songs: [
    // Traditional
    { title: "Celtic Song of Farewell", composer: "Steve Schaubel", category: "Traditional", is_starred: false, notes: "Tune: O Danny Boy" },
    { title: "Song of Farewell", composer: "Grayson Warren Brown", category: "Traditional", is_starred: false, notes: "Great with choir" },
    { title: "Song of Farewell", composer: "Dennis C. Smolarski", category: "Traditional", is_starred: false, notes: "Tune: Old Hundredth" },
    // Contemporary
    { title: "Song of Farewell", composer: "Sarah Hart & Francesca LaRosa", category: "Contemporary", is_starred: false, notes: "Newest setting, beautiful" },
    { title: "May the Angels be Your Guide", composer: "Michele MacAller & Kathy McGrath", category: "Contemporary", is_starred: false, notes: "Great with solo voice or choir" },
    { title: "Song of Farewell", composer: "Justin Krueger", category: "Contemporary", is_starred: false, notes: "Great with choir" },
    // Bilingual
    { title: "Santos de Dios / Saints of God", composer: "Tony Alonso", category: "Bilingual", is_starred: false },
  ],
};

// ─── STEP 10: CLOSING SONG ──────────────────────────────────────────────────
const step10: StepDef = {
  step_number: 10,
  step_label: "Closing Song",
  songs: [
    // Traditional
    { title: "Lord of All Hopefulness (SLANE)", composer: "Jan Struther", category: "Traditional", is_starred: false },
    { title: "I Am the Bread of Life", composer: "Suzanne Toolan", category: "Traditional", is_starred: true },
    { title: "On Eagle's Wings", composer: "Michael Joncas", category: "Traditional", is_starred: true },
    // Contemporary
    { title: "Go In Peace", composer: "Sarah Hart", category: "Contemporary", is_starred: true },
    { title: "Goin' Up Yonder", composer: "Walter Hawkins", category: "Contemporary", is_starred: false },
    { title: "May the Angels Lead You Home", composer: "Sarah Hart & Francesca LaRosa", category: "Contemporary", is_starred: false },
    { title: "Pastures of the Lord", composer: "Curtis Stephan", category: "Contemporary", is_starred: false },
    { title: "We Belong to You", composer: "Trevor Thomson", category: "Contemporary", is_starred: false },
    { title: "I Will Remember You", composer: "Brenton Brown", category: "Contemporary", is_starred: false },
  ],
};

// ─── MAIN ───────────────────────────────────────────────────────────────────

const ALL_STEPS: StepDef[] = [step1, step2, step3, step4, step5, step6, step7, step8, step9, step10];

async function main() {
  // Clear existing funeral songs
  console.log("Clearing existing funeral songs...");
  const { error: deleteError } = await supabase
    .from("sacramental_songs")
    .delete()
    .eq("liturgy_type", "funeral");

  if (deleteError) {
    console.error("Failed to clear:", deleteError.message);
    return;
  }

  let totalInserted = 0;

  for (const step of ALL_STEPS) {
    const rows = step.songs.map((song, i) => ({
      title: song.title,
      composer: song.composer,
      liturgy_type: "funeral" as const,
      step_number: step.step_number,
      step_label: step.step_label,
      category: song.category,
      subcategory: null,
      instrumentation: null,
      is_starred: song.is_starred,
      is_bilingual: false,
      language: "en",
      together_for_life_code: null,
      psalm_number: song.psalm_number || null,
      notes: song.notes || null,
      song_id: null,
      sort_order: i,
    }));

    const { error } = await supabase.from("sacramental_songs").insert(rows);
    if (error) {
      console.error(`Step ${step.step_number} error:`, error.message);
    } else {
      totalInserted += rows.length;
      console.log(`Step ${step.step_number} (${step.step_label}): ${rows.length} songs`);
    }
  }

  console.log(`\nDone! Inserted ${totalInserted} funeral songs total.`);
}

main().catch(console.error);
