export interface Chapter {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  coverImage: string;
  questions: string[];
  followUpTemplates: string[];
}

export interface MemoryEntry {
  id: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  question: string;
  title: string;
  rawText: string;
  embellishedText: string;
  pullQuote?: string;
  date: string;
  epochYear?: string;
  location?: string;
  durationSeconds: number;
  photoBase64?: string;
  photoCaption?: string;
  audioDataUrl?: string;
  isExample?: boolean;
  isEmbellished?: boolean;
}

export const HERO_BOOK_IMAGE =
  '/src/assets/images/heirloom_memoir_book_1795026932507.jpg';

export const CHAPTERS: Chapter[] = [
  {
    id: 'enfance',
    number: 'Chapitre I',
    title: "Enfance & Écoles d'autrefois",
    subtitle: 'Les bancs en bois, l’encre violette et les chemins d’écolier',
    description:
      'Les premiers souvenirs de la maison familiale, la cour de récréation, les saisons de l’enfance et les visages protecteurs.',
    coverImage: '/src/assets/images/vintage_school_childhood_1795026930586.jpg',
    questions: [
      "Quelle était l'odeur ou la lumière de la maison où vous avez grandi lorsque vous vous réveilliez le matin ?",
      "Racontez votre trajet pour aller à l'école : avec qui marchiez-vous et que trouviez-vous en chemin ?",
      "Quel instituteur ou quelle institutrice vous a le plus marqué(e), et à quoi ressemblait votre salle de classe avec ses encriers ?",
      "Quel était votre jeu préféré dans la cour ou dans les champs lorsque l'école était finie ?",
      "Quelle petite bêtise d'enfance fait encore sourire votre mémoire aujourd'hui ?",
    ],
    followUpTemplates: [
      'Si vous fermez les yeux, quel bruit ou quelle voix entendiez-vous à cet instant précis ?',
      'Y avait-il un objet particulier dans cette pièce qui vous fascinait étant enfant ?',
      'Qui était la personne la plus tendre avec vous dans ces moments-là ?',
    ],
  },
  {
    id: 'recettes',
    number: 'Chapitre II',
    title: 'Recettes, Parfums & Tables de fête',
    subtitle: 'Les mijotés du dimanche, le pain chaud et les secrets de cuisine',
    description:
      'Les saveurs transmises de génération en génération, les grands repas de famille et les gestes culinaires qui réchauffent le cœur.',
    coverImage: '/src/assets/images/family_kitchen_recipe_1795026930292.jpg',
    questions: [
      'Quel plat du dimanche préparé par votre mère ou votre grand-mère embaumait toute la maison dès le matin ?',
      "Quel est le secret d'une recette de famille que vous aimeriez transmettre à vos petits-enfants pour qu'elle ne se perde jamais ?",
      'Comment se déroulaient les grandes tablées de Noël ou des moissons dans votre jeunesse ?',
      'Quel fruit du jardin ou quelle gourmandise simple avait pour vous le goût du bonheur pur ?',
      "Racontez le souvenir d'un repas partagé qui, même modeste, reste le meilleur festin de votre vie.",
    ],
    followUpTemplates: [
      'Quel ustensile ou quel plat de service utilisait-on spécialement pour cette occasion ?',
      'Quelle était la phrase ou le rituel qui marquait le début de ce repas en famille ?',
      'Quelle odeur précise vous ramène immédiatement dans cette cuisine ?',
    ],
  },
  {
    id: 'jeunesse',
    number: 'Chapitre III',
    title: 'Premiers Amours, Amis & Jeunesse',
    subtitle: 'Les bals de village, les promesses et l’élan des vingt ans',
    description:
      'Les amitiés indéfectibles, la musique qui faisait danser, le premier regard échangé et les rêves de jeunesse.',
    coverImage: '/src/assets/images/village_dance_youth_1795200987632.jpg',
    questions: [
      'Dans quelles circonstances avez-vous rencontré le grand amour de votre vie, et quel détail vous a immédiatement touché(e) ?',
      'À quoi ressemblaient les bals, les fêtes de village ou les sorties du samedi soir quand vous aviez vingt ans ?',
      'Quelle chanson ou quel air de musique fredonniez-vous avec vos amis les soirs d’été ?',
      'Qui était votre meilleur(e) ami(e) de jeunesse et quelle aventure avez-vous partagée ensemble ?',
      'Quel souvenir gardez-vous du jour de votre mariage ou de votre premier foyer ?',
    ],
    followUpTemplates: [
      'Comment étiez-vous habillé(e) ce jour-là, vous en souvenez-vous ?',
      'Qu’avez-vous ressenti au moment précis où vos regards se sont croisés ?',
      'Quelle anecdote imprévue a rendu cette journée encore plus inoubliable ?',
    ],
  },
  {
    id: 'metiers',
    number: 'Chapitre IV',
    title: 'Métiers, Voyages & Aventures',
    subtitle: 'Le premier salaire, la fierté de l’ouvrage et les horizons découverts',
    description:
      'Les défis relevés, l’apprentissage du métier, les voyages marquants et les grandes transformations du siècle.',
    coverImage: '/src/assets/images/craftsman_workshop_travel_1795200986585.jpg',
    questions: [
      "Quel a été votre tout premier travail, et qu'avez-vous acheté avec votre première paie ?",
      'De quelle réalisation ou de quel ouvrage accompli dans votre vie professionnelle êtes-vous le plus fier / la plus fière ?',
      'Quel voyage ou quelle découverte de la mer ou de la montagne vous a émerveillé(e) pour la première fois ?',
      'Quelle rencontre inattendue a changé le cours de votre parcours ou votre façon de voir le monde ?',
      "Comment avez-vous vécu l'arrivée des grandes inventions (la télévision, la première voiture familiale, le téléphone) dans votre foyer ?",
    ],
    followUpTemplates: [
      'Qui vous a appris les gestes essentiels à vos débuts ?',
      'Quel conseil donneriez-vous aujourd’hui au jeune homme ou à la jeune femme que vous étiez alors ?',
      'Quelle image précise de ce lieu reste gravée dans votre esprit ?',
    ],
  },
  {
    id: 'sagesse',
    number: 'Chapitre V',
    title: 'Sagesse & Messages pour les petits-enfants',
    subtitle: 'Les valeurs du cœur, la résilience et les lettres pour demain',
    description:
      'Ce que la vie vous a appris de plus précieux, vos vœux pour les générations futures et les mots qui traverseront le temps.',
    coverImage: '/src/assets/images/family_letters_wisdom_1795200986442.jpg',
    questions: [
      'Quelle est la plus belle leçon de courage ou de bonté que vos propres parents vous ont léguée ?',
      'Dans les moments difficiles de l’existence, qu’est-ce qui vous a toujours donné la force de garder espoir ?',
      'Quel a été votre premier sentiment la première fois que vous avez tenu vos enfants puis vos petits-enfants dans vos bras ?',
      'Si vous pouviez offrir un seul conseil de bonheur à vos arrière-petits-enfants pour leur vie entière, quel serait-il ?',
      'De quoi êtes-vous le plus reconnaissant(e) lorsque vous regardez le chemin parcouru par notre famille ?',
    ],
    followUpTemplates: [
      'Y a-t-il une devise ou une expression familiale que vous aimeriez leur voir garder ?',
      'Quel vœu secret formez-vous pour eux lorsqu’ils liront ces pages dans vingt ou trente ans ?',
      'Quel petit bonheur simple du quotidien leur conseillez-vous de savourer ?',
    ],
  },
];

