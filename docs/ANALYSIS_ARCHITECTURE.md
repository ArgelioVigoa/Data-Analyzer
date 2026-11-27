# Análisis de energía depositada por neutrones y preparación para IA — arquitectura

Estado: etapa 1 de la rama `architecture/modular-refactor`. **Ningún proveedor de IA está conectado.**

## 1. Qué existe (real) y qué no

| Componente | Estado |
|---|---|
| Sección «Seleccionar archivo para analizar» con dos flujos (manual / IA) | Implementado |
| Catálogo de 6 gráficos (1–5 bloqueados y no ejecutables, 6 operativo) | Implementado (`src/analysis/chart-catalog.js`) |
| Gráfico 6 — fuentes: archivo GEANT4, simulación demostrativa, tabla editable | Implementado y probado |
| Motor único de gráficos y estadística (5 indicadores) | Implementado |
| Data Source Manager con procedencia | Implementado |
| AI Core (Conversation Manager, Context Builder, Prompt Manager, Provider Manager, Provider Interface, Response Processor, AI Settings, Mock Provider) | Implementado; sin IA real |
| Persistencia de conversaciones y registros de análisis (backend, por cuenta) | Implementado y probado en el backend; el uso desde la interfaz es opcional (`BackendConversationStore`) |
| Entrevista científica, proveedores reales (Gemini, Groq, OpenRouter, Ollama), recomendación de métodos clásicos/cuánticos, bibliografía | **No implementado** |
| Gráficos 1–5 | **Bloqueados**: solo registrados |

## 2. Estructura

```
src/
  analysis/   chart-catalog.js · neutron-engine.js (ÚNICO motor) · neutron-figure.js · neutron-service.js (ÚNICA entrada) · statistics.js (existente)
  data/       canonical-dataset.js · data-source-manager.js
  io/         geant4-parser.js · csv.js (existente)
  simulation/ neutron-demo.js (ÚNICO simulador)
  ai-core/    ai-core.js · conversation-manager.js · context-builder.js · prompt-manager.js · provider-manager.js · provider-interface.js
              response-processor.js · ai-settings.js · backend-conversation-store.js · providers/mock-provider.js
  ui/         analysis-ui.js · result-panel.js (compartido) · source-panels.js (compartido) · dom.js
backend/app/  routers/ai.py (nuevo) · models.py (+AIConversation, +AnalysisRecord)
```

Flujo de datos:

```
archivo GEANT4 ─┐                                   ┌─> gráfico + 5 indicadores (modo manual)
simulación demo ─┼─> DataSourceManager ─> dataset ──┤
tabla manual ───┘     (formato canónico)   canónico └─> mismo panel + Context Builder ─> AI Core ─> proveedor (futuro)
                                          runAnalysis (neutron-service) → analyzeDeposition + buildFigure
```

Ambos modos llaman a `runAnalysis`; hay pruebas automáticas que fallan si aparece una segunda implementación del motor, de la simulación o de los cuantiles fuera de `src/analysis`, o si la interfaz calcula estadística por su cuenta.

## 3. Formato canónico (`data-analyzer.neutron-edep/1`)

`edepMeV[i]` = energía depositada en el volumen sensible en el evento *i* (una historia de neutrón primario), en MeV; el cero es válido. Campos: `nRecorded` (filas), `nEvents` (N total simulado), `nEventsAssumed` (true si N se supuso igual a las filas), `sourceType`, `provenance`, `warnings`. Valores negativos, no finitos o N < filas se rechazan. Máx. 2 000 000 eventos.

## 4. Archivos GEANT4

Verificado en el código fuente de g4tools (`tools/wcsv_ntuple`): el Analysis Manager con salida CSV escribe una ntupla por archivo con cabecera comentada `#class tools::wcsv::ntuple`, `#title`, `#separator <código ASCII>`, `#vector_separator <código ASCII>`, y una línea `#column <tipo> <nombre>` por columna; también existe la variante «Hippo» (título + nombres separados por tabulador).

