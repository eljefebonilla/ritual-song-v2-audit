/**
 * Funeral Music Guide — 10-step wizard definition.
 * Maps to the Order of Christian Funerals (OCF) liturgical structure.
 * Each step has categories, pastoral context, and optional psalm references.
 */

export interface FuneralStep {
  number: number;
  title: string;
  subtitle: string;
  catechesis: string;
  categories: string[];
  allowsMultiple?: boolean;
  isOptional?: boolean;
  selectCount?: number;
}

export const FUNERAL_STEPS: FuneralStep[] = [
  {
    number: 1,
    title: "Prelude",
    subtitle: "Music before the service begins",
    catechesis:
      "The optional prelude occurs before the service begins, offering a moment of reflection and solace as attendees gather. It could be a comforting piece or a favorite song of the dearly departed, serving as a gentle introduction to the ceremony. Its role is to help create a calm and supportive atmosphere, inviting shared remembrance as we prepare to honor your loved one.",
    categories: ["Traditional", "Contemporary"],
    isOptional: true,
  },
  {
    number: 2,
    title: "Opening Song",
    subtitle: "The song that begins the liturgy",
    catechesis:
      "The Opening Song begins the liturgy. It unites us all in a spirit of worship and reflection. Serving as a musical welcome, it gently gathers us together, creating a sense of shared community and remembrance.",
    categories: ["Traditional", "Contemporary", "Spanish"],
  },
  {
    number: 3,
    title: "Responsorial Psalm",
    subtitle: "Our sung response to the Word of God",
    catechesis:
      "The Responsorial Psalm is an essential part of the Mass. It serves as our response to the Word of God, which we hear in the first reading. Through the Psalm, we collectively express our thoughts and prayers in a comforting and consoling manner. When selecting the Psalm, consider its connection to the first reading and how it offers solace and hope during this time of remembrance and reflection. The assembly joins in song, responding to the cantor.",
    categories: ["Traditional", "Contemporary"],
  },
  {
    number: 4,
    title: "Gospel Acclamation",
    subtitle: "The acclamation before the Gospel",
    catechesis:
      "After the second reading, the congregation stands as the Gospel acclamation is sung. During all liturgical seasons except Lent, the Gospel acclamation is \"Alleluia,\" a Hebrew word meaning \"Praise God.\" This acclamation prepares our hearts to receive the Word of God in the Gospel. During Lent, the Alleluia is replaced with acclamations such as \"Praise to you, Lord Jesus Christ, King of endless glory.\"",
    categories: ["Traditional", "Contemporary", "Lenten"],
  },
  {
    number: 5,
    title: "Gifts Song",
    subtitle: "Music during the preparation of the gifts",
    catechesis:
      "The preparation of the gifts is a pivotal point in the Mass, serving as a transition from hearing the Word of God to preparing for Communion. During this time, the gifts of bread and wine are presented and the altar is prepared. The Gifts Song enriches this solemn moment, enhancing the spiritual atmosphere during the preparation.",
    categories: ["Traditional", "Contemporary"],
  },
  {
    number: 6,
    title: "Mass Setting",
    subtitle: "Holy, Holy / Memorial Acclamation / Amen / Lamb of God",
    catechesis:
      "Eucharistic Acclamations (Mass Settings) are special parts of the Catholic Mass during the Eucharistic celebration. They are the moments when everyone responds together to the prayer led by the priest. We have included both traditional and contemporary options to match the tone of the remembrance service. Please select the ones that resonate most with you and that you feel would honor the memory of your loved one.",
    categories: ["Traditional", "Contemporary"],
  },
  {
    number: 7,
    title: "Communion Songs",
    subtitle: "Music during the reception of communion",
    catechesis:
      "As friends and family come forward to receive communion or a blessing, we sing together to accompany this solemn and reflective part of the service. The music should inspire reflection and respect for this shared moment. We have provided both contemporary and traditional options for the funeral Mass. A second song will only be sung if time allows.",
    categories: ["Traditional", "Contemporary"],
    selectCount: 2,
    allowsMultiple: true,
  },
  {
    number: 8,
    title: "Meditation",
    subtitle: "A reflective song after communion",
    catechesis:
      "The addition of a post-Communion meditation can be a meaningful element to the Mass. This piece offers a moment for attendees to further reflect on the life and legacy of the dearly departed. It is a time for quiet introspection and connection. It can be a song that everyone sings together, or one that everyone participates in interiorly as their spirits are lifted.",
    categories: ["Traditional", "Contemporary"],
    isOptional: true,
  },
  {
    number: 9,
    title: "Song of Farewell",
    subtitle: "The Final Commendation",
    catechesis:
      "After a short prayer, the coffin may be sprinkled with holy water and honored with incense. During this Final Commendation, an appropriate hymn may be sung. This piece echoes themes of eternal peace and hope, providing comfort as we entrust the soul of the departed to God's merciful care.",
    categories: ["Traditional", "Contemporary", "Bilingual"],
    isOptional: true,
  },
  {
    number: 10,
    title: "Closing Song",
    subtitle: "The procession to the place of committal",
    catechesis:
      "At the end of Mass there is a Procession to the Place of Committal. After the concluding prayer, an appropriate hymn is sung while the coffin is being taken away. This hymn accompanies our final moments together, offering a musical expression of shared hope and comfort.",
    categories: ["Traditional", "Contemporary"],
  },
];

/**
 * Funeral psalm options with refrains for display in the wizard.
 */
export const FUNERAL_PSALMS: {
  psalm: string;
  psalmNumber: number;
  verses: string;
  refrain: string;
}[] = [
  { psalm: "Psalm 23", psalmNumber: 23, verses: "1-3, 4, 5, 6", refrain: "The Lord is my shepherd; there is nothing I shall want." },
  { psalm: "Psalm 25", psalmNumber: 25, verses: "6 and 7b, 17-18, 20-21", refrain: "To you, O Lord, I lift my soul." },
  { psalm: "Psalm 27", psalmNumber: 27, verses: "1, 4, 7 and 8b and 9a, 13-14", refrain: "The Lord is my light and my salvation." },
  { psalm: "Psalm 42", psalmNumber: 42, verses: "2, 3, 5cdef; 43:3, 4, 5", refrain: "My soul is thirsting for the living God." },
  { psalm: "Psalm 63", psalmNumber: 63, verses: "2, 3-4, 5-6, 8-9", refrain: "My soul is thirsting for you, O Lord my God." },
  { psalm: "Psalm 103", psalmNumber: 103, verses: "8 and 10, 13-14, 15-16, 17-18", refrain: "The Lord is kind and merciful." },
  { psalm: "Psalm 116", psalmNumber: 116, verses: "5, 6, 10-11, 15-16ac", refrain: "I will walk in the presence of the Lord in the land of the living." },
  { psalm: "Psalm 122", psalmNumber: 122, verses: "1-2, 4-5, 6-7, 8-9", refrain: "I rejoiced when I heard them say: let us go to the house of the Lord." },
  { psalm: "Psalm 130", psalmNumber: 130, verses: "1-2, 3-4, 5-6ab, 6c-7, 8", refrain: "Out of the depths, I cry to you, Lord." },
  { psalm: "Psalm 143", psalmNumber: 143, verses: "1-2, 5-6, 7ab and 8ab, 10", refrain: "O Lord, hear my prayer." },
];
