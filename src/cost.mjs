const M = 1_000_000;

function bandFor(modelPricing, inputSize) {
  for (const tier of modelPricing.tiers) {
    if (inputSize <= tier.max_input_tokens) return tier;
  }
  return modelPricing.tiers[modelPricing.tiers.length - 1];
}

export function costForRequest(req, modelPricing) {
  const inputSize = (req.input_tokens ?? 0)
    + (req.cache_read_input_tokens ?? 0)
    + (req.cache_write_5m ?? 0)
    + (req.cache_write_1h ?? 0);

  let baseInput, baseOutput;
  if (modelPricing.tiers) {
    const band = bandFor(modelPricing, inputSize);
    baseInput = band.input;
    baseOutput = band.output;
  } else {
    baseInput = modelPricing.input;
    baseOutput = modelPricing.output;
  }

  const cacheReadRate   = modelPricing.cache_read    ?? baseInput;
  const cacheWrite5mRate = modelPricing.cache_write_5m ?? baseInput;
  const cacheWrite1hRate = modelPricing.cache_write_1h ?? baseInput;

  const inputCost      = ((req.input_tokens            ?? 0) / M) * baseInput;
  const outputCost     = ((req.output_tokens           ?? 0) / M) * baseOutput;
  const cacheReadCost  = ((req.cache_read_input_tokens ?? 0) / M) * cacheReadRate;
  const cacheWrite5m   = ((req.cache_write_5m          ?? 0) / M) * cacheWrite5mRate;
  const cacheWrite1h   = ((req.cache_write_1h          ?? 0) / M) * cacheWrite1hRate;

  return {
    input:        inputCost,
    output:       outputCost,
    cacheRead:    cacheReadCost,
    cacheWrite5m,
    cacheWrite1h,
    total:        inputCost + outputCost + cacheReadCost + cacheWrite5m + cacheWrite1h,
  };
}

export function sumCosts(costs) {
  const zero = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, total: 0 };
  return costs.reduce((acc, c) => ({
    input:        acc.input        + c.input,
    output:       acc.output       + c.output,
    cacheRead:    acc.cacheRead    + c.cacheRead,
    cacheWrite5m: acc.cacheWrite5m + c.cacheWrite5m,
    cacheWrite1h: acc.cacheWrite1h + c.cacheWrite1h,
    total:        acc.total        + c.total,
  }), zero);
}