- **Admitido:** esos dos formatos y CSV/TSV con fila de encabezado (o una sola columna numérica sin cabecera).
- **Rechazado con mensaje explícito:** ROOT, HDF5, XML (AIDA), histogramas ya agrupados (`tools::histo`). No se adivina.
- **Unidades:** el CSV de GEANT4 **no guarda unidades**; las magnitudes están en unidades internas (energía: MeV) salvo que el código de usuario las dividiera por una unidad al rellenar. Por eso el usuario declara la unidad (eV, keV, MeV, GeV, J) y se convierte a MeV.
- **Evento vs. paso:** con columna de evento, las filas del mismo evento se **suman**; sin ella el usuario debe confirmar que «cada fila es un evento».
- **N total:** muchos programas solo guardan eventos con depósito. Si no se indica N, se supone N = filas y se avisa de que f y E_media estarán sobreestimadas.
- **No soportado aún:** pesos de eventos (técnicas de reducción de varianza), columnas vectoriales como energía, unidades por columna leídas del archivo.
- Los nombres de columna reconocidos para sugerir (`Edep`, `EnergyDeposit`…) son una **sugerencia**; el usuario puede elegir otra.
- El archivo `docs/examples/example-ntuple-format-only_NOT-GEANT4-OUTPUT.csv` solo ilustra el formato; fue generado con el modelo demostrativo, **no con GEANT4**.

## 5. Representación física del gráfico 6

- **X:** E_dep, energía depositada por evento (MeV). **Y:** densidad de eventos (1/N)·ΔN/ΔE (MeV⁻¹), normalizada por el total de eventos simulados N, de modo que ∫ y dE = f.
- Solo los eventos con E_dep>0 entran en el histograma (los de energía nula se resumen en f); no se mezclan magnitudes: no se admite energía por volumen/dosis como si fuera energía por evento.
- Intervalos: lineales por defecto; logarítmicos automáticamente solo si P95/P5 > 100 (o por elección). En escala logarítmica el contorno se dibuja como perfil escalonado.

## 6. Los cinco indicadores (N = eventos simulados, k = con E>0)

| # | Indicador | Definición | Justificación |
|---|---|---|---|
| 1 | Fracción de interacción f | k/N, IC 95 % de Wilson | Probabilidad de depósito (eficiencia de interacción) |
| 2 | Energía media por evento E_media | ΣE/N (ceros incluidos) ± s/√N | Proporcional a la dosis absorbida por neutrón primario |
| 3 | Mediana (E>0) | Q(0,5) | Valor típico robusto ante colas largas |
| 4 | Percentil 95 (E>0) | Q(0,95) | Cola de alta energía (umbrales de daño/detección) |
| 5 | Rango intercuartílico (E>0) | Q(0,75)−Q(0,25) | Dispersión robusta, sin suponer normalidad |

Cuantiles: interpolación lineal «tipo 7» (R tipo 7, NumPy por defecto). Se evitó incluir la media condicionada ⟨E|E>0⟩ porque E_media = f·⟨E|E>0⟩ la haría redundante. Desactivar el control oculta tabla y superposiciones; los datos, el histograma y el análisis no cambian.

## 7. Simulación demostrativa (`neutron-np-single-scatter/1`) — NO es GEANT4

Neutrones monoenergéticos E₀ sobre una lámina de polietileno de espesor t. Probabilidad de interacción P = 1 − exp(−Σt), con Σ = N_H·σ_np y N_H = 2ρN_A/M_(CH₂). La dispersión elástica n–p es isótropa en el sistema CM por debajo de ~10 MeV, de modo que la energía del protón de retroceso es uniforme en [0, E₀] (espectro «en caja»). El protón deposita toda su energía localmente; el neutrón dispersado escapa. Se ignoran carbono, captura, gammas, dispersión múltiple, resolución y extinción. Aviso automático si Σt > 0,3.

