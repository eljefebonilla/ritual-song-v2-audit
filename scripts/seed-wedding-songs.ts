/**
 * Seed sacramental_songs table with Jeff's exact curated wedding music.
 * Source: Wedding Music Guide.pdf (St. Monica Catholic Community)
 * Run: npx tsx scripts/seed-wedding-songs.ts
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
  subcategory?: string;
  instrumentation?: string;
  is_starred: boolean;
  together_for_life_code?: string;
  notes?: string;
}

interface StepDef {
  step_number: number;
  step_label: string;
  songs: SeedSong[];
}

// ─── STEP 1: PRELUDES ───────────────────────────────────────────────────────
const step1: StepDef = {
  step_number: 1,
  step_label: "Preludes",
  songs: [
    // Classical Preludes
    { title: "A Dream is a Wish Your Heart Makes (from Cinderella)", composer: null, category: "Classical", instrumentation: "piano (opt. singer)", is_starred: true },
    { title: "Adagio from Sonata in E-Flat", composer: "Mozart", category: "Classical", instrumentation: "piano", is_starred: false },
    { title: "Air On The G String (from Orchestral Suite No.3)", composer: "Johann Sebastian Bach", category: "Classical", instrumentation: "piano (opt. cello)", is_starred: false },
    { title: "Canon in D", composer: "Johann Pachelbel", category: "Classical", instrumentation: "piano or organ (opt. violin, cello, guitar, flute, trumpet, etc.)", is_starred: false },
    { title: "Clair de Lune", composer: "Debussy", category: "Classical", instrumentation: "piano", is_starred: false },
    { title: "Jesu, Joy of Man's Desiring", composer: "Johann Sebastian Bach", category: "Classical", instrumentation: "piano or organ", is_starred: true },
    { title: "Nocturne In E flat, Op.9 No.2", composer: "Chopin", category: "Classical", instrumentation: "piano", is_starred: false },
    { title: "Ode to Joy", composer: "Ludwig Van Beethoven", category: "Classical", instrumentation: "piano or organ (opt. violin, cello, etc.)", is_starred: false },
    { title: "Sheep May Safely Graze", composer: "Johann Sebastian Bach", category: "Classical", instrumentation: "piano", is_starred: false },
    { title: "Waltz (from Sleeping Beauty Act 1)", composer: "Tchaikovsky", category: "Classical", instrumentation: "piano (opt. violin, cello, etc.)", is_starred: false },
    // Contemporary Christian Preludes
    { title: "I Give You My Heart", composer: "Morgan", category: "Contemporary Christian", is_starred: false },
    { title: "I Will Be Here", composer: "Steven Curtis Chapman", category: "Contemporary Christian", is_starred: false },
    { title: "Love Never Fails", composer: "Brandon Heath", category: "Contemporary Christian", is_starred: true, notes: "This piece can also be sung by a female cantor." },
    { title: "Reckless Love", composer: "Culver/Asbury", category: "Contemporary Christian", is_starred: false },
    { title: "Set Me As A Seal (Duet)", composer: "Matt Maher", category: "Contemporary Christian", is_starred: true, notes: "Can be a solo or duet." },
    { title: "Take the World", composer: "JOHNNYSWIM", category: "Contemporary Christian", notes: "Duet.", is_starred: false },
    { title: "The Prayer (Duet)", composer: "Andrea Bocelli / Celine Dion", category: "Contemporary Christian", is_starred: true, notes: "Not every cantor sings this. Please inquire if you want this song." },
    { title: "Whatever May Come (Duet)", composer: "Jeremy and Adrienne Camp", category: "Contemporary Christian", is_starred: false },
    { title: "When God Made You (Duet)", composer: "New Song", category: "Contemporary Christian", is_starred: false },
    { title: "When I Say I Do", composer: "Matthew West", category: "Contemporary Christian", is_starred: false },
    { title: "You Raise Me Up", composer: "Josh Groban", category: "Contemporary Christian", is_starred: false },
    // Pre-approved Secular Preludes
    { title: "A Thousand Years", composer: "Christina Perri", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: false },
    { title: "All of Me", composer: "John Legend", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: false },
    { title: "All You Need Is Love", composer: "The Beatles", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, guitar, rhythm section, etc.)", is_starred: false },
    { title: "Can't Help Falling in Love", composer: "Elvis Presley", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: false },
    { title: "Chasing Cars", composer: "Snow Patrol", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, guitar)", is_starred: false },
    { title: "Here Comes the Sun", composer: "The Beatles", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, guitar)", is_starred: false },
    { title: "In My Life", composer: "The Beatles", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, guitar)", is_starred: false },
    { title: "Just the Way You Are", composer: "Bruno Mars", category: "Pre-approved Secular", instrumentation: "piano (inst. cover)", is_starred: false },
    { title: "Love Me Tender", composer: "Elvis Presley", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, guitar)", is_starred: false },
    { title: "Lucky", composer: "Jason Mraz / Colbie Caillat", category: "Pre-approved Secular", instrumentation: "piano (opt. two singers, guitar)", is_starred: false },
    { title: "Make You Feel My Love", composer: "Adele", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, guitar)", is_starred: false },
    { title: "Married Life (from Up)", composer: null, category: "Pre-approved Secular", instrumentation: "piano", is_starred: false },
    { title: "Moon River", composer: "Mancini", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: false },
    { title: "Perfect", composer: "Ed Sheeran", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: false },
    { title: "River Flows in You", composer: "Yiruma", category: "Pre-approved Secular", instrumentation: "piano", is_starred: false },
    { title: "Sea of Love", composer: null, category: "Pre-approved Secular", instrumentation: "piano (opt. singer, guitar)", is_starred: false },
    { title: "Yellow", composer: "Coldplay", category: "Pre-approved Secular", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: false },
  ],
};

// ─── STEP 2: PROCESSIONS ────────────────────────────────────────────────────
const step2: StepDef = {
  step_number: 2,
  step_label: "Processions",
  songs: [
    // Classical Instrumentals
    { title: "Air On The G String (from Orchestral Suite No.3)", composer: "Bach", category: "Classical Instrumentals", instrumentation: "piano (opt. cello)", is_starred: false },
    { title: "Bridal Chorus (aka Here Comes the Bride)", composer: "Wagner", category: "Classical Instrumentals", instrumentation: "piano or organ", is_starred: true },
    { title: "Canon in D", composer: "Johann Pachelbel", category: "Classical Instrumentals", instrumentation: "piano or organ (opt. violin, cello, guitar, flute, trumpet, etc.)", is_starred: true },
    { title: "Hornpipe from Water Music", composer: "Handel", category: "Classical Instrumentals", instrumentation: "piano or organ", is_starred: false },
    { title: "Jesu, Joy of Man's Desiring", composer: "Johann Sebastian Bach", category: "Classical Instrumentals", instrumentation: "piano or organ", is_starred: false },
    { title: "Trumpet Tune", composer: "Henry Purcell", category: "Classical Instrumentals", instrumentation: "organ and trumpet", is_starred: false },
    { title: "Trumpet Voluntary", composer: "Jeremiah Clark", category: "Classical Instrumentals", instrumentation: "piano/organ and trumpet", is_starred: false },
    { title: "Waltz (from Sleeping Beauty Act 1)", composer: "Tchaikovsky", category: "Classical Instrumentals", instrumentation: "piano (opt. violin, cello, etc.)", is_starred: false },
    // Contemporary Instrumentals
    { title: "A Dream is a Wish Your Heart Makes (from Cinderella)", composer: null, category: "Contemporary Instrumentals", instrumentation: "piano (opt. singer)", is_starred: false },
    { title: "A Thousand Years", composer: "Christina Perri", category: "Contemporary Instrumentals", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: true },
    { title: "All of Me", composer: "John Legend", category: "Contemporary Instrumentals", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: false },
    { title: "Can't Help Falling in Love", composer: "Elvis Presley", category: "Contemporary Instrumentals", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: true },
    { title: "Here Comes the Sun", composer: "The Beatles", category: "Contemporary Instrumentals", instrumentation: "piano (opt. singer, guitar)", is_starred: false },
    { title: "Just the Way You Are", composer: "Bruno Mars", category: "Contemporary Instrumentals", instrumentation: "piano (inst. cover)", is_starred: false },
    { title: "Make You Feel My Love", composer: "Adele", category: "Contemporary Instrumentals", instrumentation: "piano (opt. singer, guitar)", is_starred: false },
    { title: "Married Life (from Up)", composer: null, category: "Contemporary Instrumentals", instrumentation: "piano", is_starred: false },
    { title: "Perfect", composer: "Ed Sheeran", category: "Contemporary Instrumentals", instrumentation: "piano (opt. singer, violin, cello, guitar, etc.)", is_starred: false },
    // Catholic Classics
    { title: "For the Beauty of the Earth", composer: "DIX", category: "Catholic Classics", instrumentation: "choir version", is_starred: false },
    { title: "Love Divine, All Love Excelling", composer: null, category: "Catholic Classics", instrumentation: "choir version", is_starred: false },
    { title: "Morning Has Broken", composer: null, category: "Catholic Classics", instrumentation: "choir version", is_starred: false },
    { title: "O God Beyond All Praising", composer: "Gustav Holst / Michael Perry", category: "Catholic Classics", is_starred: false },
  ],
};

// ─── STEP 3: RESPONSORIAL PSALM ─────────────────────────────────────────────
const step3: StepDef = {
  step_number: 3,
  step_label: "Responsorial Psalm",
  songs: [
    // C1 - Psalm 33
    { title: "The Earth Is Full of the Goodness of the Lord", composer: "Alonso", category: "Traditional", together_for_life_code: "C1", is_starred: false, notes: "Psalm 33" },
    { title: "The Earth Is Full of the Goodness of the Lord", composer: "Catherine", category: "Contemporary", together_for_life_code: "C1", is_starred: false, notes: "Psalm 33" },
    { title: "The Goodness of the Lord", composer: "Bolduc", category: "Contemporary", together_for_life_code: "C1", is_starred: false, notes: "Psalm 33" },
    // C2a - Psalm 34 (I will bless the Lord)
    { title: "I Will Bless the Lord at All Times", composer: "Kel", category: "Traditional", together_for_life_code: "C2", is_starred: false, notes: "Psalm 34, with chanted verses" },
    // C2b - Psalm 34 (Taste and see)
    { title: "Taste and See the Goodness of the Lord", composer: "Hurd", category: "Traditional", together_for_life_code: "C2", is_starred: false, notes: "Psalm 34" },
    { title: "Taste and See the Goodness of the Lord", composer: "Kel", category: "Traditional", together_for_life_code: "C2", is_starred: false, notes: "Psalm 34, with chanted verses" },
    { title: "Taste and See the Goodness of God", composer: "Hurd", category: "Traditional", together_for_life_code: "C2", is_starred: false, notes: "Psalm 34. Well-known Catholic standard, light gospel groove." },
    { title: "O Taste and See", composer: "Haugen", category: "Contemporary", together_for_life_code: "C2", is_starred: false, notes: "Psalm 34. More contemporary, great with a band." },
    // C3a - Psalm 103 (The Lord is kind and merciful)
    { title: "The Lord Is Kind and Merciful", composer: "Cotter", category: "Traditional", together_for_life_code: "C3", is_starred: false, notes: "Psalm 103" },
    { title: "The Lord Is Kind and Merciful", composer: "Colson", category: "Contemporary", together_for_life_code: "C3", is_starred: true, notes: "Psalm 103. Very popular choice." },
    // C5a - Psalm 128 (Blessed are those who fear the Lord)
    { title: "O Blessed Are Those", composer: "Inwood", category: "Traditional", together_for_life_code: "C5", is_starred: false, notes: "Psalm 128" },
    { title: "Blessed Are Those Who Fear the Lord", composer: "Alonso", category: "Traditional", together_for_life_code: "C5", is_starred: false, notes: "Psalm 128" },
    { title: "Blessed Are Those Who Fear the Lord", composer: "Angrisano", category: "Contemporary", together_for_life_code: "C5", is_starred: false, notes: "Psalm 128" },
    // C6 - Psalm 145
    { title: "How Good is the Lord to All", composer: "Huval", category: "Contemporary", together_for_life_code: "C6", is_starred: true, notes: "Psalm 145. New Setting." },
    // C7 - Psalm 148
    { title: "Let All Praise the Name of the Lord", composer: "Modlin", category: "Traditional", together_for_life_code: "C7", is_starred: false, notes: "Psalm 148" },
    // Additional - Psalm 63 (Ordinary Time)
    { title: "My Soul Is Thirsting for You, O Lord My God", composer: "Joncas", category: "Traditional", is_starred: false, notes: "Psalm 63. Season of Ordinary Time option." },
    { title: "My Soul Is Thirsting", composer: "Angrisano", category: "Contemporary", is_starred: true, notes: "Psalm 63. Community favorite. Season of Ordinary Time option." },
  ],
};

// ─── STEP 4: GOSPEL ACCLAMATION ─────────────────────────────────────────────
const step4: StepDef = {
  step_number: 4,
  step_label: "Gospel Acclamation",
  songs: [
    // Traditional
    { title: "Celtic Alleluia", composer: null, category: "Traditional", is_starred: false },
    { title: "Easter Alleluia", composer: null, category: "Traditional", is_starred: false },
    { title: "Halle Halle", composer: "Haugen", category: "Traditional", is_starred: false },
    { title: "Mass of Joy and Peace", composer: "Alonso", category: "Traditional", is_starred: false },
    { title: "Santa Clara Mass", composer: "Hurd", category: "Traditional", is_starred: false },
    // Contemporary
    { title: "Hallelujah", composer: "Cohen", category: "Contemporary", is_starred: false },
    { title: "Misa del Mundo", composer: "Manbusan", category: "Contemporary", is_starred: false },
    { title: "Mass of a Joyful Heart", composer: "Angrisano", category: "Contemporary", is_starred: false },
    { title: "Mass of Glory", composer: "Canedo/Hurd/MacAller", category: "Contemporary", is_starred: false },
    { title: "Mass of Restoration", composer: "Blakesley", category: "Contemporary", is_starred: false },
    { title: "Mass of Renewal", composer: "Stephan", category: "Contemporary", is_starred: false },
    { title: "Mass of St. Mary Magdalene", composer: "Hart", category: "Contemporary", is_starred: false },
    // Lenten Traditional
    { title: "Mass of Christ the Savior (Lenten)", composer: "Schutte", category: "Lenten", is_starred: false },
    { title: "Mass of Joy and Peace (Lenten)", composer: "Alonso", category: "Lenten", is_starred: false },
    { title: "Mass of Christ Light of Nations (Lenten)", composer: "Alonso", category: "Lenten", is_starred: false },
    { title: "Mass of Spirit and Grace (Lenten)", composer: "Manalo", category: "Lenten", is_starred: false },
    { title: "Santa Clara Mass (Lenten)", composer: "Hurd", category: "Lenten", is_starred: false },
    // Lenten Contemporary
    { title: "Mass of a Joyful Heart (Lenten)", composer: "Angrisano", category: "Lenten", is_starred: false },
    { title: "Mass of Glory (Lenten)", composer: "Canedo/Hurd/MacAller", category: "Lenten", is_starred: false },
    { title: "Mass of Renewal (Lenten)", composer: "Stephan", category: "Lenten", is_starred: false },
    { title: "Mass of St. Mary Magdalene (Lenten)", composer: "Hart", category: "Lenten", is_starred: false },
  ],
};

// ─── STEP 5: GIFTS/UNITY CANDLE ─────────────────────────────────────────────
const step5: StepDef = {
  step_number: 5,
  step_label: "Preparation of the Gifts",
  songs: [
    // Classical Instrumentals
    { title: "Air On The G String (from Orchestral Suite No.3)", composer: "Bach", category: "Classical", instrumentation: "piano (opt. cello or violin)", is_starred: false },
    { title: "Jesu, Joy of Man's Desiring", composer: "Johann Sebastian Bach", category: "Classical", instrumentation: "piano (opt. cello or violin)", is_starred: false },
    { title: "Nocturne In E flat, Op.9 No.2", composer: "Chopin", category: "Classical", instrumentation: "piano", is_starred: false },
    { title: "Sheep May Safely Graze", composer: "Johann Sebastian Bach", category: "Classical", instrumentation: "piano (opt. cello or violin)", is_starred: false },
    // Contemporary Christian
    { title: "Breathe", composer: "Hillsong", category: "Contemporary Christian", is_starred: false },
    { title: "Love Never Fails", composer: "Brandon Heath", category: "Contemporary Christian", is_starred: true, notes: "This piece can also be sung by a female cantor." },
    { title: "Our God is Love", composer: "Angotti", category: "Contemporary Christian", is_starred: false, notes: "A sung duet." },
    { title: "Set Me as a Seal", composer: "Maher", category: "Contemporary Christian", is_starred: false, notes: "Can be a solo or duet." },
    // Catholic Classics
    { title: "As We Gather At Your Table", composer: "Arr. Bonilla", category: "Catholic Classics", is_starred: false },
    { title: "How Great Thou Art", composer: "Stuart K. Hine", category: "Catholic Classics", is_starred: false },
    { title: "Prayer of St. Francis", composer: "Sebastian Temple", category: "Catholic Classics", is_starred: false },
    { title: "The Servant Song", composer: "Richard Gillard", category: "Catholic Classics", is_starred: false },
  ],
};

// ─── STEP 6: MASS SETTING ───────────────────────────────────────────────────
const step6: StepDef = {
  step_number: 6,
  step_label: "Mass Setting",
  songs: [
    // Traditional
    { title: "Mass of Christ Our Savior", composer: "Dan Schutte", category: "Traditional", is_starred: false, notes: "Holy, When We Eat This Bread, Amen, Lamb of God" },
    { title: "Mass of Creation", composer: "Marty Haugen", category: "Traditional", is_starred: true, notes: "Holy, When We Eat This Bread, Amen, Lamb of God" },
    { title: "Mass of Joy and Peace", composer: "Tony Alonso", category: "Traditional", is_starred: true, notes: "Holy, Save Us Savior, Amen, Lamb of God" },
    // Contemporary
    { title: "Mass for the Healing of the World", composer: "Trevor Thomson", category: "Contemporary", is_starred: true, notes: "Requires more than 1 singer. Holy, When We Eat This Bread, Amen, Lamb of God" },
    { title: "Mass of Glory", composer: "Bob Hurd", category: "Contemporary", is_starred: false, notes: "Holy, We Proclaim Your Death, Amen, Lamb of God" },
    { title: "Mass of Restoration", composer: "Joshua Blakesley", category: "Contemporary", is_starred: false, notes: "Holy, Save Us Savior, Amen, Lamb of God" },
    // Bilingual
    { title: "Misa del Pueblo Inmigrante", composer: "Bob Hurd", category: "Bilingual", is_starred: false, notes: "Holy/Santo, When We Eat This Bread/Cada Vez que Comemos, Amen/Amén, Lamb of God/Cordero de Dios" },
    { title: "Misa Melodica", composer: "Alejandro Mejia", category: "Bilingual", is_starred: false, notes: "Spanish. Santo, Anunciamos Tu Muerte, Amén, Cordero de Dios" },
    // Lord's Prayer
    { title: "The Lord's Prayer (chant)", composer: "CCWatershed", category: "Traditional", is_starred: false, subcategory: "Lord's Prayer" },
    { title: "Echo Our Father", composer: "Jerome Andrews, Arr. by Houze", category: "Traditional", is_starred: false, subcategory: "Lord's Prayer" },
    // Optional Lamb of God
    { title: "Mass of the Holy Cross - Lamb of God", composer: null, category: "Traditional", is_starred: false, subcategory: "Optional Lamb of God" },
    { title: "Mass of St Timothy - Lamb of God", composer: null, category: "Traditional", is_starred: false, subcategory: "Optional Lamb of God" },
  ],
};

// ─── STEP 7: COMMUNION SONGS ────────────────────────────────────────────────
const step7: StepDef = {
  step_number: 7,
  step_label: "Communion Song",
  songs: [
    // Traditional Catholic Songs
    { title: "A Nuptial Blessing", composer: "Michael Joncas", category: "Traditional Catholic", is_starred: true },
    { title: "Amazing Grace", composer: "Spiritual", category: "Traditional Catholic", is_starred: false },
    { title: "As the Dear Longs", composer: "Bob Hurd", category: "Traditional Catholic", is_starred: false },
    { title: "Bread for the World", composer: "Bernadette Farrell", category: "Traditional Catholic", is_starred: false },
    { title: "Christ Be Our Light", composer: "Bernadette Farrell", category: "Traditional Catholic", is_starred: false },
    { title: "Gift of Finest Wheat", composer: "Omer Westendorf / Robert E. Kreutz", category: "Traditional Catholic", is_starred: false },
    { title: "I Am the Bread of Life", composer: "Suzanne Toolan", category: "Traditional Catholic", is_starred: false },
    { title: "In Perfect Charity", composer: "Randall DeBruyn", category: "Traditional Catholic", is_starred: false },
    { title: "Here I Am Lord", composer: "Dan Schutte", category: "Traditional Catholic", is_starred: false },
    { title: "Prayer of St. Francis", composer: "Sebastian Temple", category: "Traditional Catholic", is_starred: false },
    { title: "On Eagle's Wings", composer: "Michael Joncas", category: "Traditional Catholic", is_starred: false },
    { title: "The King of Love My Shepherd Is", composer: "Henry W. Baker", category: "Traditional Catholic", is_starred: false },
    { title: "The Servant Song", composer: "Richard Gillard", category: "Traditional Catholic", is_starred: false },
    { title: "Ubi Caritas", composer: "Bob Hurd", category: "Traditional Catholic", is_starred: false },
    { title: "Where Love is Found", composer: "Dan Schutte", category: "Traditional Catholic", is_starred: true },
    // Traditional Catholic Songs (Reimagined)
    { title: "Abba, Father", composer: "Landry", category: "Traditional Reimagined", is_starred: false },
    { title: "All Creatures Of Our God And King", composer: null, category: "Traditional Reimagined", is_starred: false },
    { title: "As We Gather at Your Table", composer: null, category: "Traditional Reimagined", is_starred: false, notes: "Can be played traditionally or in a contemporary style." },
    { title: "Be Thou My Vision", composer: "Audrey Assad", category: "Traditional Reimagined", is_starred: false },
    { title: "Come to the Feast / Ven al Banquete", composer: "Hurd", category: "Traditional Reimagined", is_starred: false, notes: "Bilingual" },
    { title: "Come to the Water", composer: "Foley", category: "Traditional Reimagined", is_starred: false },
    { title: "For the Beauty of the Earth", composer: null, category: "Traditional Reimagined", is_starred: false },
    { title: "Give Me Jesus", composer: "Spiritual", category: "Traditional Reimagined", is_starred: false },
    { title: "Hosea", composer: "Norbet", category: "Traditional Reimagined", is_starred: false },
    { title: "How Great Thou Art", composer: "Arr. by Chris Rice", category: "Traditional Reimagined", is_starred: false },
    { title: "In Every Age", composer: "Janet Whitaker", category: "Traditional Reimagined", is_starred: false },
    { title: "Jesus, the Lord", composer: "Roc O'Connor", category: "Traditional Reimagined", is_starred: false },
    { title: "Love Divine, All Loves Excelling", composer: null, category: "Traditional Reimagined", is_starred: false },
    { title: "Seed, Scattered and Sown", composer: "Feiten", category: "Traditional Reimagined", is_starred: false },
    { title: "We Walk By Faith", composer: "Haugen", category: "Traditional Reimagined", is_starred: false },
    // Contemporary Christian Songs
    { title: "Better", composer: "Barnett", category: "Contemporary Christian", is_starred: false },
    { title: "Build My Life", composer: "Barnett", category: "Contemporary Christian", is_starred: false },
    { title: "Go into the World", composer: "Tom Booth", category: "Contemporary Christian", is_starred: false, notes: "Slight Gospel Feel" },
    { title: "Here I Am", composer: "Tom Booth", category: "Contemporary Christian", is_starred: false },
    { title: "Hungry", composer: "Kathryn Scott", category: "Contemporary Christian", is_starred: false },
    { title: "I Am Yours", composer: "Trevor Thomson", category: "Contemporary Christian", is_starred: true },
    { title: "King of Love", composer: "I Am They", category: "Contemporary Christian", is_starred: false },
    { title: "O Come to the Altar", composer: "Hillsong", category: "Contemporary Christian", is_starred: false },
    { title: "Receive", composer: "Assad", category: "Contemporary Christian", is_starred: false },
    { title: "Remembrance", composer: "Davenport/Hastings", category: "Contemporary Christian", is_starred: false },
    { title: "Table of Life", composer: "Steve Angrisano", category: "Contemporary Christian", is_starred: false },
    { title: "Taste and See", composer: "Steve Angrisano", category: "Contemporary Christian", is_starred: true },
    { title: "The Body of Christ", composer: "Sarah Hart", category: "Contemporary Christian", is_starred: false },
    { title: "The Table", composer: "Tomlin", category: "Contemporary Christian", is_starred: false },
    { title: "You Are My King (Amazing Love)", composer: "Foote", category: "Contemporary Christian", is_starred: false },
  ],
};

// ─── STEP 8: MEDITATION (OPTIONAL) ──────────────────────────────────────────
const step8: StepDef = {
  step_number: 8,
  step_label: "Meditation",
  songs: [
    // Female Cantor
    { title: "I Give You My Heart", composer: "Morgan", category: "Female Cantor", is_starred: false },
    { title: "Love Never Fails", composer: "Brandon Heath", category: "Female Cantor", is_starred: true, notes: "Can also be sung by either male or female cantor." },
    { title: "Reckless Love", composer: "Culver/Asbury", category: "Female Cantor", is_starred: false, notes: "Can be sung by either male or female cantor." },
    // Male Cantor
    { title: "I Will Be Here", composer: "Steven Curtis Chapman", category: "Male Cantor", is_starred: false },
    { title: "Love Never Fails", composer: "Brandon Heath", category: "Male Cantor", is_starred: true, notes: "Can also be sung by either male or female cantor." },
    { title: "Reckless Love", composer: "Culver/Asbury", category: "Male Cantor", is_starred: false, notes: "Can be sung by either male or female cantor." },
    { title: "You Raise Me Up", composer: "Josh Groban", category: "Male Cantor", is_starred: false },
    // Duets
    { title: "Set Me As A Seal (Duet)", composer: "Matt Maher", category: "Duets", is_starred: true },
    { title: "When God Made You (Duet)", composer: "New Song", category: "Duets", is_starred: false },
    { title: "The Prayer (Duet)", composer: "Andrea Bocelli / Celine Dion", category: "Duets", is_starred: true, notes: "Not every cantor sings this. Please inquire if you want this song." },
    { title: "Whatever May Come (Duet)", composer: "Jeremy and Adrienne Camp", category: "Duets", is_starred: false },
  ],
};

// ─── STEP 9: FLOWERS TO MARY (OPTIONAL) ─────────────────────────────────────
const step9: StepDef = {
  step_number: 9,
  step_label: "Flowers to Mary",
  songs: [
    // Classical
    { title: "Ave Maria", composer: "Charles Gounod", category: "Classical Ave Maria", is_starred: false, notes: "Less known, but also a very beautiful classical composition." },
    { title: "Ave Maria", composer: "Franz Schubert", category: "Classical Ave Maria", is_starred: true, notes: "This is the composition most people are familiar with." },
    { title: "Salve, Regina", composer: "Contractus, Cantualis, DeBruyn, and Ford", category: "Classical Ave Maria", is_starred: false, notes: "Chant" },
    // Catholic Classics
    { title: "Hail Mary: Gentle Woman", composer: "Carey Landry", category: "Catholic Classics", is_starred: true, notes: "Well known song for Catholics, great for less classical singers." },
    { title: "Holy Is His Name", composer: "John Michael Talbot", category: "Catholic Classics", is_starred: false },
    { title: "Immaculate Mary", composer: "Gibson, Tozer, DeBruyn, and Cummings", category: "Catholic Classics", is_starred: false },
    // Choral (Requires a choir)
    { title: "Ave Maria (Angelus Domini)", composer: "Franz Biebl", category: "Choral", is_starred: false, notes: "Incredible piece, but requires at least 8 singers." },
    { title: "Ave Maria", composer: "Giulio Caccini, Arr. by Patrick M. Liebergen", category: "Choral", is_starred: false, notes: "Requires at least 4 singers." },
    { title: "On This Day, O Beautiful Mother", composer: "Louis Lambillotte SJ", category: "Choral", is_starred: false, notes: "Requires at least 4 singers." },
  ],
};

// ─── STEP 10: RECESSIONAL ───────────────────────────────────────────────────
const step10: StepDef = {
  step_number: 10,
  step_label: "Recessional",
  songs: [
    // Classical Instrumentals
    { title: "Alla danza from Water Music (Hornpipe)", composer: "Handel", category: "Classical Instrumentals", instrumentation: "organ (opt. violin, cello, etc.)", is_starred: false },
    { title: "Hornpipe from Water Music", composer: "Handel", category: "Classical Instrumentals", instrumentation: "piano or organ", is_starred: false },
    { title: "Ode to Joy", composer: "Ludwig Van Beethoven", category: "Classical Instrumentals", instrumentation: "piano or organ (opt. violin, cello, etc.)", is_starred: false },
    { title: "Spring", composer: "Vivaldi", category: "Classical Instrumentals", instrumentation: "piano (opt. violin, cello, etc.)", is_starred: false },
    { title: "Trumpet Tune", composer: "Henry Purcell", category: "Classical Instrumentals", instrumentation: "organ and trumpet", is_starred: false },
    { title: "Trumpet Voluntary", composer: "Jeremiah Clark", category: "Classical Instrumentals", instrumentation: "piano/organ and trumpet", is_starred: false },
    { title: "Wedding March", composer: "Mendelssohn", category: "Classical Instrumentals", instrumentation: "piano/organ (opt. violin, cello, etc.)", is_starred: false },
    // Upbeat Secular
    { title: "Beautiful Day", composer: "U2", category: "Upbeat Secular", instrumentation: "piano (opt. singer, guitar, violin, cello, rhythm section, etc.)", is_starred: false },
    { title: "Best Day of My Life", composer: "American Authors", category: "Upbeat Secular", instrumentation: "piano (opt. singer, guitar, violin, cello, rhythm section, etc.)", is_starred: false },
    { title: "Lovely Day", composer: "Bill Withers", category: "Upbeat Secular", instrumentation: "piano & singer, recommend rhythm section", is_starred: false },
    { title: "Signed, Sealed, Delivered", composer: "Stevie Wonder", category: "Upbeat Secular", instrumentation: "piano & singer, recommend rhythm section", is_starred: false },
    { title: "This Will Be (An Everlasting Love)", composer: "Natalie Cole", category: "Upbeat Secular", instrumentation: "piano & singer (opt. add'l singers, rhythm section)", is_starred: true },
    { title: "You Make My Dreams", composer: "Hall & Oates", category: "Upbeat Secular", instrumentation: "piano & singer, recommend rhythm section", is_starred: false },
    // Traditional Catholic Recessional Hymns
    { title: "Love Divine, All Love Excelling", composer: null, category: "Traditional Catholic Hymns", instrumentation: "choir version", is_starred: false },
    { title: "Joyful, Joyful We Adore Thee", composer: null, category: "Traditional Catholic Hymns", instrumentation: "choir version", is_starred: false },
    // Upbeat Contemporary Christian Songs
    { title: "O Happy Day", composer: "Arranged by Micah Jones", category: "Upbeat Contemporary Christian", instrumentation: "piano & singer (opt. add'l singers, rhythm section)", is_starred: false },
    { title: "Make the Love of God Known", composer: "Modlin Arr. by DL", category: "Upbeat Contemporary Christian", instrumentation: "piano & singer, recommend rhythm section", is_starred: false },
    { title: "This Is Amazing Grace", composer: "Phil Wickham", category: "Upbeat Contemporary Christian", is_starred: false, notes: "This song requires a band." },
  ],
};

// ─── MAIN ───────────────────────────────────────────────────────────────────

const ALL_STEPS: StepDef[] = [step1, step2, step3, step4, step5, step6, step7, step8, step9, step10];

async function main() {
  // Clear existing wedding songs
  console.log("Clearing existing wedding songs...");
  const { error: deleteError } = await supabase
    .from("sacramental_songs")
    .delete()
    .eq("liturgy_type", "wedding");

  if (deleteError) {
    console.error("Failed to clear:", deleteError.message);
    return;
  }

  let totalInserted = 0;

  for (const step of ALL_STEPS) {
    const rows = step.songs.map((song, i) => ({
      title: song.title,
      composer: song.composer,
      liturgy_type: "wedding" as const,
      step_number: step.step_number,
      step_label: step.step_label,
      category: song.category,
      subcategory: song.subcategory || null,
      instrumentation: song.instrumentation || null,
      is_starred: song.is_starred,
      is_bilingual: false,
      language: "en",
      together_for_life_code: song.together_for_life_code || null,
      psalm_number: null,
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

  console.log(`\nDone! Inserted ${totalInserted} wedding songs total.`);
}

main().catch(console.error);
