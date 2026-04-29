import { costForRequest, sumCosts } from "./cost.mjs";

function resolveAltPricing(altSku, claudeTier, pricing) {
  const provider = pricing.providers?.[altSku];
  if (provider) {
    const mappedSku = provider.tierMap[claudeTier] ?? provider.tierMap["standard"];
    return pricing.models[mappedSku];
  }
  return pricing.models[altSku];
}

export function buildMatrix(usage, pricing) {
  const models    = pricing.models;
  const providers = pricing.providers ?? {};
  const altOrder  = pricing.altOrder;

  const rows = [];
  for (const [model, bucket] of Object.entries(usage.totals)) {
    const claudePricing = models[model];
    const claudeTier    = claudePricing?.tier ?? "standard";

    const nativeCosts = bucket.requests.map(r => costForRequest(r, claudePricing ?? { input: 0, output: 0 }));
    const nativeSum   = sumCosts(nativeCosts);

    const alt = {};
    for (const altSku of altOrder) {
      const altPricing = resolveAltPricing(altSku, claudeTier, pricing);
      if (!altPricing) continue;
      const altCosts = bucket.requests.map(r => costForRequest(r, altPricing));
      const altSum   = sumCosts(altCosts);
      alt[altSku] = {
        total$:   altSum.total,
        deltaUsd: altSum.total - nativeSum.total,
        deltaPct: nativeSum.total > 0 ? ((altSum.total - nativeSum.total) / nativeSum.total) * 100 : 0,
      };
    }

    rows.push({
      model,
      displayName: claudePricing?.displayName ?? model,
      messages:    bucket.messages,
      tokens:      bucket.byTokenType,
      native: {
        input$:      nativeSum.input,
        output$:     nativeSum.output,
        cacheRead$:  nativeSum.cacheRead,
        cacheWrite$: nativeSum.cacheWrite5m + nativeSum.cacheWrite1h,
        total$:      nativeSum.total,
      },
      unknown: !claudePricing,
      alt,
    });
  }

  rows.sort((a, b) => b.native.total$ - a.native.total$);

  const totals = {
    messages: rows.reduce((s, r) => s + r.messages, 0),
    native: { total$: rows.reduce((s, r) => s + r.native.total$, 0) },
    alt: {},
  };
  for (const altSku of altOrder) {
    const total$ = rows.reduce((s, r) => s + (r.alt[altSku]?.total$ ?? 0), 0);
    totals.alt[altSku] = {
      total$,
      deltaUsd: total$ - totals.native.total$,
      deltaPct: totals.native.total$ > 0
        ? ((total$ - totals.native.total$) / totals.native.total$) * 100
        : 0,
    };
  }

  const altPricingDetails = Object.fromEntries(altOrder.map(sku => {
    const provider = providers[sku];
    if (provider?.tierMap) {
      const TIER_LABELS = { premium: "Opus", standard: "Sonnet", fast: "Haiku" };
      const seen = new Map();
      for (const [tier, mappedSku] of Object.entries(provider.tierMap)) {
        if (!seen.has(mappedSku)) seen.set(mappedSku, []);
        seen.get(mappedSku).push(TIER_LABELS[tier] ?? tier);
      }
      return [sku, { type: "tiered", tiers: [...seen.entries()].map(([mappedSku, tiers]) => {
        const m = models[mappedSku];
        const firstBand = m?.tiers?.[0];
        return {
          label: tiers.join("/"),
          sku: mappedSku,
          displayName: m?.displayName ?? mappedSku,
          input:       m?.input      ?? firstBand?.input,
          output:      m?.output     ?? firstBand?.output,
          cache_read:  m?.cache_read,
          banded:      !!m?.tiers,
        };
      })}];
    }
    const m = models[sku];
    if (m?.tiers) {
      return [sku, { type: "banded", bands: m.tiers.map(t => ({ max_input_tokens: t.max_input_tokens, input: t.input, output: t.output })), cache_read: m.cache_read, notes: m.notes }];
    }
    return [sku, { type: "flat", input: m?.input, output: m?.output, cache_read: m?.cache_read }];
  }));

  const TIER_LABELS = { premium: "Opus", standard: "Sonnet", fast: "Haiku" };
  const claudeRates = {};
  for (const [sku, m] of Object.entries(models)) {
    if (m.kind !== "claude" || !m.tier) continue;
    if (claudeRates[m.tier]) continue;
    claudeRates[m.tier] = {
      tierLabel:   TIER_LABELS[m.tier] ?? m.tier,
      displayName: m.displayName ?? sku,
      input:       m.input,
      output:      m.output,
      cache_read:  m.cache_read,
    };
  }

  return {
    windowStart:  usage.windowStart,
    windowEnd:    usage.windowEnd,
    windowDays:   usage.windowDays,
    projectsDir:  usage.projectsDir,
    dirExists:    usage.dirExists,
    scannedFiles: usage.scannedFiles,
    altOrder,
    claudeRates,
    altPricingDetails,
    altMeta: Object.fromEntries(
      altOrder.map(sku => {
        const provider = providers[sku];
        const model    = models[sku];
        const meta     = provider ?? model;
        const entry    = { displayName: meta?.displayName ?? sku, valid_until: meta?.valid_until };
        if (provider?.tierMap) {
          entry.tierMap = provider.tierMap;
          entry.tierModelNames = Object.fromEntries(
            Object.entries(provider.tierMap).map(([tier, mappedSku]) => [tier, models[mappedSku]?.displayName ?? mappedSku])
          );
        } else if (model) {
          const name = model.displayName ?? sku;
          entry.tierMap = { premium: sku, standard: sku, fast: sku };
          entry.tierModelNames = { premium: name, standard: name, fast: name };
        }
        return [sku, entry];
      })
    ),
    rows,
    totals,
  };
}
