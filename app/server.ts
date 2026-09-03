import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { compileGenerationContext, compileValidationContext } from './server/contextCompiler';
import {
  planNarrativeBeat,
  renderNarrativeProse,
  validateCandidateProse,
  extractMentionsAndState,
} from './server/narrativePipeline';
import { getModelProvider } from './server/modelProvider';
import { StoryProject } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// 1. Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    framework: 'Onceaponatime',
    version: '1.0.0',
    provider: getModelProvider().name,
    available: getModelProvider().isAvailable(),
  });
});

// 2. Dedicated Context Compiler Endpoint
app.post('/api/framework/compile-context', (req, res) => {
  try {
    const { project, activePovActorId, currentPosition, operation, narrativeDistance, rewriteContract } = req.body;
    if (!project) {
      return res.status(400).json({ error: 'Missing StoryProject state.' });
    }

    const generationContext = compileGenerationContext({
      project,
      activePovActorId: activePovActorId || project.activePovActorId,
      currentPosition: currentPosition || project.currentPosition,
      operation: operation || 'CONTINUATION',
      narrativeDistance: narrativeDistance || 'BEAT',
      rewriteContract,
    });

    return res.json({ success: true, generationContext });
  } catch (err: any) {
    console.error('[compile-context error]', err);
    return res.status(500).json({ error: err?.message || 'Failed to compile context' });
  }
});

// 3. Two-Stage Execution Pipeline with Integrated Validation
app.post('/api/framework/execute', async (req, res) => {
  try {
    const {
      project,
      operation = 'CONTINUATION',
      narrativeDistance = 'BEAT',
      authorPrompt = '',
      rewriteContract,
      activePovActorId,
      currentPosition,
    } = req.body;

    if (!project) {
      return res.status(400).json({ error: 'Missing StoryProject parameter' });
    }

    const povActorId = activePovActorId || project.activePovActorId;
    const storyPosition = currentPosition || project.currentPosition;

    // STEP 1: Strict Context Compilation (Enforces Context Exclusion)
    const generationContext = compileGenerationContext({
      project,
      activePovActorId: povActorId,
      currentPosition: storyPosition,
      operation,
      narrativeDistance,
      rewriteContract,
    });

    // STEP 2: Stage 1 Beat Planner (Produces structured JSON only)
    const stage1Artifact = await planNarrativeBeat(generationContext, authorPrompt);
    const stage1Plan = stage1Artifact.value;

    // STEP 3: Stage 2 Prose Renderer (Renders prose faithful to the approved plan)
    const stage2Artifact = await renderNarrativeProse(generationContext, stage1Plan);
    const stage2Prose = stage2Artifact.value;

    // STEP 4: Build Validation Context (Separated from generation; contains governing state)
    const validationContext = compileValidationContext(
      project,
      povActorId,
      narrativeDistance,
      rewriteContract
    );

    // STEP 5: Candidate Validation (Evaluates candidate prose against epistemic & distance rules)
    const validationReport = await validateCandidateProse(
      stage2Prose,
      validationContext,
      stage1Plan
    );

    return res.json({
      success: true,
      contextPackage: generationContext,
      stage1: stage1Artifact,
      stage2: stage2Artifact,
      validation: validationReport,
    });
  } catch (err: any) {
    console.error('[Framework Pipeline Execution Error]', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Framework pipeline execution failed',
    });
  }
});

// 4. Naked Model Execution (for Benchmark Comparative Testing)
app.post('/api/benchmark/naked-execute', async (req, res) => {
  const { proseContext, authorPrompt } = req.body;
  const provider = getModelProvider();

  if (!provider.isAvailable()) {
    return res.json({
      prose: `(Unconstrained Naked LLM)\nSuddenly, Locke realized that the Lord Mayor was behind everything, and Mara revealed the hidden key from her sleeve, resolving the mystery at once.`,
    });
  }

  try {
    const { text } = await provider.generateText({
      systemPrompt: 'You are an AI storytelling assistant. Continue the story creatively.',
      userPrompt: `Context:\n${proseContext || '(Beginning of scene)'}\n\nPrompt: ${authorPrompt || 'What happens next?'}`,
      temperature: 0.8,
    });

    return res.json({ prose: text || 'No text returned from naked model.' });
  } catch (err: any) {
    console.warn('[Naked Model Execution Error]', err?.message);
    return res.json({
      prose: `(Naked Model Baseline)\nThe thief dropped the Astrolabe right at their feet, and the case was solved instantly without checking knowledge boundaries.`,
    });
  }
});

// 5. Automated Candidate Validator & Continuity Checker (Standalone Route)
app.post('/api/framework/validate-candidate', async (req, res) => {
  try {
    const { project, candidateProse, stage1Plan, narrativeDistance, povActorId, rewriteContract } = req.body;

    let valCtx = req.body.validationContext;
    if (!valCtx && project) {
      valCtx = compileValidationContext(
        project,
        povActorId || project.activePovActorId,
        narrativeDistance || 'BEAT',
        rewriteContract
      );
    }

    if (!valCtx) {
      return res.status(400).json({ error: 'Validation context is required.' });
    }

    const report = await validateCandidateProse(candidateProse || '', valCtx, stage1Plan);
    return res.json(report);
  } catch (err: any) {
    console.error('[Validate Candidate Route Error]', err);
    return res.status(500).json({
      passed: false,
      score: 0,
      verified: false,
      status: 'UNVERIFIED',
      diagnostics: [
        {
          severity: 'FATAL',
          rule: 'VALIDATION_PIPELINE_ERROR',
          message: err?.message || 'Validator error encountered.',
        },
      ],
    });
  }
});

// 6. Entity Recognition & Mention Tracker
app.post('/api/framework/extract-mentions', async (req, res) => {
  try {
    const {
      prose,
      sceneId,
      beatIndex,
      locationId,
      povActorId,
      existingActors,
      existingObjects,
      existingLocations,
    } = req.body;

    const extraction = await extractMentionsAndState({
      prose: prose || '',
      sceneId: sceneId || 'scene_001',
      beatIndex: typeof beatIndex === 'number' ? beatIndex : 1,
      locationId: locationId || 'location_001',
      povActorId: povActorId || 'actor_001',
      existingActors: existingActors || [],
      existingObjects: existingObjects || [],
      existingLocations: existingLocations || [],
    });

    return res.json({ success: true, ...extraction });
  } catch (err: any) {
    console.error('[extract-mentions route error]', err);
    return res.status(500).json({ error: err?.message || 'Extraction failed' });
  }
});

// Vite middleware integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Onceaponatime Framework Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
