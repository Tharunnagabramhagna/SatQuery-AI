import type { DocumentationSection } from '../../types';

export const esDocumentationSections: DocumentationSection[] = [
  // ─── 1. Overview ──────────────────────────────────────────────────
  {
    id: 'overview',
    title: 'Descripción general de SatQuery AI',
    shortDescription: 'Plataforma de inteligencia satelital multimodal que traduce consultas en lenguaje natural en observaciones visuales respaldadas por evidencia.',
    category: 'core',
    icon: 'Compass',
    isDemo: true,
    flowDiagram: [
      'Consulta del usuario',
      'Agente de consultas',
      'Flujo de análisis',
      'Visor de imágenes dual',
      'Evidencia espacial',
      'Puntuación de confianza',
      'Informe de inteligencia',
    ],
    content: [
      'SatQuery AI es una interfaz interactiva de inteligencia de teledetección (Remote Sensing) diseñada para eliminar la complejidad de extraer información geoespacial a partir de imágenes satelitales multitemporales y multimodales.',
      'En lugar de requerir álgebra de bandas SIG manual, fotointerpretación visual tediosa o herramientas geoespaciales aisladas, los operadores plantean preguntas en lenguaje natural directamente en el espacio de trabajo. SatQuery AI enruta las consultas a través de flujos analíticos especializados, vincula las observaciones con regiones de píxeles (Grounding), correlaciona capas multisensor y genera informes de verificación descargables.',
      'La plataforma actual representa una demostración frontend de alta fidelidad diseñada para la evaluación SIH26167, ejecutando flujos de razonamiento de teledetección precalibrados en escenas satelitales reales.',
    ],
    subsections: [
      {
        id: 'core-workflow',
        title: 'Ciclo de vida de consulta de extremo a extremo',
        content: [
          '1. Ingestión en lenguaje natural: El operador ingresa una consulta o selecciona entre escenarios predefinidos.',
          '2. Comprensión del agente de consultas: El enrutamiento de intención semántica asigna la consulta al modo de análisis y herramienta correctos.',
          '3. Activación del espacio de trabajo: El lienzo interactivo configura visualizaciones individuales, bitemporales o multisensor.',
          '4. Evidencia y Grounding: Cuadros delimitadores visuales, máscaras espaciales e índices de confianza multifactor vinculan los hallazgos con la realidad sobre el terreno.',
          '5. Síntesis y exportación: Las observaciones se resumen en el Panel de Respuesta Final y se pueden exportar a informes con calidad de publicación.',
        ],
        callout: {
          type: 'note',
          text: 'La aplicación actual es un entorno de pruebas de demostración frontend. Las consultas y flujos de trabajo se ejecutan sobre escenas de referencia seleccionadas con ejecución de backend simulada.',
        },
      },
    ],
  },

  // ─── 2. System Architecture ───────────────────────────────────────
  {
    id: 'architecture',
    title: 'Arquitectura del sistema',
    shortDescription: 'Descripción general de la arquitectura frontend y límites de separación limpios para futuras integraciones de backend y modelos.',
    category: 'core',
    icon: 'Network',
    flowDiagram: [
      'Interfaz de usuario (React 19)',
      'Superposición del agente de consultas',
      'Lienzo de imágenes dual',
      'Motores de capas y Grounding',
      'Capa de servicio (api.ts)',
      'Almacén de datos centralizado',
      'Futura API de backend',
    ],
    content: [
      'SatQuery AI está estructurado con una estricta separación de límites entre componentes de presentación, orquestación de estado y servicios de acceso a datos. Esto garantiza que la transición de datos simulados a puntos finales de VLM reales alojados en la nube no requiera reescrituras de componentes.',
      'El espacio de trabajo se construye en torno a un diseño extensible: un contenedor de aplicación que proporciona contextos de tema y notificaciones, una barra lateral secundaria para la selección de herramientas, un lienzo dual interactivo de alto rendimiento, un panel de monitoreo de ejecución de AI y una columna inspectora de inteligencia.',
    ],
    subsections: [
      {
        id: 'arch-separation',
        title: 'Frontend actual frente a backend planificado',
        content: [
          '• Entorno de demostración actual: El cliente React se comunica con una capa de abstracción de servicio asíncrona (`src/services/api.ts`), que devuelve conjuntos de datos simulados centralizados, gráficos de evidencia precalculados y metadatos de demostración.',
          '• Arquitectura de producción futura (planificada): La misma capa de servicio enviará solicitudes REST/WebSocket a un backend Python en contenedores que ejecuta enrutamiento de modelos de visión y lenguaje (VLM), teselado espacial con GDAL/Rasterio e incrustaciones de búsqueda vectorial.',
        ],
        codeBlock: {
          language: 'typescript',
          code: `// Límite de servicio limpio en src/services/api.ts:
// ACTUAL: Delega en conjuntos de datos simulados centralizados
export async function submitAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  return executeMockAnalysis(request);
}

// FUTURO (Planificado): Reemplazo directo por proxy de backend
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
          text: 'Ningún componente de la interfaz de usuario importa directamente archivos de datos simulados. Todos los componentes consumen contratos de dominio tipados a través de la abstracción de servicios.',
        },
      },
    ],
  },

  // ─── 3. Query Agent ───────────────────────────────────────────────
  {
    id: 'query-agent',
    title: 'Canalización del agente de consultas',
    shortDescription: 'Capa de orquestación en lenguaje natural que enruta las instrucciones del operador a capacidades analíticas especializadas de teledetección.',
    category: 'agent',
    icon: 'Bot',
    flowDiagram: [
      'Ingestión de consultas',
      'Análisis sintáctico de intención semántica',
      'Clasificación de capacidades',
      'Selección de modo de herramienta',
      'Reconfiguración del lienzo',
      'Ejecución en el espacio de trabajo',
    ],
    content: [
      'El agente de consultas actúa como punto de entrada inteligente en lenguaje natural para el sistema SatQuery AI. En lugar de obligar al analista a seleccionar manualmente algoritmos ráster o combinaciones de bandas, el agente de consultas interpreta la intención del usuario y activa el modo especialista adecuado.',
      'Accesible a través del lanzador de la barra superior o la barra lateral secundaria dedicada, la superposición del agente de consultas proporciona una entrada enfocada con sugerencias automáticas y recomendaciones de capacidades.',
    ],
    subsections: [
      {
        id: 'agent-routing',
        title: 'Lógica de enrutamiento de capacidades',
        content: [
          'El agente de consultas clasifica las consultas entrantes en una de las seis herramientas analíticas especializadas según las pistas lingüísticas y los requisitos de los sensores:',
          '• Intención de Grounding: Consultas que solicitan conteos, ubicaciones de estructuras o identificación espacial activan la herramienta Object Grounding.',
          '• Intención temporal: Consultas que mencionan diferencias, expansión o transiciones interanuales activan Change Analysis o Change VQA.',
          '• Intención multimodal: Consultas que hacen referencia a retrodispersión de radar, humedad o verificación cruzada activan la herramienta Optical + SAR.',
          '• Intención interpretativa: Consultas de composición abierta activan Scene Captioning o Single Image VQA.',
        ],
        callout: {
          type: 'tip',
          text: 'El agente de consultas opera independientemente de la categoría de imágenes, lo que permite a los analistas alternar entre vistas Single, Compare y Fusion sin perder su estado de consulta activo.',
        },
      },
    ],
  },

  // ─── 4. Analysis Capabilities ─────────────────────────────────────
  {
    id: 'capabilities',
    title: 'Capacidades de análisis',
    shortDescription: 'Desglose exhaustivo de las seis capacidades analíticas principales de teledetección disponibles en el espacio de trabajo.',
    category: 'agent',
    icon: 'Layers',
    content: [
      'SatQuery AI implementa seis capacidades especializadas diseñadas para abarcar todo el espectro de tareas de interpretación de imágenes satelitales.',
      'Cada capacidad está equipada con plantillas de instrucciones calibradas, chips de sugerencias contextuales y superposiciones de visualización de evidencia vinculadas.',
    ],
    subsections: [
      {
        id: 'cap-vqa',
        title: '1. Single Image VQA (Visual Question Answering)',
        content: [
          '• Propósito: Responder preguntas abiertas en lenguaje natural sobre características presentes en una sola escena.',
          '• Consultas típicas: "¿Qué infraestructura y patrones de uso agrícola del suelo están presentes en esta escena satelital?"',
          '• Salida de demostración: Narrativa sintetizada que identifica asentamientos rurales, parcelación de cultivos y vías arteriales sin pavimentar con un 88% de confianza de demostración.',
        ],
      },
      {
        id: 'cap-captioning',
        title: '2. Subtitulado de escenas de teledetección (Scene Captioning)',
        content: [
          '• Propósito: Generar descripciones detalladas a nivel de párrafo sobre topografía, cobertura del suelo y actividad humana.',
          '• Consultas típicas: "Genere una descripción exhaustiva de teledetección de la topografía, cobertura del suelo y actividad humana."',
          '• Salida de demostración: Análisis de escena de múltiples oraciones que detalla gradientes de elevación, salud vegetativa y perímetros industriales.',
        ],
      },
      {
        id: 'cap-grounding',
        title: '3. Object Grounding (Localización de objetos)',
        content: [
          '• Propósito: Detectar, localizar y delimitar objetos o estructuras de edificios consultados.',
          '• Consultas típicas: "Localice todas las estructuras de almacenes, huellas de edificios y corredores viales principales."',
          '• Salida de demostración: 47 coordenadas discretas de cuadros delimitadores mapeadas sobre la imagen con etiquetado de categorías y comprobaciones de coherencia espacial.',
        ],
      },
      {
        id: 'cap-change-detection',
        title: '4. Detección de cambios bitemporal (Bi-Temporal Change Detection)',
        content: [
          '• Propósito: Identificar diferencias estructurales y de cobertura superficial entre dos adquisiciones temporales.',
          '• Consultas típicas: "Identifique los cambios principales entre estas dos imágenes."',
          '• Salida de demostración: Resaltado de regiones de cambio, máscaras poligonales y desgloses de transición categórica entre T0 (2025) y T1 (2026).',
        ],
      },
      {
        id: 'cap-change-vqa',
        title: '5. Preguntas y respuestas sobre cambios (Change VQA)',
        content: [
          '• Propósito: Responder preguntas cuantitativas sobre conversiones temporales del uso del suelo.',
          '• Consultas típicas: "¿Cuánta tierra agrícola se convirtió en estructuras construidas entre 2025 y 2026?"',
          '• Salida de demostración: Estimación métrica (14,8 hectáreas convertidas, 8 nuevas cimentaciones) con verificación de error de registro subpíxel.',
        ],
      },
      {
        id: 'cap-multimodal',
        title: '6. Análisis multimodal Optical + SAR',
        content: [
          '• Propósito: Correlacionar la reflectancia multiespectral óptica con la intensidad de retrodispersión de radar de apertura sintética (SAR).',
          '• Consultas típicas: "Analice la estructura complementaria y la reflectancia superficial entre la retrodispersión óptica y de radar."',
          '• Salida de demostración: Compuesto visual de doble canal que destaca características superficiales y estructuras metálicas con alto contraste dieléctrico.',
        ],
      },
    ],
  },

  // ─── 5. Object Grounding & Evidence ───────────────────────────────
  {
    id: 'grounding',
    title: 'Object Grounding y evidencia espacial',
    shortDescription: 'Detección de cuadros delimitadores espaciales, resaltado de regiones y vinculación bidireccional de evidencia.',
    category: 'workspace',
    icon: 'ScanSearch',
    flowDiagram: [
      'Instrucción del usuario',
      'Inferencia de Grounding',
      'Cuadros delimitadores (47 regiones)',
      'Vinculación del gráfico de evidencia',
      'Resaltado en el lienzo',
    ],
    content: [
      'Un diferenciador central de SatQuery AI es su capacidad para vincular las respuestas de AI directamente a coordenadas de píxeles en la imagen, en lugar de devolver alucinaciones de texto no fundamentadas.',
      'En el modo Object Grounding, el lienzo representa superposiciones de cuadros delimitadores normalizados sobre las estructuras detectadas. Al seleccionar un cuadro delimitador se resalta el elemento de evidencia correspondiente en el panel de evidencia, y al hacer clic en una tarjeta de evidencia el lienzo se desplaza y pulsa sobre el cuadro espacial asociado.',
    ],
    subsections: [
      {
        id: 'grounding-linking',
        title: 'Arquitectura de vinculación bidireccional',
        content: [
          '• Del lienzo a la evidencia: Al hacer clic en cualquiera de los 47 cuadros delimitadores, se selecciona automáticamente la tarjeta de evidencia coincidente en `EvidenceModal` y se actualiza `selectedGroundingId`.',
          '• De la evidencia al lienzo: Al hacer clic en "Inspeccionar en el mapa" desde cualquier punto de evidencia, se activa un resaltado pulsante de 2,5 segundos en la región objetivo.',
          '• Etiquetado de categorías: Los cuadros delimitadores se etiquetan con etiquetas de metadatos (`building`, `infrastructure`, `corridor`) y calificaciones de confianza.',
        ],
        callout: {
          type: 'tip',
          text: 'Las coordenadas de los cuadros delimitadores están normalizadas (espacio [0, 1]), lo que permite que las superposiciones vectoriales escalen fluidamente con el zoom del lienzo sin distorsión de píxeles.',
        },
      },
    ],
  },

  // ─── 6. Before / After Comparison ─────────────────────────────────
  {
    id: 'comparison',
    title: 'Flujo de trabajo de comparación Antes / Después',
    shortDescription: 'Análisis satelital bitemporal con controles deslizantes interactivos e inspección sincronizada en paralelo.',
    category: 'workspace',
    icon: 'GitCompare',
    content: [
      'El análisis de cambios mediante teledetección se basa en la comparación precisa de adquisiciones temporales corregidas y registradas. SatQuery AI proporciona múltiples modelos de interacción para inspeccionar las transiciones del uso del suelo entre la línea base (T0: 2025-03-12) y la observación (T1: 2026-03-12).',
    ],
    subsections: [
      {
        id: 'comparison-modes',
        title: 'Modos interactivos del visor',
        content: [
          '1. Modo de comparación deslizante: Utiliza un divisor vertical arrastrable con máscara CSS clip-path para revelar la imagen anterior a la izquierda y la imagen posterior a la derecha con alineación subpíxel.',
          '2. Modo lado a lado: Renderiza dos ventanas de visualización sincronizadas que muestran T0 y T1 simultáneamente con seguimiento unificado de desplazamiento y zoom.',
          '3. Conmutador de capa única: Permite alternar instantáneamente entre líneas base temporales con controles de opacidad en el panel de control de capas.',
        ],
        callout: {
          type: 'note',
          text: 'Las adquisiciones de imágenes en la demostración comparten una resolución idéntica de distancia de muestreo del suelo (GSD) de 10 m y parámetros de proyección EPSG:4326 para ilustrar comparaciones ideales corregidas.',
        },
      },
    ],
  },

  // ─── 7. Optical + SAR Workspace ───────────────────────────────────
  {
    id: 'optical-sar',
    title: 'Espacio de trabajo Optical + SAR',
    shortDescription: 'Visualización multisensor que combina reflectancia óptica visible con retrodispersión de radar simulada.',
    category: 'workspace',
    icon: 'Binary',
    isDemo: true,
    content: [
      'Los sensores ópticos capturan la reflectancia espectral de la superficie en bandas visibles y del infrarrojo cercano, pero están limitados por la iluminación solar y la cobertura de nubes. El radar de apertura sintética (SAR) transmite pulsos de microondas que penetran las nubes y proporcionan datos estructurales y de rugosidad.',
      'SatQuery AI incorpora un espacio de trabajo Optical + SAR diseñado para explorar cómo se pueden sintetizar datos multisensor en una ventana geoespacial unificada.',
    ],
    subsections: [
      {
        id: 'sar-demo-notice',
        title: 'Aviso de simulación de demostración',
        content: [
          '• Implementación actual: La capa SAR en la aplicación actual es una visualización de demostración simulada calibrada para la evaluación de la interfaz.',
          '• Parámetros del sensor: La demostración modela una base óptica visible Sentinel-2 MSI combinada con una simulación de polarización cruzada (VV/VH) de radar de apertura sintética en banda C Sentinel-1.',
          '• Limitaciones: El frontend actual no realiza enfoque de haz Doppler en vivo, filtrado de ruido moteado de radar ni cálculo de permitividad dieléctrica en tiempo real. Estas canalizaciones de datos están planificadas para su integración en el backend.',
        ],
        callout: {
          type: 'warning',
          text: 'Las presentaciones de SAR y las superposiciones de retrodispersión en esta versión están simuladas con fines de demostración. La fusión de sensores reales será gestionada por la canalización de procesamiento del backend.',
        },
      },
    ],
  },

  // ─── 8. AI Execution Workflow ─────────────────────────────────────
  {
    id: 'execution',
    title: 'Flujo de trabajo de ejecución de AI',
    shortDescription: 'La canalización de ejecución segura de 11 etapas que rastrea el análisis de teledetección desde la ingestión de la consulta hasta la entrega de la respuesta.',
    category: 'agent',
    icon: 'Activity',
    flowDiagram: [
      '1. Solicitud recibida',
      '2. Entrada validada',
      '3. Consulta comprendida',
      '4. Tarea identificada',
      '5. Flujo seleccionado',
      '6. Capacidad especialista elegida',
      '7. Imágenes procesadas',
      '8. Resultado validado',
      '9. Evidencia extraída',
      '10. Confianza estimada',
      '11. Respuesta generada',
    ],
    content: [
      'Para proporcionar una transparencia total sobre cómo se alcanzan las conclusiones analíticas, SatQuery AI implementa un registro de ejecución de 11 etapas que coincide con el monitor de progreso en tiempo real del Panel de Ejecución de AI.',
      'Cada etapa valida las condiciones previas, evita alucinaciones no fundamentadas y garantiza que los puntajes de evidencia y confianza se calculen antes de sintetizar cualquier observación final.',
    ],
    subsections: [
      {
        id: 'execution-stages',
        title: 'Las 11 etapas aprobadas del pipeline seguro',
        content: [
          '• Paso 1 — Solicitud recibida: Ingiere la consulta en lenguaje natural y el contexto de imagen activo desde la sesión del cliente.',
          '• Paso 2 — Entrada validada: Verifica los límites ráster, la disponibilidad de bandas espectrales y el registro de coordenadas espaciales.',
          '• Paso 3 — Consulta comprendida: Analiza entidades semánticas, características objetivo y restricciones espaciales.',
          '• Paso 4 — Tarea identificada: Clasifica el tipo de consulta (Grounding, VQA, Change Detection, Multimodal).',
          '• Paso 5 — Flujo seleccionado: Configura canalizaciones de procesamiento individuales, bitemporales o multisensor.',
          '• Paso 6 — Capacidad especialista elegida: Vincula instrucciones de modelos especializados y heurísticas de detección.',
          '• Paso 7 — Imágenes procesadas: Ejecuta filtrado espacial, normalización radiométrica y enmascaramiento de diferencias.',
          '• Paso 8 — Resultado validado: Aplica comprobaciones de coherencia contra firmas de uso del suelo de referencia.',
          '• Paso 9 — Evidencia extraída: Genera cuadros delimitadores espaciales y estadísticas numéricas de observación.',
          '• Paso 10 — Confianza estimada: Calcula índices de confianza multifactor en dimensiones espaciales, espectrales y temporales.',
          '• Paso 11 — Respuesta generada: Compila la narrativa de resumen final, actualiza los paneles de inspección y habilita la exportación de informes.',
        ],
        callout: {
          type: 'info',
          text: 'Esta canalización de 11 etapas representa la secuencia de ejecución exacta que se muestra en el QueryAndExecutionPanel del espacio de trabajo.',
        },
      },
    ],
  },

  // ─── 9. Evidence & Confidence ─────────────────────────────────────
  {
    id: 'evidence',
    title: 'Evidencia y puntuación de confianza',
    shortDescription: 'Desglose de confianza multifactor, verificación de consistencia espacial e inspección de evidencia.',
    category: 'intelligence',
    icon: 'ShieldCheck',
    content: [
      'La inteligencia satelital exige una verificación rigurosa. SatQuery AI reemplaza las puntuaciones opacas de un solo número con un modelo de confianza multifactor de cuatro pilares y tarjetas de evidencia verificables.',
    ],
    subsections: [
      {
        id: 'confidence-breakdown',
        title: 'Pilares del desglose de confianza',
        content: [
          '• Consistencia espacial (93% Demo): Verifica la coherencia geométrica, la conformidad de límites y las geometrías arquitectónicas esperadas.',
          '• Coincidencia espectral (88% Demo): Mide la alineación de la reflectancia de bandas multiespectrales con respecto a firmas estándar de vegetación y áreas construidas.',
          '• Coherencia temporal (91% Demo): Valida que los cambios observados cumplan con tasas de crecimiento físicas y temporales plausibles.',
          '• Acuerdo de modelos (86% Demo): Compara el acuerdo heurístico entre diferentes canalizaciones de detección.',
        ],
        callout: {
          type: 'note',
          text: 'Los puntajes de confianza son valores de demostración calibrados que representan heurísticas de acuerdo de modelos. No constituyen pruebas estadísticas formales.',
        },
      },
      {
        id: 'evidence-modal',
        title: 'Panel modal de evidencia',
        content: [
          'Al hacer clic en "Ver evidencia" se abre el panel modal de evidencia, que presenta puntos de verificación detallados para cada región detectada, incluyendo la metodología de detección, la corroboración de bandas espectrales y el resaltado directo en el lienzo.',
        ],
      },
    ],
  },

  // ─── 10. Reports & Data Export ────────────────────────────────────
  {
    id: 'reports',
    title: 'Informes de inteligencia y exportación de datos',
    shortDescription: 'Formatos de informes listos para publicación, incluidos PDF formateado, JSON estructurado y texto sin formato limpio.',
    category: 'intelligence',
    icon: 'FileSpreadsheet',
    content: [
      'Los flujos de trabajo analíticos culminan en artefactos de inteligencia exportables que pueden distribuirse a los responsables de la toma de decisiones, incluirse en expedientes de planificación o integrarse en sistemas SIG posteriores.',
      'El Panel de Respuesta Final incluye un despachador de exportación que admite tres formatos distintos generados directamente en el navegador mediante el empaquetado de Blob del lado del cliente.',
    ],
    subsections: [
      {
        id: 'report-formats',
        title: 'Formatos de exportación compatibles',
        content: [
          '• Informe de publicación en PDF: Resumen ejecutivo multipágina formateado generado mediante jsPDF, con metadatos de portada, planteamiento del problema, resumen ejecutivo de respuestas, tablas de evidencia, especificaciones de sensores y avisos formales de demostración.',
          '• Datos estructurados en JSON: Artefacto JSON legible por máquina que contiene límites de coordenadas espaciales completos, desgloses de confianza, porcentajes de categorías y pasos de registro de procesamiento para la ingestión automatizada en canalizaciones.',
          '• Informe de texto plano TXT: Resumen ASCII formateado y limpio optimizado para una revisión rápida y transmisión de bajo ancho de banda.',
        ],
        callout: {
          type: 'tip',
          text: 'Los tamaños de archivo de los informes se calculan dinámicamente a partir del búfer Blob generado en el momento de la descarga, evitando estimaciones basadas en marcadores de posición.',
        },
      },
    ],
  },

  // ─── 11. Frontend Architecture ────────────────────────────────────
  {
    id: 'frontend',
    title: 'Arquitectura frontend y sistema de diseño',
    shortDescription: 'Aplicación moderna de página única en React 19 construida con TypeScript, Tailwind CSS y tokens de diseño geoespacial personalizados.',
    category: 'engineering',
    icon: 'Code2',
    content: [
      'El frontend de SatQuery AI está diseñado según especificaciones aeroespaciales de nivel empresarial, equilibrando una alta densidad de información con una jerarquía visual intuitiva y tiempos de respuesta rápidos.',
      'La interfaz es completamente adaptable y admite estaciones de trabajo de escritorio, pantallas de tabletas y vistas móviles con diseños a medida.',
    ],
    subsections: [
      {
        id: 'tech-stack',
        title: 'Pila tecnológica y arquitectura',
        content: [
          '• Framework: React 19 con TypeScript para contratos de componentes con seguridad de tipos y cumplimiento estricto de interfaces.',
          '• Estilos: Tailwind CSS configurado con una paleta aeroespacial personalizada, variables CSS propias y cambio completo de tema claro/oscuro.',
          '• Enrutamiento: React Router DOM con sincronización de hash de URL para documentación y navegación con estado limpio para restaurar análisis.',
          '• Iconos: Lucide React para iconografía geoespacial y de sistemas coherente.',
          '• Resiliencia: Componentes globales de límite de error (Error Boundary) que envuelven las vistas de ruta para aislar fallos de renderizado manteniendo la navegación activa.',
        ],
      },
    ],
  },

  // ─── 12. Backend Integration Roadmap ──────────────────────────────
  {
    id: 'backend-roadmap',
    title: 'Hoja de ruta de integración de backend',
    shortDescription: 'Arquitectura planificada y contratos de API para conectar el frontend con modelos VLM en vivo y motores de procesamiento ráster.',
    category: 'engineering',
    icon: 'Milestone',
    isPlanned: true,
    content: [
      'El frontend de SatQuery AI está intencionalmente desacoplado de las implementaciones simuladas. Cada interacción de datos fluye a través de `src/services/api.ts`, estableciendo límites limpios para la conectividad futura con el backend.',
      'Esta hoja de ruta describe la transición planificada desde datos de demostración hacia un motor de inferencia de teledetección nativo de la nube para producción.',
    ],
    subsections: [
      {
        id: 'roadmap-phases',
        title: 'Etapas de integración de arquitectura planificadas',
        content: [
          '• Etapa 1 — Pasarela API: Vincular puntos finales REST para envíos de análisis (`POST /api/v1/analysis`), obtención de escenarios (`GET /api/v1/scenarios`) y recuperación de sesiones históricas (`GET /api/v1/history`).',
          '• Etapa 2 — Enrutamiento de modelos VLM: Integrar modelos especializados de visión y lenguaje para VQA satelital de disparo cero, subtitulado de escenas y Grounding espacial de vocabulario abierto.',
          '• Etapa 3 — Teselado ráster y motor SIG: Implementar microservicios de teselado GeoTIFF optimizados para la nube (COG) ejecutando GDAL/Rasterio para cálculos de relaciones de bandas al vuelo (NDVI, NDWI).',
          '• Etapa 4 — Procesamiento SAR en vivo: Implementar canalizaciones de preprocesamiento de radar que gestionen la ingestión real de Sentinel-1 GRD, corrección del terreno y filtrado de ruido moteado.',
        ],
        callout: {
          type: 'info',
          text: 'Estado: PLANIFICADO. La versión actual es un prototipo frontend independiente. No se requieren servidores de backend en vivo ni credenciales de API externas.',
        },
      },
    ],
  },

  // ─── 13. Demo Limitations ─────────────────────────────────────────
  {
    id: 'limitations',
    title: 'Limitaciones de la demostración de la plataforma',
    shortDescription: 'Divulgación transparente de los parámetros del entorno de pruebas, funciones simuladas y restricciones operativas del prototipo.',
    category: 'core',
    icon: 'AlertTriangle',
    isDemo: true,
    content: [
      'Actualmente, SatQuery AI está implementado como un prototipo de demostración para su evaluación en el Smart India Hackathon (SIH26167). Para garantizar una total transparencia, los operadores y evaluadores deben tener en cuenta las siguientes restricciones:',
    ],
    subsections: [
      {
        id: 'limitations-list',
        title: 'Restricciones actuales del entorno de pruebas',
        content: [
          '1. Razonamiento simulado: Las respuestas a consultas, los recuentos de características y las estadísticas de transición del uso del suelo son artefactos de demostración precalculados.',
          '2. Bancos de pruebas seleccionados: El análisis está calibrado con respecto a escenas ópticas de muestra de Sentinel-2 y compuestos SAR simulados, en lugar de tareas satelitales globales en vivo.',
          '3. Operación sin conexión: La aplicación se ejecuta completamente en el lado del cliente sin realizar llamadas de red externas a servidores de inferencia de modelos.',
          '4. Presentación visual de SAR: Las superposiciones de retrodispersión de radar representan tratamientos visuales de demostración en lugar de mediciones físicas de retrodispersión de ondas.',
          '5. Almacenamiento no persistente: El historial de análisis y las sesiones de usuario residen en el estado del cliente y no persisten si se borra la memoria caché del navegador.',
        ],
        callout: {
          type: 'warning',
          text: 'Este sistema está destinado a la demostración de UI/UX y la evaluación de conceptos de AI en teledetección. No debe utilizarse para navegación operativa en vivo ni para planificación de emergencias.',
        },
      },
    ],
  },
];
