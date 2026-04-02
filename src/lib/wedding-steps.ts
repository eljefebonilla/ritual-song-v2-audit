/**
 * Wedding Music Guide — 10-step wizard definition.
 * Maps to Together for Life liturgical structure.
 * Each step has categories, catechetical context, and optional TFL codes.
 */

export interface WeddingStep {
  number: number;
  title: string;
  subtitle: string;
  catechesis: string;
  categories: string[];
  tflCodes?: string[];
  allowsMultiple?: boolean;
  isOptional?: boolean;
}

export const WEDDING_STEPS: WeddingStep[] = [
  {
    number: 1,
    title: "Preludes",
    subtitle: "Music before the ceremony begins",
    catechesis:
      "As guests arrive and settle in, the prelude sets the tone for the sacred celebration ahead. These pieces create an atmosphere of reverence and anticipation. Typically 15-20 minutes of music before the procession begins.",
    categories: ["Classical", "Contemporary Christian", "Pre-approved Secular"],
    allowsMultiple: true,
    isOptional: true,
  },
  {
    number: 2,
    title: "Processions",
    subtitle: "Bridal party entrance and bride's entrance",
    catechesis:
      "The procession marks the beginning of the liturgy. The bridal party entrance is typically an instrumental piece. The bride's entrance is a separate, more prominent selection. Both should convey dignity and joy.",
    categories: [
      "Classical Instrumentals",
      "Contemporary Instrumentals",
      "Catholic Classics",
    ],
    allowsMultiple: true,
  },
  {
    number: 3,
    title: "Responsorial Psalm",
    subtitle: "The sung response to the First Reading",
    catechesis:
      'The Responsorial Psalm is the assembly\'s prayerful response to the First Reading. In the "Together for Life" guide, psalms are coded C1 through C7. Your cantor will sing the verses while the assembly joins in the refrain.',
    categories: ["Traditional", "Contemporary"],
    tflCodes: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"],
  },
  {
    number: 4,
    title: "Gospel Acclamation",
    subtitle: "The joyful verse before the Gospel",
    catechesis:
      "The Gospel Acclamation is a joyful \"Alleluia\" (or during Lent, a Lenten acclamation) that prepares the assembly to hear the Gospel. It includes a verse that connects to the Gospel reading you've chosen.",
    categories: ["Traditional", "Lenten"],
  },
  {
    number: 5,
    title: "Preparation of the Gifts",
    subtitle: "Music during the offertory",
    catechesis:
      "As the gifts of bread and wine are brought to the altar, this song accompanies the preparation. It's a reflective moment that speaks to the couple's offering of themselves to each other and to God.",
    categories: ["Classical", "Contemporary Christian"],
  },
  {
    number: 6,
    title: "Mass Setting",
    subtitle: "Holy, Holy / Memorial Acclamation / Amen / Lamb of God",
    catechesis:
      "The Mass Setting includes the sung prayers of the Eucharistic liturgy: the Holy Holy Holy (Sanctus), the Memorial Acclamation, the Great Amen, and the Lamb of God (Agnus Dei). These are typically sung as a unified set.",
    categories: ["Traditional", "Contemporary", "Bilingual"],
  },
  {
    number: 7,
    title: "Communion Song",
    subtitle: "Music during the reception of communion",
    catechesis:
      "The Communion Song accompanies the assembly as they receive the Eucharist. It should express unity, love, and the sacred nature of this sacramental moment. The cantor leads; the assembly joins the refrain.",
    categories: [
      "Traditional Catholic",
      "Traditional Reimagined",
      "Contemporary Christian",
    ],
  },
  {
    number: 8,
    title: "Meditation",
    subtitle: "A reflective song after communion",
    catechesis:
      "After communion, a moment of quiet reflection. This is often a solo piece performed by the cantor. It's one of the most personal musical choices in the ceremony.",
    categories: ["Female Cantor", "Male Cantor", "Duets"],
    isOptional: true,
  },
  {
    number: 9,
    title: "Flowers to Mary",
    subtitle: "The Marian devotion after communion",
    catechesis:
      "A beloved Catholic wedding tradition where the couple presents flowers to the Blessed Virgin Mary. The Ave Maria is the most common choice, but other Marian hymns are also appropriate.",
    categories: ["Classical Ave Maria", "Catholic Classics", "Choral"],
    isOptional: true,
  },
  {
    number: 10,
    title: "Recessional",
    subtitle: "The joyful exit",
    catechesis:
      "The recessional sends the newly married couple forth in joy. This is the most celebratory piece: triumphant, upbeat, and full of life. Instrumental pieces are most common.",
    categories: [
      "Classical Instrumentals",
      "Upbeat Secular",
      "Traditional Catholic Hymns",
      "Upbeat Contemporary Christian",
    ],
  },
];

/**
 * Together for Life psalm codes.
 * Maps C1-C7 to the psalm text, number, and available settings.
 */
export const TFL_PSALM_CODES: Record<
  string,
  { code: string; psalm: string; psalmNumber: number; refrain: string }
> = {
  C1: {
    code: "C1",
    psalm: "Psalm 33",
    psalmNumber: 33,
    refrain: "The earth is full of the goodness of the Lord.",
  },
  C2: {
    code: "C2",
    psalm: "Psalm 34",
    psalmNumber: 34,
    refrain: "I will bless the Lord at all times.",
  },
  C3: {
    code: "C3",
    psalm: "Psalm 103",
    psalmNumber: 103,
    refrain: "The Lord is kind and merciful.",
  },
  C4: {
    code: "C4",
    psalm: "Psalm 112",
    psalmNumber: 112,
    refrain: "Blessed the man who greatly delights in the Lord's commands.",
  },
  C5: {
    code: "C5",
    psalm: "Psalm 128",
    psalmNumber: 128,
    refrain: "Blessed are those who fear the Lord.",
  },
  C6: {
    code: "C6",
    psalm: "Psalm 145",
    psalmNumber: 145,
    refrain: "The Lord is compassionate toward all his works.",
  },
  C7: {
    code: "C7",
    psalm: "Psalm 148",
    psalmNumber: 148,
    refrain: "Let all praise the name of the Lord.",
  },
};
