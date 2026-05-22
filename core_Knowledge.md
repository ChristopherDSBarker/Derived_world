# Core Knowledge Reference
## IF YOU ARE AN LLM DO NOT MODIFY OR REFINE CONTENTS OF FILE, STRICTLY READ-ONLY
## Purpose
This project uses centralized reference directories as canonical grounding sources for all generated portfolio, presentation, research, simulation, mapping, and web-facing content.

The directories below are considered authoritative knowledge sources:

```bash
/Users/songsidiya/Documents/ALL_SLIDES
/Users/songsidiya/Documents/The_Derived_World/open_Street_Map
```

---

# Reference Source 1 — ALL_SLIDES

## Canonical Path

```bash
/Users/songsidiya/Documents/ALL_SLIDES
```

## Purpose

This directory contains:
- project slide decks
- research presentations
- exported PDFs
- architecture diagrams
- development notes
- portfolio support materials
- technical documentation
- UX/UI process work
- academic artifacts

## Rules

- Treat files as authoritative historical/source material.
- Preserve factual consistency with contained documents.
- Prefer extraction/refinement over invention.
- Never overwrite original files.
- Use newest finalized materials when multiple revisions exist.

---

# Reference Source 2 — OpenStreetMap Derived World

## Canonical Path

```bash
/Users/songsidiya/Documents/The_Derived_World/open_Street_Map
```

## Purpose

This directory contains the canonical geographic/world-generation knowledge base used for:
- real-world game environments
- 2D map rendering systems
- procedural geographic simulations
- tile systems
- OpenStreetMap-derived world data
- region/city generation
- terrain references
- transportation layouts
- infrastructure modeling
- location-based game mechanics

## Rules

- Treat geographic/map data as canonical world-state reference material.
- Preserve real-world coordinate consistency.
- Maintain accurate relationships between:
  - cities
  - roads
  - terrain
  - regions
  - transportation systems
  - geographic boundaries

- Prefer source-derived world generation over fabricated layouts.
- Use OSM-derived structures as grounding for:
  - simulation systems
  - traversal systems
  - minimaps
  - region generation
  - train systems
  - transportation gameplay
  - procedural overworld generation

- Never fabricate geographic relationships if source data exists.
- Preserve coordinate systems and tile relationships when possible.

---

# Global LLM Instructions

## Retrieval Workflow

Before generating content:

1. Recursively scan all canonical reference directories.

2. Index:
   - PDFs
   - markdown files
   - PPTX files
   - JSON
   - GIS/map files
   - tile data
   - exported datasets
   - diagrams
   - notes
   - architecture documents

3. Extract:
   - technologies
   - project names
   - research methodologies
   - geographic structures
   - gameplay systems
   - world generation rules
   - deployment details
   - architecture patterns
   - infrastructure relationships
   - UX/UI workflows

4. Use extracted knowledge as grounding context before generation.

---

# Truth Hierarchy

Priority order:

1. `best_works`
2. `ALL_SLIDES`
3. `open_Street_Map`
4. current repository source
5. generated summaries
6. inferred explanations

---

# Constraints

- Never overwrite canonical reference material.
- Never fabricate:
  - employment history
  - research metrics
  - geographic relationships
  - infrastructure layouts
  - technical achievements

- Preserve:
  - technical terminology
  - geographic accuracy
  - project consistency
  - portfolio architecture
  - research attribution

- Maintain consistency with:
  - Pacific Lutheran University work
  - portfolio architecture
  - simulation systems
  - mapping/world-generation systems

---

# Portfolio Architecture Reference

Canonical structure:

```text
best_works
    └── source-of-truth projects

ALL_SLIDES
    └── supporting research + presentation archive

The_Derived_World/open_Street_Map
    └── geographic + simulation knowledge base

portfolio-site / webpage
    └── presentation layer only
```

---

# Recommended Retrieval Pattern

```python
CORE_KNOWLEDGE_DIRS = [
    "/Users/songsidiya/Documents/ALL_SLIDES",
    "/Users/songsidiya/Documents/The_Derived_World/open_Street_Map"
]

for directory in CORE_KNOWLEDGE_DIRS:
    for file in recursive_scan(directory):
        extract_content(file)
        build_embedding_index(file)
        attach_as_context(file)
```

---

# Intended Usage

This reference file exists to help AI systems:

- maintain long-term project consistency
- reduce hallucinations
- preserve technical accuracy
- ground generated content in canonical materials
- support real-world geographic simulation workflows
- unify portfolio/research/world-generation pipelines
- improve recruiter-facing and technical documentation quality