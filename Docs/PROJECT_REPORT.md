# 🛰️ SatQuery AI

## Project Report

### SIH26167 — An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries

---

## 1. Abstract

Remote-sensing imagery provides valuable information for monitoring and understanding Earth's surface. However, extracting meaningful information from satellite imagery often requires specialized knowledge of geographic information systems, satellite sensors, image-processing workflows and task-specific machine-learning models.

**SatQuery AI** proposes an interactive Vision-Language Assistant that enables users to analyze remote-sensing imagery using natural-language queries.

The system combines remote-sensing Vision-Language Models, specialized analytical tools, geospatial processing and agentic orchestration to interpret user queries and select appropriate analysis workflows.

The proposed system supports single-image Visual Question Answering, scene understanding or text-guided grounding, bi-temporal change analysis, joint optical-SAR reasoning, evidence generation, confidence estimation and transparent execution traces.

Rather than relying on a single general-purpose model, SatQuery follows a modular architecture in which different specialist models and analytical tools can be selected according to the user's query.

---

# 2. Problem Statement

## SIH26167

**SatQuery AI - An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries**

The problem focuses on making remote-sensing image analysis accessible through natural-language interaction.

The intended system should be able to understand queries involving satellite imagery and intelligently perform the required analysis across:

* Single-image imagery
* Bi-temporal imagery
* Optical/multispectral imagery
* SAR imagery
* Multimodal inputs

The system should also provide evidence and an observable execution trace rather than returning an unexplained AI-generated answer.

---

# 3. Problem Background

Remote-sensing analysis is traditionally performed through combinations of:

* GIS platforms
* Image-processing software
* Remote-sensing algorithms
* Machine-learning models
* Satellite-data catalogues
* Human domain expertise

A typical workflow may require a user to:

1. Identify appropriate satellite imagery.
2. Inspect image metadata.
3. Select a suitable analytical method.
4. Preprocess imagery.
5. Run a specialized model.
6. Interpret model outputs.
7. Visualize spatial results.
8. Compare temporal observations.
9. Produce a final report.

This creates a fragmented workflow.

SatQuery attempts to provide a unified natural-language interface over these capabilities.

---

# 4. Proposed Solution

SatQuery AI introduces an **agentic remote-sensing analysis layer**.

The user interacts with the system through natural language.

The system then:

```text
User Query
    ↓
Query Understanding
    ↓
Input Validation
    ↓
Task Classification
    ↓
Tool / Model Selection
    ↓
Specialist Analysis
    ↓
Evidence Generation
    ↓
Confidence Estimation
    ↓
Answer Generation
    ↓
Execution Trace
```

---

# 5. Objectives

The primary objectives are:

### Objective 1

Enable users to query remote-sensing imagery using natural language.

### Objective 2

Support single-image visual question answering.

### Objective 3

Provide scene description/captioning or text-guided grounding.

### Objective 4

Support bi-temporal change analysis.

### Objective 5

Enable joint reasoning over optical and SAR imagery.

### Objective 6

Automatically select appropriate specialist models and tools.

### Objective 7

Provide evidence-backed answers.

### Objective 8

Expose confidence and execution information.

### Objective 9

Create a modular architecture that can be extended with additional models and geospatial tools.

---

# 6. Target Users

Potential users include:

* Remote-sensing analysts
* GIS professionals
* Government agencies
* Disaster-management teams
* Urban-planning departments
* Agricultural monitoring teams
* Environmental researchers
* Academic researchers
* Students
* Geospatial technology organizations

---

# 7. Core Use Cases

## 7.1 Single-Image VQA

### User

> "What types of land cover are visible in this image?"

### System

The agent identifies the request as a visual question-answering task and routes it to an appropriate remote-sensing VLM.

---

## 7.2 Text-Guided Grounding

### User

> "Where are the buildings?"

### System

The system identifies relevant regions and displays their spatial locations.

---

## 7.3 Bi-Temporal Change Analysis

### User

> "What changed between these two images?"

### System

The system:

1. Validates both images.
2. Checks their spatial compatibility.
3. Identifies the temporal relationship.
4. Selects a change-analysis capability.
5. Produces a change representation.
6. Generates a natural-language explanation.

---

## 7.4 Optical + SAR Analysis

### User

> "Compare these optical and SAR images and identify regions of interest."

The system validates the modalities and performs joint analysis using suitable models/tools.

