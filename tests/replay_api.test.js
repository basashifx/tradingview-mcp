/**
 * Tests for getReplayApi() lazy initialization in src/connection.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { getReplayApi, REPLAY_API_INIT_EXPR, KNOWN_PATHS } from '../src/connection.js';

function recordingEvaluate(verifyResult) {
  const calls = [];
  const fn = async (expr, opts) => {
    calls.push({ expr, opts });
    if (expr === REPLAY_API_INIT_EXPR) return true;
    return verifyResult;
  };
  fn.calls = calls;
  return fn;
}

describe('getReplayApi()', () => {
  it('awaits the lazy initializer before verifying, then returns the path', async () => {
    const evaluate = recordingEvaluate(true);
    const path = await getReplayApi({ _deps: { evaluate } });
    assert.equal(path, KNOWN_PATHS.replayApi);
    assert.equal(evaluate.calls.length, 2);
    assert.equal(evaluate.calls[0].expr, REPLAY_API_INIT_EXPR);
    assert.deepEqual(evaluate.calls[0].opts, { awaitPromise: true });
    assert.ok(evaluate.calls[1].expr.includes(KNOWN_PATHS.replayApi));
  });

  it('throws when _replayApi is still unavailable after initialization', async () => {
    const evaluate = recordingEvaluate(false);
    await assert.rejects(
      () => getReplayApi({ _deps: { evaluate } }),
      /Replay API not available at window\.TradingViewApi\._replayApi/,
    );
  });
});

describe('REPLAY_API_INIT_EXPR', () => {
  function run(window) {
    return vm.runInNewContext(REPLAY_API_INIT_EXPR, { window });
  }

  it('calls replayApi() when _replayApi is null and resolves true', async () => {
    const replayObj = { id: 'replay' };
    let calls = 0;
    const api = {
      _replayApi: null,
      replayApi() {
        calls++;
        api._replayApi = replayObj;
        return Promise.resolve(replayObj);
      },
    };
    const result = await run({ TradingViewApi: api });
    assert.equal(result, true);
    assert.equal(calls, 1);
    assert.equal(api._replayApi, replayObj);
  });

  it('does not call replayApi() when already initialized', () => {
    let calls = 0;
    const api = { _replayApi: { id: 'replay' }, replayApi() { calls++; return Promise.resolve(); } };
    assert.equal(run({ TradingViewApi: api }), false);
    assert.equal(calls, 0);
  });

  it('returns false when replayApi() does not exist', () => {
    assert.equal(run({ TradingViewApi: { _replayApi: null } }), false);
  });

  it('returns false when TradingViewApi is missing', () => {
    assert.equal(run({}), false);
  });
});
