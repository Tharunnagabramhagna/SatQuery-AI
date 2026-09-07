import type { DocumentationSection } from '../../types';

export const frDocumentationSections: DocumentationSection[] = [
  // ─── 1. Overview ──────────────────────────────────────────────────
  {
    id: 'overview',
    title: 'Vue d\'ensemble de SatQuery AI',
    shortDescription: 'Plateforme de renseignement satellitaire multimodal traduisant les requêtes en langage naturel en observations visuelles étayées par des preuves.',
    category: 'core',
    icon: 'Compass',
    isDemo: true,
    flowDiagram: [
      'Requête utilisateur',
      'Agent de requêtes',
      'Flux d\'analyse',
      'Visionneuse d\'imagerie double',
      'Preuve spatiale',
      'Calcul de confiance',
      'Rapport de renseignement',
    ],
    content: [
      'SatQuery AI est une interface interactive de renseignement en télédétection (Remote Sensing) conçue pour éliminer la complexité de l\'extraction d\'informations géospatiales à partir d\'imageries satellitaires multi-temporelles et multimodales.',
      'Au lieu d\'exiger une algèbre de bandes SIG manuelle, une photo-interprétation visuelle laborieuse ou des outils géospatiaux cloisonnés, les opérateurs posent des questions en langage naturel directement dans l\'espace de travail. SatQuery AI achemine les requêtes à travers des flux d\'analyse spécialisés, ancre les observations aux régions de pixels (Grounding), corrèle les couches multi-capteurs et génère des rapports de vérification téléchargeables.',
      'La plateforme actuelle représente une démonstration frontend haute fidélité conçue pour l\'évaluation SIH26167, exécutant des flux de raisonnement de télédétection pré-calibrés sur des scènes satellitaires réelles.',
    ],
    subsections: [
      {
        id: 'core-workflow',
        title: 'Cycle de vie de requête de bout en bout',
        content: [
          '1. Ingestion en langage naturel : L\'opérateur saisit une requête ou sélectionne un scénario prédéfini.',
          '2. Compréhension de l\'agent de requêtes : Le routage d\'intention sémantique associe la requête au bon mode d\'analyse et à la bonne capacité d\'outil.',
          '3. Activation de l\'espace de travail : Le canevas d\'imagerie interactif configure des affichages uniques, bi-temporels ou multi-capteurs.',
          '4. Preuve et Grounding : Les cadres de délimitation visuels, les masques spatiaux et les indices de confiance multifactoriels relient les constatations à la réalité de terrain.',
          '5. Synthèse et exportation : Les observations sont résumées dans le Panneau de Réponse Finale et exportables vers des rapports de qualité publication.',
        ],
        callout: {
          type: 'note',
          text: 'L\'application actuelle est un bac à sable de démonstration frontend. Les requêtes et les flux de travail s\'exécutent sur des scènes de référence sélectionnées avec une exécution backend simulée.',
        },
      },
    ],
  },

  // ─── 2. System Architecture ───────────────────────────────────────
  {
    id: 'architecture',
    title: 'Architecture du système',
    shortDescription: 'Vue d\'ensemble de l\'architecture frontend et frontières de séparation nettes pour les futures intégrations de modèles et de backend.',
    category: 'core',
    icon: 'Network',
    flowDiagram: [
      'Interface utilisateur (React 19)',
      'Superposition de l\'agent de requêtes',
      'Double canevas d\'imagerie',
      'Moteurs de couches et Grounding',
      'Couche de service (api.ts)',
      'Magasin de données centralisé',
      'Futur API backend',
    ],
    content: [
      'SatQuery AI est conçu avec une séparation stricte des frontières entre les composants de présentation, l\'orchestration de l\'état et les services d\'accès aux données. Cela garantit que le passage des données simulées de démonstration aux points de terminaison VLM hébergés dans le cloud ne nécessite aucune réécriture de composant.',
      'L\'espace de travail repose sur une disposition extensible : une enveloppe d\'application fournissant les contextes de thème et de notifications, une barre latérale secondaire pour le choix des outils, un double canevas interactif haute performance, un volet de surveillance d\'exécution d\'AI et une colonne d\'inspection de renseignement.',
    ],
    subsections: [
      {
        id: 'arch-separation',
        title: 'Frontend actuel vs Backend planifié',
        content: [
          '• Environnement de démonstration actuel : Le client React communique avec une couche d\'abstraction de service asynchrone (`src/services/api.ts`), qui renvoie des jeux de données simulés centralisés, des graphes de preuves précalculés et des métadonnées de démonstration.',
          '• Architecture de production future (planifiée) : La même couche de service enverra des requêtes REST/WebSocket vers un backend Python conteneurisé exécutant le routage de modèles vision-langage (VLM), le pavage spatial avec GDAL/Rasterio et les plongements vectoriels de recherche.',
        ],
        codeBlock: {
          language: 'typescript',
          code: `// Frontière de service propre dans src/services/api.ts :
// ACTUEL : Délégué aux jeux de données simulés centralisés
export async function submitAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  return executeMockAnalysis(request);
}

// FUTUR (Planifié) : Remplacement direct par proxy backend
export async function submitAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch('/api/v1/analysis', {
    method: 'POST',
    body: JSON.stringify(request)
  });
  return response.json();
}`,
        },
        callout: {
          type: 'info',
          text: 'Aucun composant d\'interface utilisateur n\'importe directement de fichiers de données simulées. Tous les composants consomment des contrats de domaine typés via l\'abstraction de services.',
        },
      },
    ],
  },

  // ─── 3. Query Agent ───────────────────────────────────────────────
  {
    id: 'query-agent',
    title: 'Pipeline de l\'agent de requêtes',
    shortDescription: 'Couche d\'orchestration en langage naturel acheminant les invites des opérateurs vers des capacités analytiques spécialisées de télédétection.',
    category: 'agent',
    icon: 'Bot',
    flowDiagram: [
      'Ingestion de requête',
      'Analyse d\'intention sémantique',
      'Classification de capacité',
      'Sélection du mode d\'outil',
      'Reconfiguration du canevas',
      'Exécution dans l\'espace de travail',
    ],
    content: [
      'L\'agent de requêtes sert de point d\'entrée intelligent en langage naturel pour le système SatQuery AI. Au lieu de forcer l\'analyste à sélectionner manuellement des algorithmes matriciels ou des combinaisons de bandes, l\'agent de requêtes interprète l\'intention de l\'utilisateur et active le mode spécialisé approprié.',
      'Accessible via le lanceur de la barre supérieure ou la barre latérale secondaire dédiée, la superposition de l\'agent de requêtes offre une saisie ciblée avec des invites de suggestion automatiques et des recommandations de capacités.',
    ],
    subsections: [
      {
        id: 'agent-routing',
        title: 'Logique de routage des capacités',
        content: [
          'L\'agent de requêtes classe les requêtes entrantes dans l\'un des six outils d\'analyse spécialisés en fonction des indices linguistiques et des exigences des capteurs :',
          '• Intention de Grounding : Les requêtes demandant des décomptes, des emplacements de structures ou une identification spatiale déclenchent l\'outil Object Grounding.',
          '• Intention temporelle : Les requêtes mentionnant des différences, une expansion ou des transitions d\'une année sur l\'autre déclenchent Change Analysis ou Change VQA.',
          '• Intention multimodale : Les requêtes faisant référence à la rétrodiffusion radar, à l\'humidité ou à la vérification croisée déclenchent l\'outil Optical + SAR.',
          '• Intention interprétative : Les requêtes de composition ouverte déclenchent Scene Captioning ou Single Image VQA.',
        ],
        callout: {
          type: 'tip',
          text: 'L\'agent de requêtes fonctionne indépendamment de la catégorie d\'imagerie, permettant aux analystes de passer entre les vues Single, Compare et Fusion sans perdre l\'état de leur requête active.',
        },
      },
    ],
  },

  // ─── 4. Analysis Capabilities ─────────────────────────────────────
  {
    id: 'capabilities',
    title: 'Capacités d\'analyse',
    shortDescription: 'Présentation détaillée des six capacités analytiques fondamentales de télédétection disponibles dans l\'espace de travail.',
    category: 'agent',
    icon: 'Layers',
    content: [
      'SatQuery AI met en œuvre six capacités spécialisées conçues pour couvrir l\'ensemble du spectre des tâches d\'interprétation d\'imagerie satellitaire.',
      'Chaque capacité est dotée de modèles d\'invites calibrés, de jetons de suggestion contextuelle et de superpositions de visualisation de preuves associées.',
    ],
    subsections: [
      {
        id: 'cap-vqa',
        title: '1. Single Image VQA (Visual Question Answering)',
        content: [
          '• Objectif : Répondre à des questions ouvertes en langage naturel sur les éléments présents dans une scène unique.',
          '• Requêtes types : « Quels schémas d\'infrastructure et d\'utilisation agricole des sols sont présents dans cette scène satellitaire ? »',
          '• Résultat de démonstration : Synthèse descriptive identifiant les zones rurales, le zonage parcellaire et les axes routiers non goudronnés avec 88% de confiance de démonstration.',
        ],
      },
      {
        id: 'cap-captioning',
        title: '2. Sous-titrage de scène de télédétection (Scene Captioning)',
        content: [
          '• Objectif : Générer des descriptions détaillées de la topographie, de l\'occupation des sols et des activités humaines.',
          '• Requêtes types : « Générer une description exhaustive de télédétection de la topographie, de l\'occupation du sol et de l\'activité humaine. »',
          '• Résultat de démonstration : Analyse multi-phrases détaillant les gradients d\'élévation, la santé de la végétation et les périmètres industriels.',
        ],
      },
      {
        id: 'cap-grounding',
        title: '3. Localisation d\'objets (Object Grounding)',
        content: [
          '• Objectif : Détecter, localiser et délimiter les objets ou structures de bâtiments recherchés.',
          '• Requêtes types : « Localiser toutes les structures d\'entrepôt, empreintes de bâtiments et corridors de transport principaux. »',
          '• Résultat de démonstration : 47 coordonnées de cadres de délimitation discrètes cartographiées avec étiquetage de catégorie et contrôles de cohérence spatiale.',
        ],
      },
      {
        id: 'cap-change-detection',
        title: '4. Détection de changements bi-temporelle (Bi-Temporal Change Detection)',
        content: [
          '• Objectif : Identifier les différences structurelles et d\'occupation des sols entre deux acquisitions temporelles.',
          '• Requêtes types : « Identifier les changements majeurs entre ces deux images. »',
          '• Résultat de démonstration : Mise en évidence des zones de divergence, masques polygonaux et décompositions catégorielles entre T0 (2025) et T1 (2026).',
        ],
      },
      {
        id: 'cap-change-vqa',
        title: '5. Questions-réponses sur les changements (Change VQA)',
        content: [
          '• Objectif : Répondre à des questions quantitatives concernant les conversions temporelles de l\'usage des terres.',
          '• Requêtes types : « Combien de terres agricoles ont été converties en structures bâties entre 2025 et 2026 ? »',
          '• Résultat de démonstration : Estimation métrique (14,8 hectares convertis, 8 nouvelles fondations) avec vérification de l\'erreur d\'enregistrement sous-pixel.',
        ],
      },
      {
        id: 'cap-multimodal',
        title: '6. Analyse multimodale Optical + SAR',
        content: [
          '• Objectif : Corréler la réflectance multispectrale optique avec l\'intensité de rétrodiffusion radar à synthèse d\'ouverture (SAR).',
          '• Requêtes types : « Analyser la structure complémentaire et la réflectance de surface entre la rétrodiffusion optique et radar. »',
          '• Résultat de démonstration : Composite visuel à deux canaux mettant en valeur les éléments de surface et les structures métalliques à fort contraste diélectrique.',
        ],
      },
    ],
  },

  // ─── 5. Object Grounding & Evidence ───────────────────────────────
  {
    id: 'grounding',
    title: 'Object Grounding et preuves spatiales',
    shortDescription: 'Détection de cadres de délimitation spatiaux, mise en valeur des régions et liaison bidirectionnelle des preuves.',
    category: 'workspace',
    icon: 'ScanSearch',
    flowDiagram: [
      'Invite utilisateur',
      'Inférence de Grounding',
      'Cadres de délimitation (47 régions)',
      'Liaison au graphe de preuves',
      'Mise en valeur sur le canevas',
    ],
    content: [
      'Un facteur différenciateur clé de SatQuery AI est sa capacité à ancrer les réponses de l\'AI directement sur les coordonnées de pixels de l\'imagerie, plutôt que de produire des hallucinations textuelles sans fondement.',
      'En mode Object Grounding, le canevas affiche des cadres de délimitation normalisés sur les structures détectées. La sélection d\'un cadre met en surbrillance l\'élément de preuve correspondant dans le volet des preuves, et un clic sur une carte de preuve effectue un déplacement et un clignotement sur le cadre spatial associé.',
    ],
    subsections: [
      {
        id: 'grounding-linking',
        title: 'Architecture de liaison bidirectionnelle',
        content: [
          '• Du canevas aux preuves : Cliquer sur l\'un des 47 cadres sélectionne automatiquement la carte correspondante dans `EvidenceModal` et met à jour `selectedGroundingId`.',
          '• Des preuves au canevas : Cliquer sur « Inspecter sur la carte » déclenche un clignotement de mise en valeur de 2,5 secondes sur la région cible.',
          '• Étiquetage de catégories : Les cadres de délimitation sont marqués avec des étiquettes de métadonnées (`building`, `infrastructure`, `corridor`) et des indices de confiance.',
        ],
        callout: {
          type: 'tip',
          text: 'Les coordonnées des cadres sont normalisées (espace [0, 1]), permettant aux superpositions vectorielles de s\'adapter au zoom du canevas sans distorsion de pixels.',
        },
      },
    ],
  },

  // ─── 6. Before / After Comparison ─────────────────────────────────
  {
    id: 'comparison',
    title: 'Flux de comparaison Avant / Après',
    shortDescription: 'Analyse satellitaire bi-temporelle avec curseurs coulissants interactifs et inspection synchronisée côte à côte.',
    category: 'workspace',
    icon: 'GitCompare',
    content: [
      'L\'analyse de changement en télédétection repose sur la comparaison précise d\'acquisitions temporelles co-enregistrées. SatQuery AI propose plusieurs modèles d\'interaction pour inspecter les transitions d\'usage du sol entre la référence (T0: 2025-03-12) et l\'observation (T1: 2026-03-12).',
    ],
    subsections: [
      {
        id: 'comparison-modes',
        title: 'Modes interactifs de la visionneuse',
        content: [
          '1. Mode balayage coulissant : Utilise un séparateur vertical déplaçable avec masquage CSS clip-path pour révéler l\'imagerie Avant à gauche et Après à droite avec alignement sous-pixel.',
          '2. Mode côte à côte : Affiche deux fenêtres synchronisées présentant T0 et T1 simultanément avec suivi unifié du panoramique et du zoom.',
          '3. Bascule de couche unique : Permet de basculer instantanément entre les bases de référence temporelles avec des contrôles d\'opacité dans le panneau des calques.',
        ],
        callout: {
          type: 'note',
          text: 'Les acquisitions d\'imagerie dans la démo partagent une résolution identique de 10 m de distance d\'échantillonnage au sol (GSD) et les paramètres de projection EPSG:4326 pour illustrer des comparaisons idéales.',
        },
      },
    ],
  },

  // ─── 7. Optical + SAR Workspace ───────────────────────────────────
  {
    id: 'optical-sar',
    title: 'Espace de travail Optical + SAR',
    shortDescription: 'Visualisation multi-capteurs combinant la réflectance optique visible et la rétrodiffusion radar simulée.',
    category: 'workspace',
    icon: 'Binary',
    isDemo: true,
    content: [
      'Les capteurs optiques capturent la réflectance spectrale de surface dans les bandes visibles et proche infrarouge, mais sont limités par l\'éclairage solaire et la couverture nuageuse. Le radar à synthèse d\'ouverture (SAR) émet des impulsions micro-ondes qui traversent les nuages et fournissent des données structurelles et de rugosité.',
      'SatQuery AI intègre un espace de travail Optical + SAR conçu pour explorer comment les données multi-capteurs peuvent être synthétisées dans une fenêtre géospatiale unifiée.',
    ],
    subsections: [
      {
        id: 'sar-demo-notice',
        title: 'Avis de simulation de démonstration',
        content: [
          '• Implémentation actuelle : La couche SAR dans l\'application actuelle est une visualisation de démonstration simulée calibrée pour l\'évaluation de l\'interface.',
          '• Paramètres du capteur : La démonstration modélise une base optique visible Sentinel-2 MSI combinée à une simulation radar à synthèse d\'ouverture Sentinel-1 en bande C à polarisation croisée (VV/VH).',
          '• Limitations : Le frontend actuel n\'effectue pas d\'affinement de faisceau Doppler en direct, de filtrage du bruit de chatoiement ni de calcul de permittivité diélectrique en temps réel. Ces flux de données sont prévus pour l\'intégration backend.',
        ],
        callout: {
          type: 'warning',
          text: 'Les représentations SAR et les superpositions de rétrodiffusion dans cette version sont simulées à des fins de démonstration. La fusion réelle des capteurs sera prise en charge par le pipeline de traitement backend.',
        },
      },
    ],
  },

  // ─── 8. AI Execution Workflow ─────────────────────────────────────
  {
    id: 'execution',
    title: 'Flux de travail d\'exécution d\'AI',
    shortDescription: 'Le pipeline d\'exécution sécurisé en 11 étapes traçant l\'analyse de télédétection de l\'ingestion de l\'invite à la livraison de la réponse.',
    category: 'agent',
    icon: 'Activity',
    flowDiagram: [
      '1. Demande reçue',
      '2. Entrée validée',
      '3. Requête comprise',
      '4. Tâche identifiée',
      '5. Flux de travail sélectionné',
      '6. Capacité spécialiste choisie',
      '7. Imagerie traitée',
      '8. Résultat validé',
      '9. Preuves extraites',
      '10. Confiance estimée',
      '11. Réponse générée',
    ],
    content: [
      'Pour offrir une transparence totale sur la manière dont les conclusions analytiques sont obtenues, SatQuery AI met en œuvre une trace d\'exécution en 11 étapes correspondant au moniteur de progression en temps réel du Panneau d\'Exécution d\'AI.',
      'Chaque étape valide les conditions préalables, prévient les hallucinations non fondées et garantit que les scores de preuves et de confiance sont calculés avant toute synthèse d\'observation finale.',
    ],
    subsections: [
      {
        id: 'execution-stages',
        title: 'Les 11 étapes approuvées du pipeline sécurisé',
        content: [
          '• Étape 1 — Demande reçue : Réception de la requête en langage naturel et du contexte d\'image actif de la session client.',
          '• Étape 2 — Entrée validée : Vérification des limites matricielles, de la disponibilité des bandes spectrales et du repérage spatial.',
          '• Étape 3 — Requête comprise : Analyse des entités sémantiques, des éléments cibles et des contraintes spatiales.',
          '• Étape 4 — Tâche identifiée : Catégorisation du type de requête (Grounding, VQA, Change Detection, Multimodal).',
          '• Étape 5 — Flux de travail sélectionné : Configuration des pipelines de traitement uniques, bi-temporels ou multi-capteurs.',
          '• Étape 6 — Capacité spécialiste choisie : Liaison des invites de modèles spécialisés et des heuristiques de détection.',
          '• Étape 7 — Imagerie traitée : Exécution du filtrage spatial, de la normalisation radiométrique et du masquage des différences.',
          '• Étape 8 — Résultat validé : Application des vérifications de cohérence par rapport aux signatures d\'usage des terres de référence.',
          '• Étape 9 — Preuves extraites : Génération des cadres de délimitation spatiaux et des statistiques numériques d\'observation.',
          '• Étape 10 — Confiance estimée : Calcul des indices de confiance multi-facteurs sur les dimensions spatiales, spectrales et temporelles.',
          '• Étape 11 — Réponse générée : Compilation du compte-rendu synthétique final, mise à jour des panneaux d\'inspection et déverrouillage de l\'exportation.',
        ],
        callout: {
          type: 'info',
          text: 'Ce pipeline en 11 étapes représente la séquence d\'exécution exacte affichée dans le QueryAndExecutionPanel de l\'espace de travail.',
        },
      },
    ],
  },

  // ─── 9. Evidence & Confidence ─────────────────────────────────────
  {
    id: 'evidence',
    title: 'Preuves et calcul de confiance',
    shortDescription: 'Ventilation multifactorielle de la confiance, vérification de cohérence spatiale et examen des preuves.',
    category: 'intelligence',
    icon: 'ShieldCheck',
    content: [
      'Le renseignement satellitaire exige une vérification rigoureuse. SatQuery AI remplace les scores opaques à chiffre unique par un modèle de confiance multifactoriel à quatre piliers et des cartes de preuves vérifiables.',
    ],
    subsections: [
      {
        id: 'confidence-breakdown',
        title: 'Piliers de la ventilation de confiance',
        content: [
          '• Cohérence spatiale (93% Démo) : Vérifie la cohérence géométrique, la conformité des limites et les géométries architecturales attendues.',
          '• Concordance spectrale (88% Démo) : Mesure l\'alignement de la réflectance des bandes multispectrales avec les signatures de référence.',
          '• Cohérence temporelle (91% Démo) : Valide que les changements observés respectent des rythmes de croissance physiques et temporels plausibles.',
          '• Accord des modèles (86% Démo) : Compare l\'accord heuristique inter-modèles à travers les pipelines de détection.',
        ],
        callout: {
          type: 'note',
          text: 'Les scores de confiance sont des valeurs de démonstration calibrées représentant des heuristiques d\'accord de modèle. Ils ne constituent pas des preuves statistiques formelles.',
        },
      },
      {
        id: 'evidence-modal',
        title: 'Volet modal des preuves',
        content: [
          'Cliquer sur « Voir les preuves » ouvre le volet modal des preuves, qui présente des points de vérification détaillés pour chaque région détectée, y compris la méthodologie de détection, la corroboration des bandes spectrales et la mise en évidence directe sur le canevas.',
        ],
      },
    ],
  },

  // ─── 10. Reports & Data Export ────────────────────────────────────
  {
    id: 'reports',
    title: 'Rapports de renseignement et exportation',
    shortDescription: 'Formats de rapports prêts pour publication, y compris PDF mis en page, JSON structuré et texte brut.',
    category: 'intelligence',
    icon: 'FileSpreadsheet',
    content: [
      'Les flux de travail analytiques débouchent sur des artéfacts de renseignement exportables qui peuvent être distribués aux décideurs, inclus dans des dossiers de planification ou intégrés dans des systèmes SIG en aval.',
      'Le Panneau de Réponse Finale comprend un gestionnaire d\'exportation prenant en charge trois formats distincts générés directement dans le navigateur via l\'empaquetage Blob côté client.',
    ],
    subsections: [
      {
        id: 'report-formats',
        title: 'Formats d\'exportation pris en charge',
        content: [
          '• Rapport de publication PDF : Synthèse exécutive multi-pages mise en forme générée via jsPDF, avec métadonnées de couverture, énoncé du problème, résumé exécutif, tableaux de preuves, spécifications des capteurs et avis formels de démonstration.',
          '• Données structurées JSON : Artéfact JSON lisible par machine contenant les limites de coordonnées spatiales complètes, les ventilations de confiance, les pourcentages de catégories et les étapes de trace de traitement pour une ingestion automatisée.',
          '• Rapport texte brut TXT : Synthèse ASCII claire et formatée optimisée pour une consultation rapide et une transmission à faible bande passante.',
        ],
        callout: {
          type: 'tip',
          text: 'La taille des fichiers de rapport est calculée dynamiquement à partir du tampon Blob généré lors du téléchargement, évitant ainsi les estimations fictives non vérifiées.',
        },
      },
    ],
  },

  // ─── 11. Frontend Architecture ────────────────────────────────────
  {
    id: 'frontend',
    title: 'Architecture frontend et système de conception',
    shortDescription: 'Application monopage moderne en React 19 construite avec TypeScript, Tailwind CSS et des jetons de conception géospatiale personnalisés.',
    category: 'engineering',
    icon: 'Code2',
    content: [
      'Le frontend de SatQuery AI est conçu selon des spécifications aérospatiales professionnelles, équilibrant une densité d\'informations élevée avec une hiérarchie visuelle intuitive et des temps de réponse rapides.',
      'L\'interface est entièrement adaptative, prenant en charge les postes de travail de bureau, les tablettes et les affichages mobiles avec des dispositions sur mesure.',
    ],
    subsections: [
      {
        id: 'tech-stack',
        title: 'Pile technologique et architecture',
        content: [
          '• Framework : React 19 avec TypeScript pour des contrats de composants type-safe et une application stricte des interfaces.',
          '• Styles : Tailwind CSS configuré avec une palette aérospatiale sur mesure, des variables CSS personnalisées et un basculement complet de thème clair/sombre.',
          '• Routage : React Router DOM avec synchronisation du hachage d\'URL pour la documentation et navigation à état réinitialisé pour la restauration d\'analyse.',
          '• Icônes : Lucide React pour une iconographie géospatiale et système cohérente.',
          '• Résilience : Composants Error Boundary globaux enveloppant les vues de routage pour isoler les pannes de rendu tout en préservant la navigation de l\'application.',
        ],
      },
    ],
  },

  // ─── 12. Backend Integration Roadmap ──────────────────────────────
  {
    id: 'backend-roadmap',
    title: 'Feuille de route d\'intégration backend',
    shortDescription: 'Architecture planifiée et contrats d\'API pour connecter le frontend à des modèles VLM en direct et à des moteurs de traitement matriciel.',
    category: 'engineering',
    icon: 'Milestone',
    isPlanned: true,
    content: [
      'Le frontend de SatQuery AI est volontairement dissocié des implémentations de simulation. Chaque interaction de données passe par `src/services/api.ts`, établissant des frontières nettes pour la connectivité backend future.',
      'Cette feuille de route décrit la transition planifiée depuis les données de démonstration vers un moteur d\'inférence de télédétection cloud-native en production.',
    ],
    subsections: [
      {
        id: 'roadmap-phases',
        title: 'Étapes d\'intégration de l\'architecture planifiée',
        content: [
          '• Étape 1 — Passerelle API : Lier les points de terminaison REST pour les soumissions d\'analyse (`POST /api/v1/analysis`), la récupération de scénarios (`GET /api/v1/scenarios`) et la récupération d\'historique (`GET /api/v1/history`).',
          '• Étape 2 — Routage de modèles VLM : Intégrer des modèles vision-langage spécialisés pour le VQA satellitaire zero-shot, le sous-titrage de scènes et le Grounding spatial à vocabulaire ouvert.',
          '• Étape 3 — Pavage matriciel et moteur SIG : Déployer des microservices de tuilage GeoTIFF optimisés pour le cloud (COG) exécutant GDAL/Rasterio pour les calculs de rapports de bandes à la volée (NDVI, NDWI).',
          '• Étape 4 — Traitement SAR en direct : Mettre en œuvre des pipelines de prétraitement radar gérant l\'ingestion réelle de Sentinel-1 GRD, la correction de terrain et le filtrage du bruit de chatoiement.',
        ],
        callout: {
          type: 'info',
          text: 'Statut : PLANIFIÉ. La version actuelle est un prototype frontend autonome. Aucun serveur backend en direct ni identifiant d\'API externe n\'est requis.',
        },
      },
    ],
  },

  // ─── 13. Demo Limitations ─────────────────────────────────────────
  {
    id: 'limitations',
    title: 'Limitations de la démonstration de plateforme',
    shortDescription: 'Divulgation transparente des paramètres du bac à sable, des fonctionnalités simulées et des contraintes d\'exploitation du prototype.',
    category: 'core',
    icon: 'AlertTriangle',
    isDemo: true,
    content: [
      'SatQuery AI est actuellement déployé en tant que prototype de démonstration pour évaluation dans le cadre du Smart India Hackathon (SIH26167). Pour assurer une totale transparence, les opérateurs et évaluateurs doivent noter les contraintes suivantes :',
    ],
    subsections: [
      {
        id: 'limitations-list',
        title: 'Contraintes actuelles du bac à sable',
        content: [
          '1. Raisonnement simulé : Les réponses aux requêtes, les décomptes d\'éléments et les statistiques de transition d\'occupation du sol sont des artéfacts de démonstration précalculés.',
          '2. Bancs d\'essai sélectionnés : L\'analyse est calibrée par rapport à des scènes optiques Sentinel-2 échantillons et des composites SAR simulés plutôt que sur une programmation satellitaire mondiale en direct.',
          '3. Fonctionnement hors ligne : L\'application s\'exécute entièrement côté client sans effectuer d\'appels réseau externes vers des serveurs d\'inférence de modèle.',
          '4. Présentation SAR visuelle : Les superpositions de rétrodiffusion radar représentent des traitements visuels de démonstration plutôt que des mesures physiques de rétrodiffusion d\'ondes.',
          '5. Stockage non persistant : L\'historique des analyses et les sessions utilisateur résident dans l\'état client et ne persistent pas après la réinitialisation du cache du navigateur.',
        ],
        callout: {
          type: 'warning',
          text: 'Ce système est destiné à la démonstration UI/UX et à l\'évaluation de concepts d\'AI en télédétection. Il ne doit pas être utilisé pour la navigation opérationnelle en temps réel ou la planification d\'urgence.',
        },
      },
    ],
  },
];
