# Remote-Sensing Domain Adaptation Specification

## 1. Overview and Problem Context

SatQuery-AI is an interactive vision-language assistant for remote sensing image analysis, addressing **Smart India Hackathon 2026 Problem ID 26167**. General-domain vision-language models (VLMs) like Gemini and Qwen are trained primarily on terrestrial photography. Remote sensing images differ fundamentally from standard photography:
- **Nadir / off-nadir viewing geometry**: Top-down perspective rather than perspective projection.
- **Multispectral / Multimodal bands**: Beyond standard RGB, remote sensing incorporates near-infrared (NIR), short-wave infrared (SWIR), and Synthetic Aperture Radar (SAR: VV/VH polarizations).
- **Domain-specific semantics**: Land-use/land-cover classes (e.g. CORINE Land Cover) exhibit fine-grained visual distinctions that do not exist in consumer photography.

To satisfy the SIH requirement for **domain-adapted remote sensing analysis**, SatQuery-AI establishes a reproducible, production-grade adaptation framework based on **BigEarthNet** (the European Space Agency benchmark archive).

---

## 2. Adaptation Lifecycle and Verifiable Status

In accordance with scientific integrity and SIH evaluation standards, SatQuery-AI strictly distinguishes four distinct phases of domain adaptation:

| Lifecycle Phase | Description | SatQuery Status | Verification Mechanism |
| :--- | :--- | :--- | :--- |
| **A. Adaptation Pipeline Implemented** | Codebase contains full dataset parsers, taxonomy mappers, training loop, and CLI. | **COMPLETED** | `backend/ml/dataset.py`, `backend/ml/pipeline.py`, `backend/ml/train.py` |
| **B. Adaptation Training Executed** | Training loop executed on a GPU-enabled compute cluster. | **TRAINING_REQUIRED** | Offline execution required on compute cluster with GPU/TPU resources. |
| **C. Checkpoint Verified** | Saved adapter weights exist on disk and match SHA-256 hash in `checkpoint.json`. | **TRAINING_REQUIRED** | `RemoteSensingAdaptationPipeline.get_current_state()` |
| **D. Adapted Model in Inference** | Online inference adapter loads verified weights and applies them during user queries. | **TRAINING_REQUIRED** | `RemoteSensingInferenceAdapter.predict()` |

> [!IMPORTANT]
> SatQuery-AI **never** claims that an un-adapted foundation model has been fine-tuned. Without verified weights on disk, the system honestly reports `TRAINING_REQUIRED` with `confidence = 0.0`.

---

## 3. Dataset Specification: BigEarthNet-v1.0

### Benchmark Reference
- **Citation**: Sumbul, G., Charfuelan, M., de Wall, B., & Demır, B. (2019). *BigEarthNet: A Large-Scale Benchmark Archive for Remote Sensing Image Understanding*. IEEE International Geoscience and Remote Sensing Symposium (IGARSS).
- **Scale**: 590,326 Sentinel-2 L2A optical image patches acquired over 10 European countries.
- **Resolution**: 120x120 pixels at 10m Ground Sampling Distance (GSD).
- **Multimodal Extension**: BigEarthNet-MM pairs Sentinel-2 optical tiles with Sentinel-1 dual-polarization (VV/VH) SAR acquisitions.

### CORINE Land Cover (CLC) 19-Class Taxonomy
SatQuery-AI aligns with the official 19-class BigEarthNet nomenclature and maps them directly to high-level query semantics:

