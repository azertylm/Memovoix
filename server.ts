import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // POST /api/embellir : Sublime la transcription orale brute en récit littéraire à la 1ère personne + titre poétique + époque/lieu détectés
  app.post('/api/embellir', async (req, res) => {
    try {
      const { rawText, question, chapterTitle, authorName } = req.body as {
        rawText?: string;
        question?: string;
        chapterTitle?: string;
        authorName?: string;
      };

      if (!rawText || !rawText.trim()) {
        res.status(400).json({ error: 'Le texte du souvenir est vide.' });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Clé API Gemini non configurée côté serveur. Bascule automatique sur la sublimation éditoriale locale.',
          fallbackRequired: true,
        });
        return;
      }

      const prompt = `Tu es un biographe familial littéraire français d'exception.
Un grand-parent (${authorName || 'le narrateur'}) vient de raconter à voix haute un souvenir en réponse à la question suivante :
Chapitre : "${chapterTitle || 'Souvenirs de vie'}"
Question posée : "${question || ''}"

Transcription orale brute :
"""
${rawText.trim()}
"""

Ta mission :
1. Transforme cette transcription orale en un magnifique récit littéraire à la première personne ("Je..."), digne d'un livre de famille relié.
2. Supprime les hésitations ("euh", répétitions involontaires, faux départs), corrige la syntaxe et la ponctuation, et structure le texte en paragraphes élégants et respirants.
3. IMPORTANT : Conserve scrupuleusement tous les faits, les prénoms, les lieux, le vocabulaire affectif, la tendresse, l'humour et le ton authentique du grand-parent. N'invente aucun fait qui n'est pas dans le récit original.
4. Propose un titre poétique, chaleureux et évocateur (4 à 8 mots maximum) ainsi qu'une courte phrase d'exergue (citation clé extraite ou sublimée du souvenir).
5. Si une année/époque (ex: "1954", "Années 1960") ou un lieu (ex: "Saint-Malo", "École du village") est évoqué, extrais-le brièvement, sinon renvoie une chaîne vide.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Titre poétique et littéraire du souvenir (sans guillemets).',
              },
              embellishedText: {
                type: Type.STRING,
                description:
                  'Récit littéraire sublimé à la première personne, structuré en paragraphes séparés par deux sauts de ligne (\\n\\n).',
              },
              pullQuote: {
                type: Type.STRING,
                description:
                  'Une belle phrase marquante issue du récit à mettre en exergue.',
              },
              epochYear: {
                type: Type.STRING,
                description: 'Année ou époque détectée dans le récit (ou chaîne vide).',
              },
              location: {
                type: Type.STRING,
                description: 'Lieu évoqué dans le récit (ou chaîne vide).',
              },
            },
            required: ['title', 'embellishedText', 'pullQuote', 'epochYear', 'location'],
          },
        },
      });

      const jsonStr = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonStr);
      res.json({
        title: parsed.title,
        embellishedText: parsed.embellishedText,
        pullQuote: parsed.pullQuote,
        epochYear: parsed.epochYear || '',
        location: parsed.location || '',
        provider: 'gemini-4-hydrogen',
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la sublimation IA.';
      console.error('Erreur /api/embellir:', message);
      res.status(500).json({
        error: message,
        fallbackRequired: true,
      });
    }
  });

  // POST /api/relance : Génère une question de relance bienveillante sur le même thème
  app.post('/api/relance', async (req, res) => {
    try {
      const { currentQuestion, currentTranscript, chapterTitle } = req.body as {
        currentQuestion?: string;
        currentTranscript?: string;
        chapterTitle?: string;
      };

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error: 'Service Gemini indisponible, utilisation des relances locales.',
          fallbackRequired: true,
        });
        return;
      }

      const prompt = `Tu es un biographe familial bienveillant qui interviewe un grand-parent.
Chapitre actuel : "${chapterTitle || 'Souvenirs'}"
Question actuelle : "${currentQuestion || ''}"
${
  currentTranscript && currentTranscript.trim()
    ? `Ce que le grand-parent a déjà commencé à raconter : "${currentTranscript.trim()}"`
    : ''
}

Génère UNE SEULE question de relance courte, douce, sensorielle et chaleureuse (en vouvoyant le grand-parent, maximum 25 mots) pour l'aider à approfondir ce souvenir (par exemple en évoquant les odeurs, les sons, les visages, une anecdote précise ou l'émotion ressentie).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              followUpQuestion: {
                type: Type.STRING,
                description: 'Question de relance bienveillante en français.',
              },
            },
            required: ['followUpQuestion'],
          },
        },
      });

      const jsonStr = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonStr);
      res.json({
        followUpQuestion: parsed.followUpQuestion,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la génération de relance.';
      console.error('Erreur /api/relance:', message);
      res.status(500).json({
        error: message,
        fallbackRequired: true,
      });
    }
  });

  // POST /api/preface : Rédige une préface familiale littéraire sur-mesure à partir des titres des souvenirs
  app.post('/api/preface', async (req, res) => {
    try {
      const { authorName, memoryTitles } = req.body as {
        authorName?: string;
        memoryTitles?: string[];
      };

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error: 'Service Gemini indisponible, préface générée localement.',
          fallbackRequired: true,
        });
        return;
      }

      const titlesList =
        Array.isArray(memoryTitles) && memoryTitles.length > 0
          ? memoryTitles.join(', ')
          : 'Souvenirs d’enfance, recettes de famille et messages aux petits-enfants';

      const prompt = `Tu es un biographe familial littéraire français.
Rédige une préface chaleureuse, poétique et émouvante (en 2 courts paragraphes, environ 85 mots au total) pour ouvrir le Livre de Vie intitulé "Les Souvenirs de ${
        authorName || 'notre famille'
      }".
Ce recueil contient notamment les souvenirs suivants : ${titlesList}.
Écris à la première personne (au nom de ${
        authorName || 'l’auteur'
      }) en t'adressant aux enfants et petits-enfants.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              preface: {
                type: Type.STRING,
                description: 'Texte de la préface familiale en deux paragraphes.',
              },
            },
            required: ['preface'],
          },
        },
      });

      const jsonStr = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonStr);
      res.json({
        preface: parsed.preface,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la génération de la préface.';
      console.error('Erreur /api/preface:', message);
      res.status(500).json({
        error: message,
        fallbackRequired: true,
      });
    }
  });

  const { createServer: createHttpServer } = await import('http');
  const httpServer = createHttpServer(app);

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr:
          process.env.DISABLE_HMR === 'true'
            ? false
            : { server: httpServer },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`MémoVoix server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
