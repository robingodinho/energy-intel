# Energy-Intel: U.S. Energy Policy Intelligence Platform (Next.js 14)

## Overview

**Energy-Intel** is an AI-powered energy intelligence platform designed to serve as a **centralized, continuously updated reference hub for U.S. energy policymakers, analysts, and policy-adjacent decision-makers**.

The platform aggregates, summarizes, and categorizes near real-time **U.S. energy policy, regulatory, and infrastructure-relevant developments**, reducing information fragmentation and enabling faster, evidence-based decision-making on issues critical to:

- U.S. energy security  
- Grid reliability and infrastructure planning  
- Energy affordability and market stability  
- Environmental and regulatory compliance  

Rather than reacting to user traffic, Energy-Intel operates as a **pre-processed intelligence system**, ensuring that decision-makers always access **policy-ready summaries**.

> **Version constraint (important):** This repository is designed for **Next.js 14.x**. Do **not** upgrade to Next.js 15+.

---

## Mission & Policy Alignment

**Mission:**  
To support U.S. energy policy formulation and infrastructure decision-making by providing a centralized, AI-driven intelligence platform that delivers timely, authoritative references to energy policies, regulatory actions, and sector-critical developments of national interest.

**Policy Gap Addressed:**  
Energy-related information is often:
- Fragmented across agencies and publications
- Released faster than traditional policy analysis cycles
- Difficult to synthesize at scale

Energy-Intel addresses this gap by **automating ingestion and synthesis**, allowing policymakers and analysts to focus on interpretation rather than information discovery.

---

## Core Design Goals

1. **Timeliness**
   - Near real-time ingestion of official energy policy sources
   - Scheduled updates independent of user activity

2. **Reliability**
   - Stable feeds even when upstream sources fluctuate
   - Pre-processed data ensures consistent availability

3. **Cost-Efficient AI Usage**
   - AI summarization runs once per article
   - No AI calls during page render or user interaction

4. **Policy-Ready Clarity**
   - Summaries emphasize regulatory impact and national relevance
   - Clean architecture for transparency and reviewability

---

## High-Level Architecture

```
Official U.S. Energy Policy Sources
(FERC, EPA, DOE, EIA)
        ↓
Scheduled Ingestion (Cron)
        ↓
AI Summarization & Categorization
        ↓
Policy-Ready Database Storage
        ↓
Fast Read-Only API
        ↓
Web Interface (Instant Load)
```

---

## Technology Stack

### Frontend
- **Next.js 14.x** (App Router)
- TypeScript
- Tailwind CSS

### Backend
- Next.js Serverless API Routes
- Scheduled ingestion via **Vercel Cron**

### Data & Storage
- Supabase Postgres
- Indexed for fast reads, sorting, and filtering

### AI Capabilities
- OpenAI API (model configurable via environment variables)
- Policy-focused summarization and topic classification

### Deployment
- Vercel (free-tier compatible)

---

## Data Sources

Energy-Intel ingests data exclusively from **authoritative, official U.S. government sources**, including:
- Federal Energy Regulatory Commission (FERC)
- Environmental Protection Agency (EPA)
- Department of Energy (DOE)
- Energy Information Administration (EIA)

---

## Local Development

```bash
npm install
npm run dev
```

---

## Purpose & Evaluation Context

Energy-Intel is a **live, verifiable system** demonstrating applied expertise in AI-powered regulatory intelligence, energy policy monitoring, and cost-aware data engineering.
