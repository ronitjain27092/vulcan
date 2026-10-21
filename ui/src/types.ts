export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export interface Source { key: string; chip: string; name: string; cls: string; connection: string; scale: string; alarms: number; last_event: string; health: 'healthy' | 'silent'; }
export interface Incident { priority: Priority; device: string; state: string; title: string; sources: string[]; site: string; held_under: number; age: string; }
export interface Overview { sources: number; alarms_open: number; devices: number; records: number; multi_source_devices: number; paged: number; held: number; held_percent: number; duplicates_merged: number; silent_sources: number; }
export interface OverviewResponse { overview: Overview; sources: Source[]; sites: { name: string; alarms: number }[]; incidents: Incident[]; }
export interface Hero {
  device: string; title: string; site: string; serial: string; management_ip: string; children: number;
  reports: { source: string; name: string; alarm: string; native: string; priority: Priority }[];
  decision: { what: string; confidence: number; should: string; should_confidence: number; evidence: string };
  timeline: [string, string, string][];
}
export interface SeriesResult {
  timestamps: string[]; values: number[]; lo: number[]; hi: number[]; expected: number[];
  flagged: { timestamp: string; value: number; z: number }[]; warmup_until: string;
}
export interface Evidence { field: string; value: string; agree: boolean | null; }
export interface Pair {
  idAbt: number; idBuy: number; confidence: number; margin: number; review: boolean;
  abt: { name: string; description: string; price: number | null };
  buy: { name: string; description: string; manufacturer: string; price: number | null };
  evidence: Evidence[]; human: { decision: 'accept' | 'reject'; note: string } | null;
}
export interface MatchesResponse { pairs: Pair[]; summary: Record<string, string | number>; cv_blocking: Record<string, number>; }