Esperado analítico (usado en las pruebas): f = P, E_media = P·E₀/2, mediana = E₀/2, P95 = 0,95·E₀, IQR = E₀/2. Los números provienen del muestreo con semilla fija (reproducible) **de este modelo**, no de un experimento ni de GEANT4. El σ_np por defecto (2,6 b) es un valor redondeado de orden de magnitud y es un parámetro editable; **no usar el modelo para predicciones cuantitativas**.

## 8. AI Core y contratos

- `AIProvider.generate({messages, context, settings, signal}) → {text, provider, model, isMock, usage?, structured?}`. `assertProvider` valida el contrato (duck typing).
- Un proveedor con `transport: "remote"` se invoca **a través del backend**; el navegador nunca guarda claves. `AISettings.update` rechaza claves/tokens (por nombre y por patrón de valor).
- `buildContext` envía solo: id/nombre/fuente/recuentos/procedencia seleccionada, indicadores, resumen del histograma y objetivo. **Nunca** los valores individuales ni el nombre del archivo original, salvo `includeRawData=true` (máx. 50 valores). Devuelve un informe de lo incluido/excluido y respeta `maxContextChars`.
- `processResponse` valida la respuesta, exige `isMock`, elimina caracteres de control y la trata como **texto plano** (se muestra con `textContent`).
- `MockProvider` está marcado `isMock=true`, con banner `[MOCK · HERRAMIENTA DE PRUEBAS · no es una IA]`; devuelve texto con plantilla fija.

### Conectar un proveedor real más adelante
1. Crear un endpoint backend (p. ej. `POST /api/v1/ai/chat`) que reciba `{conversation_id, context}` ya construido, lea la clave **solo** de variables de entorno del servidor, llame al proveedor y devuelva el esquema `ProviderResponse`.
2. Crear un adaptador `RemoteProvider extends AIProvider` (`transport:"remote"`, `isMock:false`) que llame a ese endpoint con el JWT de la cuenta.
3. `aiCore.providers.register(...)` y `setActive(id)`. La interfaz, el contexto y la conversación no cambian.
4. Añadir límites de uso, registro y revisión del contexto enviado antes de activarlo.

## 9. Backend (nuevo; reutiliza JWT, SQLAlchemy y aislamiento por cuenta)

| Método y ruta | Función |
|---|---|
| `GET /api/v1/ai/providers` | Informe honesto: solo existe el Mock del navegador; `inference_available:false` |
| `POST/GET /api/v1/ai/conversations`, `GET …/{id}` | Crear, listar, leer (404 idéntico para ids ajenos) |
| `POST …/{id}/messages`, `/close`, `/reopen`, `DELETE …/{id}` | Mensajes (≤200, ≤8000 caracteres), cierre, reapertura, borrado |
| `POST/GET /api/v1/analysis-records`, `GET …/{id}` | Metadatos y resumen del análisis; **rechaza valores crudos** (`edepMeV`, `values`…) y credenciales; ≤200 KB |

Tablas nuevas `ai_conversations` y `analysis_records` (creadas por `create_all`; no hay migraciones Alembic en el proyecto: ver limitaciones). No hay endpoint de inferencia.

## 10. Pruebas

`npm test` (50 pruebas: motor contra valores calculados a mano y solución analítica, cobertura empírica del IC de Wilson, parser, AI Core, integración) · `pytest` en `backend/` (13) · `tests/e2e/neutron_analysis_e2e.py` (31 comprobaciones en Chromium; requiere Playwright y Plotly local, no se ejecuta en CI).

## 11. Limitaciones conocidas

- Plotly se carga desde un CDN: sin conexión, los cálculos y tablas funcionan pero no el gráfico.
- Sin migraciones de base de datos: las tablas nuevas se crean automáticamente al arrancar; un cambio de esquema futuro requerirá Alembic.
- La limitación de tasa (`slowapi`) solo protege los endpoints que la declaran; los nuevos dependen de la autenticación y de topes de tamaño/cantidad.
- No se valida el archivo cargado como salida auténtica de GEANT4 (solo su formato).
- El análisis manual conserva el File Explorer heredado para el análisis genérico.
