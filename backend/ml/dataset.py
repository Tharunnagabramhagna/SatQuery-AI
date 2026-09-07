"""BigEarthNet Dataset Loader and Taxonomy Specification for SatQuery AI.

Defines the official BigEarthNet multimodal remote-sensing dataset structure
and CORINE Land Cover (CLC) 19-class taxonomy mapping without fabricating data.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Union

logger = logging.getLogger("satquery.ml.dataset")

# Official CORINE Land Cover (CLC) 19-class nomenclature for BigEarthNet
# Reference: Sumbul et al., "BigEarthNet: A Large-Scale Benchmark Archive for Remote Sensing Image Understanding", IEEE IGARSS 2019.
BIGEARTHNET_19_CLASSES: List[str] = [
    "Urban fabric",
    "Industrial or commercial units",
    "Arable land",
    "Permanent crops",
    "Pastures",
    "Complex cultivation patterns",
    "Land principally occupied by agriculture, with significant areas of natural vegetation",
    "Agro-forestry areas",
    "Broad-leaved forest",
    "Coniferous forest",
    "Mixed forest",
    "Natural grassland and sparsely vegetated areas",
    "Moors, heathland and sclerophyllous vegetation",
    "Transitional woodland, shrub",
    "Beaches, dunes, sands",
    "Inland wetlands",
    "Coastal wetlands",
    "Inland waters",
    "Marine waters",
]

# Mapping from BigEarthNet classes to SatQuery semantic change categories
BIGEARTHNET_TO_SATQUERY_TAXONOMY: Dict[str, str] = {
    "Urban fabric": "built-up",
    "Industrial or commercial units": "built-up",
    "Arable land": "agricultural_land",
    "Permanent crops": "agricultural_land",
    "Pastures": "vegetation",
    "Complex cultivation patterns": "agricultural_land",
    "Land principally occupied by agriculture, with significant areas of natural vegetation": "agricultural_land",
    "Agro-forestry areas": "vegetation",
    "Broad-leaved forest": "vegetation",
    "Coniferous forest": "vegetation",
    "Mixed forest": "vegetation",
    "Natural grassland and sparsely vegetated areas": "vegetation",
    "Moors, heathland and sclerophyllous vegetation": "vegetation",
    "Transitional woodland, shrub": "vegetation",
    "Beaches, dunes, sands": "bare_land",
    "Inland wetlands": "water",
    "Coastal wetlands": "water",
    "Inland waters": "water",
    "Marine waters": "water",
}


@dataclass
class BigEarthNetPatchMetadata:
    """Metadata representing a single BigEarthNet patch."""

    patch_name: str
    sentinel2_bands: List[str] = field(default_factory=list)
    sentinel1_polarizations: List[str] = field(default_factory=list)
    labels_clc19: List[str] = field(default_factory=list)
    satquery_categories: Set[str] = field(default_factory=set)


class BigEarthNetIndexReader:
    """
    Parses BigEarthNet index files (e.g. BigEarthNet.txt or split manifests)
    without fabricating files or labels.
    """

    @classmethod
    def read_index(cls, index_path: Union[str, Path]) -> List[str]:
        """
        Read patch identifiers from a BigEarthNet index file.

        Raises FileNotFoundError if index_path does not exist.
        """
        p = Path(index_path)
        if not p.is_file():
            raise FileNotFoundError(
                f"BigEarthNet index file not found at: '{index_path}'. "
                "Official BigEarthNet index manifests must be acquired from bigearth.net "
                "or the official European Space Agency archive."
            )

        patch_names = []
        with open(p, "r", encoding="utf-8") as f:
            for line in f:
                cleaned = line.strip()
                if cleaned and not cleaned.startswith("#"):
                    patch_names.append(cleaned)

        logger.info("Loaded %d patch references from %s", len(patch_names), p.name)
        return patch_names

    @classmethod
    def map_to_satquery_categories(cls, clc_labels: List[str]) -> Set[str]:
        """Map a set of CLC-19 labels to SatQuery high-level categories."""
        categories = set()
        for label in clc_labels:
            cat = BIGEARTHNET_TO_SATQUERY_TAXONOMY.get(label)
            if cat:
                categories.add(cat)
            else:
                categories.add("unknown")
        return categories