---

## 7.5 Quantified Change

### User

> "Did the built-up area increase by more than 10%?"

The system combines visual analysis with deterministic geospatial calculations where appropriate.

---

# 8. System Architecture

```text
                       ┌───────────────┐
                       │     User      │
                       └───────┬───────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │ Natural Language    │
                    │ Query Interface     │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Query Understanding│
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Input Validation    │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Agentic Router      │
                    └─────────┬──────────┘
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
        ┌───────────┐   ┌───────────┐   ┌──────────────┐
        │ VQA/VLM   │   │ Grounding │   │ Change Model │
        └─────┬─────┘   └─────┬─────┘   └──────┬───────┘
              │               │                │
              └───────────────┼────────────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Geospatial Tools   │
                    │ Optical + SAR      │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Evidence Validator  │
                    └─────────┬──────────┘
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
          ┌────────┐     ┌──────────┐    ┌───────────┐
          │ Answer │     │Evidence  │    │Confidence │
          └────────┘     └──────────┘    └───────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Execution Trace    │
                    └────────────────────┘
```

---

# 9. Major Components

## 9.1 Query Understanding

The query-understanding component identifies:

* user intent
* required modality
* number of images
* temporal requirements
* requested objects
* desired analytical output

Example:

```text
"What changed between these two images?"

Intent:
Change Analysis

Required:
Two images

Temporal:
Yes

Output:
Change description / localization
```

---

# 9.2 Input Validation

The validation layer checks relevant properties such as:

* File format
* Image availability
* Modality
* Spatial dimensions
* CRS
* Geographic extent
* Temporal compatibility
* Optical/SAR compatibility

This prevents invalid inputs from reaching downstream models.

---

# 9.3 Agentic Router

The router selects appropriate tools based on the query.

Example:

```text
Query
  │
  ├── VQA ───────────────→ VQA Model
  │
  ├── Grounding ─────────→ Grounding Model
  │
  ├── Change ────────────→ Change Model
  │
  ├── Optical + SAR ─────→ Multimodal Tool
  │
  └── Spatial calculation → GIS Tool
```

---

# 9.4 Specialist Models

The system can integrate existing remote-sensing models rather than attempting to train a new foundation model during the hackathon.

Potential research components include:

* GeoChat
* EarthGPT
* EarthDial
* VHM
* DeltaVLM

These models address different aspects of remote-sensing visual-language reasoning.

---

# 9.5 Geospatial Processing

Geospatial processing may include:

* GeoTIFF reading
* Raster manipulation
* CRS inspection
* Spatial alignment
* GeoJSON generation
* Area calculations
* Raster/vector operations

Tools such as Rasterio, GDAL and GeoPandas can support these operations.

---

# 9.6 Evidence Generation

The system should associate answers with observable outputs.

Potential evidence includes:

* Image regions
* Bounding boxes
* Masks
* Change maps
* Before/after comparison
* Spatial statistics
* Model outputs

---

# 9.7 Confidence & Abstention

The system should distinguish between:

```text
High-confidence answer
```

and

```text
Insufficient evidence
```

A reliable remote-sensing assistant should be able to refuse to make a confident claim when:

* imagery is incompatible
* evidence is insufficient
* model confidence is low
* requested analysis is unsupported

---

# 9.8 Execution Trace

Each request can produce a structured trace.

Example:

```text
Query
 ↓
Intent Detection
 ↓
Input Validation
 ↓
Task = Change Analysis
 ↓
Model = Change Model
 ↓
Inference
 ↓
Evidence Generation
 ↓
Confidence Estimation
 ↓
Final Response
```

This provides transparency into the system's reasoning workflow.

---

# 10. Technology Stack

## Frontend

* React / Next.js
* MapLibre or OpenLayers
* HTML/CSS/JavaScript/TypeScript

## Backend

* Python
* FastAPI

## AI

* PyTorch
* Hugging Face
* Remote-sensing VLMs
* Specialist computer-vision models

## Agent

* LangGraph or custom orchestration

## Geospatial

* Rasterio
* GDAL
* GeoPandas
* GeoJSON

## Infrastructure

* Docker
* Git/GitHub

---

# 11. Dataset Strategy

Potential datasets include:

## VRSBench

Useful for:

* VQA
* Captioning
* Grounding

## RSVQA

Useful for natural-language questions over remote-sensing imagery.