export const DEFAULT_BOOK_PREFACE =
  "À nos enfants, petits-enfants et à ceux qui viendront après nous.\n\nCe livre a été recueilli à la voix, au fil des saisons, pour que les visages, les parfums de cuisine, les chemins d'école et les promesses de notre jeunesse ne s'effacent jamais. Puissent ces pages vous accompagner avec la même tendresse que celle qui nous a unis.";

export const EXAMPLE_MEMORIES: MemoryEntry[] = [
  {
    id: 'example-1',
    chapterId: 'enfance',
    chapterNumber: 'Chapitre I',
    chapterTitle: "Enfance & Écoles d'autrefois",
    question:
      'Quel instituteur ou quelle institutrice vous a le plus marqué(e), et à quoi ressemblait votre salle de classe avec ses encriers ?',
    title: "L'encre violette et le poêle de Monsieur Germain",
    rawText:
      "Ah je me souviens très bien de la classe de Monsieur Germain en 1954. Il y avait ce grand poêle en fonte au milieu de la pièce et quand on arrivait l'hiver avec nos galoches pleines de neige on posait nos moufles près du tuyau. Sur les pupitres en chêne il y avait les petits encriers en porcelaine blanche avec l'encre violette Sergent-Major. Si on appuyait trop fort sur la plume ça faisait un pâté mais Monsieur Germain nous montrait comment sécher la feuille avec le buvard rose sans jamais lever la voix.",
    embellishedText:
      "Je revois encore, comme si c'était hier, la salle de classe de Monsieur Germain à l'automne 1954. Au cœur de la pièce trônait un imposant poêle en fonte dont le ronflement sourd réchauffait nos matinées d'hiver. Dès notre arrivée, les joues rougies par le gel et nos galoches alourdies de neige, nous déposions nos moufles de laine tout près du conduit tiède avant de regagner nos bancs.\n\nNos pupitres en chêne massif, patinés par des générations d'écoliers, abritaient chacun un petit encrier de porcelaine blanche rempli de cette fameuse encre violette au parfum si particulier. Il fallait apprivoiser la plume Sergent-Major : la moindre maladresse laissait échapper une tache sur le cahier. Mais Monsieur Germain s'approchait alors à pas feutrés, posait sa main rassurante sur notre épaule et nous apprenait à presser délicatement le buvard rose, sans jamais élever la voix.",
    pullQuote:
      '« Nos pupitres en chêne massif abritaient chacun un petit encrier de porcelaine blanche rempli de cette fameuse encre violette au parfum si particulier. »',
    date: '14 Novembre 2026',
    epochYear: '1954',
    location: 'École communale du bourg',
    durationSeconds: 78,
    photoBase64: '/src/assets/images/vintage_school_childhood_1795026930586.jpg',
    photoCaption:
      'Pupitre d’écolier, encrier de porcelaine et cartable de cuir (Archives 1954)',
    isExample: true,
    isEmbellished: true,
  },
  {
    id: 'example-2',
    chapterId: 'recettes',
    chapterNumber: 'Chapitre II',
    chapterTitle: 'Recettes, Parfums & Tables de fête',
    question:
      "Quel est le secret d'une recette de famille que vous aimeriez transmettre à vos petits-enfants pour qu'elle ne se perde jamais ?",
    title: 'La bassine de cuivre et les pommes dorées d’octobre',
    rawText:
      "Pour la tarte aux pommes et la compotée de ma grand-mère Louise le vrai secret c'était de ne jamais être pressé. On cueillait les reinettes du verger juste après les premières pluies d'octobre. Elle sortait sa grande bassine en cuivre étamé et son vieux cahier taché de beurre. Elle ajoutait toujours une gousse de vanille fendue et une noisette de beurre demi-sel à la toute fin quand les pommes devenaient translucides. Toute la maison sentait le caramel et la cannelle pendant deux jours.",
    embellishedText:
      "Dans la cuisine de ma grand-mère Louise, le véritable secret des tartes d'automne tenait en une seule règle d'or : ne jamais brusquer le temps. Nous allions cueillir les reinettes au verger familial juste après les premières averses d'octobre, lorsque les fruits avaient concentré toute leur douceur acidulée.\n\nSur la grande table de bois, elle ouvrait son cahier de recettes manuscrit, aux pages tendrement jaunies par les étés, et sortait sa lourde bassine en cuivre. Le tour de main venait au dernier instant : lorsque les quartiers de pommes devenaient translucides et dorés, elle y glissait une gousse de vanille fendue et une généreuse noisette de beurre demi-sel. Pendant deux jours entiers, la maison tout entière respirait le caramel blond, la cannelle et la promesse du goûter.",
    pullQuote:
      "« Dans la cuisine de ma grand-mère Louise, le véritable secret des tartes d'automne tenait en une seule règle d'or : ne jamais brusquer le temps. »",
    date: '16 Novembre 2026',
    epochYear: '1962',
    location: 'Cuisine familiale & Verger de Louise',
    durationSeconds: 94,
    photoBase64: '/src/assets/images/family_kitchen_recipe_1795026930292.jpg',
    photoCaption:
      'Le carnet de recettes manuscrit et la bassine en cuivre des dimanches d’automne',
    isExample: true,
    isEmbellished: true,
  },
];

