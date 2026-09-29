/**
 * mappers.test.ts — React/Vite quality gate for the evidence->view-model mapping layer.
 *
 * Runs all 8 backend payload fixtures (groq_ok, fallback_no_key, rejected_then_fallback,
 * alert_active, u1_expired_not_active, unavailable, abstain, clarify) and asserts the
 * frontend mapping preserves the backend safety invariants:
 *  - no value is invented for absent evidence (gaps stay undefined);
 *  - expired alerts NEVER appear in the active alert list;
 *  - official alerts keep precedence (risk HIGH, alert id cited, instruction present);
 *  - weather is labelled Open-Meteo research/repro — never "IMD official";
 *  - abstain/clarify surface the backend reason/question, not a weather card;
 *  - the "unavailable" alert state is UNCERTAIN and not mistaken for "no alerts";
 *  - deterministic-fallback answers are attributed to the fallback, not the LLM.
 */
import { describe, it, expect } from 'vitest';
import { FIXTURES } from './mappers.fixtures';
import type { BackendQueryResponse } from '../types/backend';
import {
  mapQueryResponse,
  mapToChatMessage,
  mapEvidence,
  mapHourly,
  mapAlerts,
  mapAdvisory,
  mapClimate,
  detectLanguage,
} from './mappers';

const fx = (name: string): BackendQueryResponse => FIXTURES[name] as BackendQueryResponse;

describe('mapQueryResponse — grounded states', () => {
  it('groq_ok: maps real numbers verbatim and labels source as Open-Meteo research/repro', () => {
    const view = mapQueryResponse(fx('groq_ok'));
    expect(view.status).toBe('grounded');
    expect(view.evidence?.temperature).toBe(25.8);
    expect(view.evidence?.windSpeed).toBe(12.4);
    expect(view.evidence?.source).toBe('Open-Meteo');
    expect(view.evidence?.authority).toBe('research_repro');
    // never labelled IMD:
    expect(view.evidence?.source).not.toBe('IMD');
    expect(JSON.stringify(view.evidence)).not.toMatch(/IMD Official/i);
    // absent provider fields are not invented:
    expect(view.evidence?.uvIndex).toBeUndefined();
    expect(view.evidence?.visibility).toBeUndefined();
    expect(view.evidence?.pressure).toBeUndefined(); // not in the fixture current block
  });

  it('maps hourly and daily blocks from the provider only (no padding)', () => {
    const view = mapQueryResponse(fx('groq_ok'));
    expect(view.hourly).toHaveLength(2);
    expect(view.hourly[0].temp).toBe(26.0);
    const labels = view.daily.map((d) => d.dayName);
    expect(labels).toContain('Today');
    // No invented 7-day row beyond the provided today block:
    expect(view.daily.length).toBeLessThanOrEqual(3);
    // mapper directly:
    expect(mapHourly(undefined)).toEqual([]);
    expect(mapHourly(null)).toEqual([]);
  });

  it('fallback_no_key: deterministic fallback answer is attributed honestly', () => {
    const view = mapQueryResponse(fx('fallback_no_key'));
    expect(view.answer?.origin).toBe('deterministic_fallback');
    expect(view.answer?.grounding.llm_status).toBe('no_key');
    const msg = mapToChatMessage(view, 'weather in pune');
    expect(msg.queryAnalysis?.answerOrigin).toBe('deterministic_fallback');
    expect(msg.queryAnalysis?.groundingVerified).toBe(true);
  });

  it('rejected_then_fallback: a rejected hallucinated number still yields the fallback text', () => {
    const view = mapQueryResponse(fx('rejected_then_fallback'));
    expect(view.answer?.origin).toBe('deterministic_fallback');
    expect(view.answer?.grounding.regenerated).toBe(true);
    expect(view.answer?.grounding.numbers_rejected).toContain('31.4 °c');
    // the rejected number must not leak into the shown message:
    expect(view.message).not.toContain('31.4');
  });
});

describe('mapQueryResponse — official alert precedence', () => {
  it('alert_active: active official alert leads, is cited, and risk is HIGH', () => {
    const view = mapQueryResponse(fx('alert_active'));
    expect(view.alerts).toHaveLength(1);
    const alert = view.alerts[0];
    expect(alert.validity).toBe('active');
    expect(alert.severity).toBe('Severe'); // verbatim CAP severity
    expect(alert.isOfficial).toBe(true);
    expect(alert.instruction).toContain('Please follow SDMA guidelines');
    expect(view.risk).toBe('HIGH');
    expect(view.advisory?.alertIds).toContain('IN-50');
    expect(view.advisory?.riskLevel).toBe('HIGH');
    expect(view.advisory?.rulesFired).toContain('R1_active_severe_official_alert');
    // weather evidence still labelled research/repro, alert labelled official:
    expect(view.evidence?.source).toBe('Open-Meteo');
    expect(alert.source).toBe('NDMA SACHET');
  });

  it('u1_expired_not_active: expired alert never appears in the active list', () => {
    const view = mapQueryResponse(fx('u1_expired_not_active'));
    expect(view.alerts).toHaveLength(0);
    expect(view.expiredAlerts).toHaveLength(1);
    expect(view.expiredAlerts[0].id).toBe('IN-OLD');
    expect(view.expiredAlerts[0].validity).toBe('expired');
    // the expired instruction is carried only in the transparency bucket:
    const expired = JSON.stringify(view.expiredAlerts);
    expect(expired).toContain('expired instruction');
    expect(JSON.stringify(view.alerts)).not.toContain('expired instruction');
  });

  it('unavailable: alert source unreachable => UNCERTAIN, never "no alerts"', () => {
    const view = mapQueryResponse(fx('unavailable'));
    expect(view.alertsState).toBe('unavailable');
    expect(view.risk).toBe('UNCERTAIN');
    expect(view.advisory?.riskLevel).toBe('UNCERTAIN');
    expect(view.alerts).toHaveLength(0);
    // The message must not promise clear conditions:
    expect(view.message.toLowerCase()).not.toMatch(/no alert|all clear/);
  });
});