| CLC-19 Class Name | SatQuery Category | Sensor Sensitivity |
| :--- | :--- | :--- |
| `Urban fabric` | `built-up` | High optical reflectance; high SAR double-bounce backscatter |
| `Industrial or commercial units` | `built-up` | High optical reflectance; high SAR double-bounce backscatter |
| `Arable land` | `agricultural_land` | Strong seasonal NDVI; low/medium SAR backscatter |
| `Permanent crops` | `agricultural_land` | Persistent NDVI; directional row backscatter |
| `Pastures` | `vegetation` | Moderate NDVI; volume scattering |
| `Complex cultivation patterns` | `agricultural_land` | Heterogeneous spectral reflectance |
| `Land principally occupied by agriculture...` | `agricultural_land` | Mixed agricultural/natural vegetation signature |
| `Agro-forestry areas` | `vegetation` | Mixed tree/canopy NDVI |
| `Broad-leaved forest` | `vegetation` | High NIR reflectance; volume backscatter |
| `Coniferous forest` | `vegetation` | Lower NIR reflectance; high cross-polarization (VH) backscatter |
| `Mixed forest` | `vegetation` | Composite optical and radar signatures |
| `Natural grassland and sparsely vegetated areas` | `vegetation` | Variable spectral response |
| `Moors, heathland and sclerophyllous vegetation` | `vegetation` | Low-profile woody vegetation signature |
| `Transitional woodland, shrub` | `vegetation` | Regenerating shrub signature |
| `Beaches, dunes, sands` | `bare_land` | High optical brightness; low diffuse radar backscatter |
| `Inland wetlands` | `water` | High moisture absorption; specular radar reflection |
| `Coastal wetlands` | `water` | Tidal inundation variations |
| `Inland waters` | `water` | Near-zero NIR reflectance; specular radar return (dark) |
| `Marine waters` | `water` | Near-zero NIR reflectance; specular radar return (dark) |

---

## 4. Adaptation Architecture and Loss Function

### Adapter Design: Multi-Label Linear Probe & LoRA
To adapt foundation models without catastrophic forgetting:
- **Vision Backbone**: `siglip-so400m-patch14-384` or `Qwen2.5-VL-7B-Instruct` vision encoder.
- **LoRA Rank**: $r = 16$, $\alpha = 32$, targeting attention projection layers ($W_q, W_k, W_v, W_o$).
- **Classification Head**: Multi-label sigmoid classifier producing independent probabilities across the 19 CLC classes:
  $$\mathcal{L}_{\text{BCE}} = -\sum_{c=1}^{19} \left[ y_c \log \sigma(\hat{y}_c) + (1 - y_c) \log (1 - \sigma(\hat{y}_c)) \right]$$
- **Class-Balanced Weighting**: Multi-label focal loss or positive weight vector $w_c = \frac{N - N_c}{N_c}$ to mitigate severe class imbalance in rare categories (e.g., *Beaches, dunes, sands*).

---

## 5. Reproducible Training CLI

The standalone training script is located at [`backend/ml/train.py`](file:///c:/SatQuery-AI/backend/ml/train.py).

### Usage Instructions

```bash
# 1. Acquire the official BigEarthNet dataset from bigearth.net
# 2. Run the adaptation training pipeline on a GPU cluster:
python -m backend.ml.train \
    --dataset-index /path/to/BigEarthNet.txt \
    --data-dir /path/to/BigEarthNet-v1.0/ \
    --output-dir checkpoints/bigearthnet_adapter \
    --epochs 10 \
    --batch-size 32 \
    --learning-rate 0.0001

# 3. For verification without execution (dry-run):
python -m backend.ml.train \
    --dataset-index /path/to/BigEarthNet.txt \
    --data-dir /path/to/BigEarthNet-v1.0/ \
    --dry-run
```

---

## 6. Verification Protocol

When training finishes, a verifiable manifest `checkpoints/bigearthnet_adapter/checkpoint.json` is generated:

```json
{
  "checkpoint_id": "bigearthnet_siglip_lora_r16_20260907",
  "model_config": {
    "architecture": "linear_probe_lora",
    "backbone": "siglip-so400m-patch14-384",
    "num_classes": 19
  },
  "state": "checkpoint_verified",
  "dataset_name": "BigEarthNet-S2",
  "dataset_patch_count": 590326,
  "epochs_trained": 10,
  "validation_micro_f1": 0.864,
  "validation_macro_f1": 0.778,
  "weights_filename": "adapter_weights.safetensors",
  "weights_sha256": "4a7b8c...",
  "training_timestamp": "2026-09-07T12:00:00Z"
}
```

The online inference adapter (`RemoteSensingInferenceAdapter`) dynamically re-verifies this SHA-256 hash before loading weights into memory, guaranteeing that only authentic, evaluated checkpoints are used.