/**
 * Mode de secours 100% local : Nettoyage linguistique français, ponctuation,
 * structuration en paragraphes littéraires, extraction de l'année et génération d'un titre poétique.
 */
export function embellishLocally(
  rawText: string,
  question: string,
  chapterTitle: string
): {
  title: string;
  embellishedText: string;
  pullQuote: string;
  epochYear?: string;
} {
  let cleaned = rawText
    .replace(/\b(euh+|heu+|ben|bah|disons que|comment dire)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned) {
    cleaned = 'Un souvenir précieux partagé de vive voix.';
  }

  // Détection automatique d'une année mentionnée (ex: 1954, 1968)
  const yearMatch = cleaned.match(/\b(19\d{2}|20[0-2]\d)\b/);
  const detectedYear = yearMatch ? yearMatch[1] : undefined;

  // Découpage intelligent en phrases si la dictée vocale n'a pas mis de points
  const words = cleaned.split(' ');
  const sentences: string[] = [];
  let currentSentence: string[] = [];

  const connectors = new Set([
    'et',
    'alors',
    'puis',
    'ensuite',
    'mais',
    'quand',
    'lorsque',
    'cependant',
    'souvent',
    'parfois',
  ]);

  words.forEach((word, idx) => {
    currentSentence.push(word);
    const endsWithPunct = /[.!?]$/.test(word);
    const nextWord = words[idx + 1]?.toLowerCase();

    if (endsWithPunct) {
      sentences.push(currentSentence.join(' '));
      currentSentence = [];
    } else if (
      currentSentence.length >= 18 &&
      nextWord &&
      connectors.has(nextWord)
    ) {
      sentences.push(currentSentence.join(' ') + '.');
      currentSentence = [];
    }
  });

  if (currentSentence.length > 0) {
    const tail = currentSentence.join(' ');
    sentences.push(/[.!?]$/.test(tail) ? tail : tail + '.');
  }

  const normalizedSentences = sentences.map((s) => {
    const trimmed = s.trim();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  });

  // Regroupement en paragraphes équilibrés (2 à 3 phrases par paragraphe)
  const paragraphs: string[] = [];
  for (let i = 0; i < normalizedSentences.length; i += 3) {
    paragraphs.push(normalizedSentences.slice(i, i + 3).join(' '));
  }

  const embellishedText = paragraphs.join('\n\n');

  // Extraction d'une phrase d'exergue (la phrase la plus riche du récit)
  const longestSentence =
    [...normalizedSentences].sort((a, b) => b.length - a.length)[0] ||
    normalizedSentences[0] ||
    embellishedText;

  const pullQuote = `« ${longestSentence} »`;

  // Génération d'un titre poétique à partir des mots significatifs du récit
  const stopWords = new Set([
    'dans',
    'avec',
    'pour',
    'plus',
    'très',
    'bien',
    'tout',
    'tous',
    'toute',
    'toutes',
    'était',
    'étaient',
    'avais',
    'avait',
    'avoir',
    'être',
    'comme',
    'quand',
    'alors',
    'mais',
    'cette',
    'notre',
    'votre',
    'leurs',
    'nous',
    'vous',
    'elle',
    'elles',
    'souviens',
    'souvenir',
  ]);

  const significantWords = cleaned
    .replace(/[.,!?;:'"()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !stopWords.has(w.toLowerCase()));

  let title = `Mémoire de ${chapterTitle.split('&')[0].trim()}`;
  if (significantWords.length >= 2) {
    const w1 =
      significantWords[0].charAt(0).toUpperCase() +
      significantWords[0].slice(1).toLowerCase();
    const w2 =
      significantWords[Math.min(2, significantWords.length - 1)].toLowerCase();
    title = `Le temps de ${w1} et de ${w2}`;
  } else if (question.length > 10) {
    title = 'Un instant gravé dans la mémoire familiale';
  }

  return {
    title,
    embellishedText,
    pullQuote,
    epochYear: detectedYear,
  };
}

export function generateLocalPreface(
  authorName: string,
  memories: MemoryEntry[]
): string {
  const titles = memories
    .slice(0, 3)
    .map((m) => `« ${m.title} »`)
    .join(', ');
  return `À nos enfants, à nos petits-enfants et aux générations qui ouvriront ce livre demain.\n\nNous, ${authorName}, avons voulu confier à ces pages la mémoire vivante de nos jours : ${
    titles || 'nos années d’enfance, nos tables de fête et nos promesses'
  }. Chaque récit a été raconté de vive voix, avec les mots du cœur, pour que vous sachiez d’où vous venez et quelle tendresse veille sur votre chemin.`;
}