## BigEarthNet / BigEarthNet.txt

Useful for:

* Sentinel-1
* Sentinel-2
* multimodal optical-SAR research
* image-text learning

## Change Detection Datasets

Potential resources include datasets associated with:

* LEVIR-CC
* CDVQA
* ChangeChat

These can support temporal reasoning and change-analysis experimentation.

---

# 12. Data Acquisition

Potential real-world sources include:

### Copernicus Data Space

Useful for Sentinel Earth-observation data and APIs.

### Bhuvan

Useful for Indian Earth-observation and geospatial applications.

### Public Research Datasets

Useful for controlled benchmarking and reproducible testing.

---

# 13. MVP Scope

The hackathon MVP should prioritize functional completeness over excessive features.

## MVP Capability 1

Single-image VQA.

```text
Image + Question
       ↓
VLM
       ↓
Answer
```

## MVP Capability 2

Grounding or captioning.

```text
Image + Text Query
       ↓
Model
       ↓
Region / Description
```

## MVP Capability 3

Bi-temporal change analysis.

```text
Image A + Image B
       ↓
Change Model
       ↓
Change Map + Explanation
```

## MVP Capability 4

Optical + SAR analysis.

```text
Optical + SAR
      ↓
Validation
      ↓
Multimodal Analysis
      ↓
Evidence
```

## MVP Capability 5

Agentic orchestration.

```text
Question
   ↓
Router
   ↓
Specialist Tool
   ↓
Evidence
   ↓
Answer
```

---

# 14. Innovation

SatQuery's differentiation should not be based solely on claiming a new Vision-Language Model.

The project focuses on combining existing capabilities into an **agentic, evidence-grounded remote-sensing workflow**.

Key differentiators include:

### 14.1 Query-to-Workflow Translation

Natural-language questions are converted into structured analytical tasks.

### 14.2 Specialist Model Routing

Different models/tools can be selected for different tasks.

### 14.3 Multimodal Reasoning

Optical and SAR imagery can be incorporated into the same workflow.

### 14.4 Temporal Reasoning

The system supports analysis of imagery captured at different times.

### 14.5 Evidence-Grounded Responses

Answers can be connected to visual and spatial evidence.

### 14.6 Transparent Execution

The user can inspect the workflow used to produce an answer.

---

# 15. Existing Solutions & Research

SatQuery exists within an active research ecosystem.

Important related systems include:

| Project               | Primary Focus                                          |
| --------------------- | ------------------------------------------------------ |
| GeoChat               | Conversational remote-sensing VLM                      |
| EarthGPT              | Remote-sensing multimodal reasoning                    |
| EarthDial             | Interactive multimodal EO dialogue                     |
| VHM                   | Remote-sensing VLM with emphasis on reliable answering |
| DeltaVLM              | Interactive temporal change analysis                   |
| VRSBench              | Remote-sensing VLM benchmark                           |
| RSVQA                 | Remote-sensing VQA                                     |
| Bhuvan                | Indian geospatial platform                             |
| Copernicus Data Space | EO data access and processing                          |

SatQuery's intended contribution is the integration of these types of capabilities into a unified agentic workflow.

---

# 16. Competitor Positioning

A useful conceptual distinction is:

```text
Satellite Image Retrieval
        │
        ├── Semantic Search
        │
        └── Image Retrieval Systems
                    │
                    ▼
             SATELLITE AI
                    │
                    ▼
          Remote-Sensing Analysis
                    │
                    ├── VQA
                    ├── Grounding
                    ├── Change
                    ├── Optical + SAR
                    ├── Spatial Analysis
                    └── Evidence
```

SatQuery should therefore avoid positioning itself simply as a "chatbot for satellite images."

The stronger positioning is:

> **An agentic remote-sensing reasoning system that converts natural-language queries into validated multimodal analytical workflows.**

---

# 17. Evaluation Framework

## 17.1 VQA

Measure:

* Answer accuracy
* Semantic correctness
* Human evaluation where required

## 17.2 Grounding

Measure:

* IoU
* Localization accuracy

## 17.3 Change Detection

Measure:

* Precision
* Recall
* F1
* IoU

## 17.4 Agent Routing

Measure:

```text
Correct Tool Selection
----------------------
Total Queries
```

## 17.5 Reliability

Measure:

