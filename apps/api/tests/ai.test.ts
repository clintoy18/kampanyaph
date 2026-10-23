import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAiService, OpenAiService } from '../src/infrastructure/ai.ts';

test('local demo scaffolds formula fields without a network call or invented trust claim', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Demo mode must not make a network request');
  };
  try {
    const service = createAiService({ provider: 'demo', production: false, model: 'unused' });
    const strategy = await service.strategy({
      audience: { name: 'Local shoppers' },
      objective: 'Introduce the business',
      platform: 'Facebook',
    });
    const content = await service.content({
      audienceInsight: 'Local shoppers need clear opening hours',
      marketingObjective: 'Introduce the business',
      platformOptimization: 'Facebook',
    });
    assert.equal(strategy.model, 'local-demo');
    assert.match(strategy.value.rationale, /LOCAL DEMO ONLY/);
    assert.equal(content.model, 'local-demo');
    assert.match(content.value.title, /^\[DEMO\]/);
    assert.match(content.value.body, /Audience insight:/);
    assert.match(content.value.body, /Marketing objective:/);
    assert.match(content.value.body, /Hook:/);
    assert.match(content.value.body, /Value proposition:/);
    assert.match(content.value.body, /Call to action:/);
    assert.match(content.value.body, /Platform optimization:/);
    assert.doesNotMatch(content.value.body, /Trust element:/);
    assert.equal(content.inputTokens, null);
  } finally {
    globalThis.fetch = original;
  }
});

test('local demo refuses production and unknown AI providers fail closed', () => {
  assert.throws(
    () => createAiService({ provider: 'demo', production: true, model: 'unused' }),
    /unavailable in production/,
  );
  assert.throws(
    () => createAiService({ provider: 'unknown', production: false, model: 'unused' }),
    /AI_PROVIDER must be/,
  );
});

test('AI adapter rejects absent configuration before a network call', async () => {
  await assert.rejects(
    new OpenAiService(undefined, 'test-model').content({ objective: 'Awareness' }),
    { code: 'AI_UNAVAILABLE' },
  );
});

test('AI adapter validates structured output and sends credentials only to OpenAI', async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async (input, init) => {
    called = true;
    assert.equal(input, 'https://api.openai.com/v1/responses');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer secret-test-key');
    const request = JSON.parse(String(init?.body));
    assert.equal(request.store, false);
    assert.equal(request.text.format.type, 'json_schema');
    return new Response(
      JSON.stringify({
        status: 'completed',
        model: 'test-model',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({ title: 'A useful offer', body: 'Visit us this week.' }),
              },
            ],
          },
        ],
        usage: { input_tokens: 23, output_tokens: 12 },
      }),
      { status: 200 },
    );
  };
  try {
    const result = await new OpenAiService('secret-test-key', 'test-model').content({
      objective: 'Awareness',
    });
    assert(called);
    assert.deepEqual(result.value, { title: 'A useful offer', body: 'Visit us this week.' });
    assert.equal(result.inputTokens, 23);
  } finally {
    globalThis.fetch = original;
  }
});

test('AI adapter rejects malformed model content', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        status: 'completed',
        model: 'test-model',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: '{"title":"Missing body"}' }] },
        ],
      }),
      { status: 200 },
    );
  try {
    await assert.rejects(new OpenAiService('secret-test-key', 'test-model').content({}), {
      code: 'AI_INVALID_OUTPUT',
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('AI adapter retries a transient rate limit once', async () => {
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) return new Response('', { status: 429 });
    return new Response(
      JSON.stringify({
        status: 'completed',
        model: 'test-model',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({ title: 'Try this', body: 'Visit this week.' }),
              },
            ],
          },
        ],
      }),
      { status: 200 },
    );
  };
  try {
    const result = await new OpenAiService('test-key', 'test-model').content({});
    assert.equal(result.value.title, 'Try this');
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = original;
  }
});
