/**
 * Absolute Freedom Diversity Pools
 * All hardcoded lists have been removed. The AI relies entirely on its own latent space.
 */

export const AUTO_DIVERSITY_POOLS = {
  shared: { era: [], region: [], mood: [] },
  image: { style: [], lighting: [], composition: [] },
  vector: { style: [], palette: [], useCase: [] },
  video: { cameraMove: [], transition: [], pacing: [], colorGrade: [], format: [] },
};

export const ENGINEER_DIVERSITY_POOLS = {
  shared: { era: [], region: [], mood: [] },
  image: { style: [], lighting: [], composition: [], lens: [], quality: [] },
  vector: { style: [], palette: [], useCase: [], rendering: [] },
  video: { cameraMove: [], transition: [], pacing: [], colorGrade: [], atmosphere: [], format: [] },
};