* unsupported-query rate
* hallucination rate
* incorrect-routing rate
* validation failures
* abstention quality

## 17.6 Performance

Measure:

* inference latency
* total response time
* memory usage
* GPU utilization where applicable

---

# 18. Potential Challenges

## 18.1 Model Hallucination

Remote-sensing VLMs may produce fluent but incorrect descriptions.

### Mitigation

Use evidence, confidence and specialist outputs.

---

## 18.2 Optical-SAR Misalignment

Incorrect alignment can result in misleading multimodal analysis.

### Mitigation

Perform geospatial validation before fusion.

---

## 18.3 Large Image Size

Satellite imagery can contain very large spatial areas.

### Mitigation

Use:

* tiling
* cropping
* region-of-interest processing
* hierarchical analysis

---

## 18.4 Compute Requirements

Large VLMs may require significant GPU resources.

### Mitigation

Use:

* pretrained models
* quantization where appropriate
* smaller models for routing
* specialist models only when required
* cached inference

---

## 18.5 Data Availability

The evaluation data may differ from public training datasets.

### Mitigation

Design the system around modular model interfaces and prepare representative public/synthetic test cases for development.

---

# 19. Scalability

The architecture is intended to be modular.

New tools can be added without replacing the entire system.

For example:

```text
Current

VQA
Grounding
Change
Optical-SAR
```

can later become:

```text
VQA
Grounding
Change
Optical-SAR
Flood Detection
Crop Analysis
Forest Monitoring
Building Detection
Road Extraction
Disaster Assessment
```

The agent can select newly registered tools based on task requirements.

---

# 20. Future Enhancements

Future versions could include:

* Live satellite-data discovery
* Automated AOI selection
* Real-time Sentinel imagery retrieval
* Hyperspectral analysis
* Disaster-response workflows
* Agricultural intelligence
* Urban-growth monitoring
* Automated geospatial reporting
* Multi-agent specialist collaboration
* Cloud-based large-scale processing
* Continuous monitoring and alerts

---

# 21. Expected Impact

SatQuery can reduce the technical barrier associated with remote-sensing analysis.

### Social Impact

Makes advanced Earth-observation analysis more accessible.

### Government Impact

Can support:

* disaster response
* infrastructure monitoring
* urban planning
* environmental monitoring

### Research Impact

Provides a unified interface for experimenting with multiple remote-sensing AI capabilities.

### Economic Impact

Can reduce manual analysis time and enable faster geospatial decision-making.

---

# 22. Security & Privacy Considerations

The system should:

* avoid exposing API keys
* validate uploaded files
* restrict unsafe file processing
* isolate model execution where appropriate
* log system actions without unnecessarily storing sensitive data
* apply access control in production deployments

---

# 23. Project Limitations

The prototype may have limitations related to:

* GPU availability
* model latency
* training-data coverage
* remote-sensing domain generalization
* SAR interpretation complexity
* image registration
* dataset differences
* model hallucination
* large-scale deployment costs

These limitations should be clearly communicated rather than hidden.

---

# 24. Conclusion

SatQuery AI proposes an agentic interface for interacting with remote-sensing imagery through natural language.

The central idea is not simply to place a chatbot on top of satellite images.

Instead, SatQuery aims to create a workflow in which:

```text
Natural Language
       ↓
Task Understanding
       ↓
Geospatial Validation
       ↓
Specialist Model Selection
       ↓
Multimodal Analysis
       ↓
Evidence
       ↓
Confidence
       ↓
Transparent Answer
```

This architecture provides a foundation for making complex remote-sensing analysis more accessible while preserving the specialist tools and geospatial reasoning required for reliable results.

---

# 25. References

1. GeoChat — Remote-Sensing Vision-Language Model
2. EarthGPT — Large Language Model for Remote Sensing
3. EarthDial — Multimodal Earth Observation Dialogue
4. VHM — Remote-Sensing Vision-Language Model
5. DeltaVLM — Interactive Multi-Temporal Change Analysis
6. VRSBench — Remote-Sensing Vision-Language Benchmark
7. RSVQA — Remote-Sensing Visual Question Answering
8. BigEarthNet / BigEarthNet.txt
9. Copernicus Data Space Ecosystem
10. ISRO Bhuvan

---

<div align="center">

## 🛰️ SatQuery AI

### Ask Questions. Analyze Earth. See the Evidence.

**SIH26167**

</div>
