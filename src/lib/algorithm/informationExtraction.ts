/*
 * Module 3: Information Extraction.
 * This file will use the local DistilXLM-R model to extract issue and polarity
 * from cleaned feedback text.
 */

import type { IssueExtractionResult } from "./types";

const KEYWORD_MAP: Record<string, string[]> = {
  "relational coldness": ["snob", "aloof", "suplado", "suplada", "deadma", "interaction", "connection", "unfriendly", "mood"],
  "classroom tension": ["scary", "takot", "terror", "galit", "strict", "intense", "pressure", "tension", "vibe"],
  "evaluation unfairness": ["unfair", "bias", "partial", "grades", "score", "mataas", "mababa", "luge", "paborito"],
  "perceived marginalization": ["ignore", "invisible", "extra", "quiet", "tahimik", "listen", "voices", "participation", "balewala"],
  "subject alienation": ["boring", "irrelevant", "useless", "why", "real-life", "apply", "kailangan", "meaning", "purpose"],
  "peer distraction": ["noisy", "classmates", "maingay", "chat", "gulo", "disturb", "focus", "group", "distraction"],
  "instructional cadence": ["fast", "slow", "mabilis", "mabagal", "pacing", "speed", "time", "bilis", "cadence"],
  "clarity deficit": ["confusing", "malabo", "explain", "slides", "materials", "examples", "clarify", "clear", "deficit"],
  "abstract logic gap": ["logic", "theory", "math", "algorithm", "complex", "deep", "structure", "hard", "gap"],
  "procedural bottleneck": ["steps", "process", "how", "execute", "implementation", "code", "run", "method", "bottleneck"],
  "conceptual misalignment": ["basic", "fundamental", "confused", "wrong", "mistake", "foundation", "thought", "misaligned"],
  "design synthesis failure": ["build", "project", "design", "combine", "whole", "structure", "create", "architect", "failure"],
  "feedback latency": ["late", "delayed", "tagal", "results", "comments", "check", "wait", "feedback", "latency"],
  "notation struggle": ["syntax", "symbols", "semicolon", "braces", "variables", "naming", "sign", "notation", "programming"]
};

export function ExtractPID(cleanText: string): IssueExtractionResult {
  console.debug("[informationExtraction] Extracting PID deterministically", { cleanText });
  
  const textLower = cleanText.toLowerCase();

  for (const [issueTag, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        return { issue: issueTag, polarity: "neg" };
      }
    }
  }

  return {
    issue: "Uncategorized",
    polarity: "neu",
  };
}