describe('mapQueryResponse — abstain / clarify', () => {
  it('abstain: surfaces the abstention reason, LOW quality, no confident weather', () => {
    const view = mapQueryResponse(fx('abstain'));
    expect(view.status).toBe('abstain');
    expect(view.abstainReason).toMatch(/could not verify/i);
    expect(view.quality).toBe('LOW');
    expect(view.risk).toBe('UNCERTAIN');
    // evidence record exists (for the drawer) but the message is the abstention:
    expect(view.message).toMatch(/will not guess|could not verify/i);
  });

  it('clarify: surfaces the clarification question and no fabricated weather', () => {
    const view = mapQueryResponse(fx('clarify'));
    expect(view.status).toBe('clarify');
    expect(view.clarification).toMatch(/multiple places/i);
    // weather was null in this payload -> no current-conditions evidence mapped:
    expect(mapEvidence(fx('clarify').evidence)).toBeUndefined();
    expect(view.alerts).toHaveLength(0);
  });
});

describe('mapAlerts / mapAdvisory direct contracts', () => {
  it('splits active vs expired and preserves CAP severity verbatim', () => {
    const ev = fx('alert_active').evidence;
    const { active, expired } = mapAlerts(ev);
    expect(active[0].severity).toBe('Severe');
    expect(expired).toHaveLength(0);
    const e2 = mapAlerts(fx('u1_expired_not_active').evidence);
    expect(e2.active).toHaveLength(0);
    expect(e2.expired[0].validity).toBe('expired');
  });

  it('fixture_replay alerts are badged SAMPLE and never presented as live official', () => {
    const ev = fx('alert_active').evidence;
    // Simulate the backend replaying ALERT_FIXTURE_RSS (mode flips to fixture_replay).
    const fixtureEv = {
      ...ev,
      alerts: { ...ev.alerts, mode: 'fixture_replay' as const },
    };
    const { active } = mapAlerts(fixtureEv);
    expect(active[0].isSample).toBe(true);
    expect(active[0].isOfficial).toBe(false);
    expect(active[0].source).toContain('SAMPLE FIXTURE');
    expect(active[0].title).toContain('[SAMPLE FIXTURE]');
    // live mode is NOT badged
    const live = mapAlerts(ev).active[0];
    expect(live.isSample).toBeFalsy();
  });

  it('advisory maps headline/factors/rules and official-warning flag', () => {
    const adv = mapAdvisory(fx('alert_active').evidence.advisory ?? null, 'Pune, Maharashtra');
    expect(adv?.riskLevel).toBe('HIGH');
    expect(adv?.officialWarningActive).toBe(true);
    expect(adv?.primaryRiskReason).toContain('HIGH');
    expect(mapAdvisory(null, 'X')).toBeUndefined();
  });
});

describe('climate mapping is research/repro, never IMD', () => {
  it('marks real archive data as research with a non-IMD disclaimer', () => {
    const res = mapClimate(
      {
        ok: true,
        authority: 'research_repro',
        source: 'Open-Meteo Historical Archive (ERA5 reanalysis)',
        kind: 'historical_reanalysis',
        period: '2019–2025',
        disclaimer: 'NOT official India Meteorological Department (IMD) climate normals.',
        normals_basis: 'window mean, not an official IMD normal',
        annual: [
          { year: 2024, rainfall_mm: 3000, rainfall_normal_mm: 3100, temp_avg_c: 27.5, temp_anomaly_c: -0.2, heavy_rain_days: 5 },
          { year: 2025, rainfall_mm: 3400, rainfall_normal_mm: 3100, temp_avg_c: 28.1, temp_anomaly_c: 0.4, heavy_rain_days: 9 },
        ],
        monthly: [],
      } as never,
      'Pune',
    );
    expect(res.available).toBe(true);
    expect(res.points).toHaveLength(2);
    expect(res.points[1].rainfallActual).toBe(3400);
    expect(res.disclaimer).toMatch(/NOT official/i);
    expect(JSON.stringify(res)).not.toMatch(/IMD (observations|official|baseline|normals?)/i);
  });

  it('unavailable archive yields an honest empty result, not fabricated trends', () => {
    const res = mapClimate({ ok: false, authority: 'research_repro', annual: [] } as never, 'X');
    expect(res.available).toBe(false);
    expect(res.points).toEqual([]);
  });
});

describe('language detection', () => {
  it('detects Hinglish/Hindi/English', () => {
    expect(detectLanguage('Kal Mumbai mein baarish hogi kya?')).toBe('Hinglish');
    expect(detectLanguage('मौसम कैसा है')).toBe('Hindi');
    expect(detectLanguage('What is the weather in Pune?')).toBe('English');
  });
});
