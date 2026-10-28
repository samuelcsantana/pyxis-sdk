import fc from 'fast-check';

const PROPERTY_SEED = 20_261_028;
const PROPERTY_RUNS = 500;

fc.configureGlobal({ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS });
