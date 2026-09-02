import assert from 'node:assert/strict';
import { compileGenerationContext } from '../server/contextCompiler';
import { planNarrativeBeat } from '../server/narrativePipeline';
import { DEFAULT_PROJECTS } from '../src/data/defaultProjects';
import { ReceiptBearingModelProvider } from '../server/modelProvider';

async function runFailClosedProviderTest() {
  const project = DEFAULT_PROJECTS[0];
  const generationContext = compileGenerationContext({
    project,
    activePovActorId: project.activePovActorId,
    currentPosition: project.currentPosition,
    operation: 'CONTINUATION',
    narrativeDistance: 'BEAT',
  });

  const unavailableProvider: ReceiptBearingModelProvider = {
    name: 'unavailable-test-provider',
    isAvailable: () => false,
    generateText: async () => {
      throw new Error('generateText must not be called for an unavailable provider');
    },
  };

  await assert.rejects(
    () => planNarrativeBeat(generationContext, 'Advance one beat.', unavailableProvider),
    /model provider.*unavailable/i,
    'Planning must fail closed when the selected model provider is unavailable.'
  );
}

runFailClosedProviderTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
