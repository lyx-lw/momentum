import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../../../utils/logger';
import { useRSIPViewInteractionActions } from '../useRSIPViewInteractionActions';
import {
  createChainStub,
  createNode,
  createProps,
  createState,
  createTaskLink,
} from './testHelpers';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useRSIPViewInteractionActions execution actions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('advances execution state and runs only active execution links', async () => {
    const root = createNode({
      consecutiveExecutions: 6,
      consecutiveViolations: 2,
      cumulativeExecutionDays: 3,
      totalExecutions: 5,
      stabilityPhase: 'E0',
    });
    const child = createNode({ id: 'child', parentId: root.id });
    const onSaveNodes = vi.fn();
    const onStartChain = vi.fn(async () => undefined);
    const state = createState({
      nodes: [root, child],
      chains: [createChainStub('chain-1', 'Morning task')],
      taskLinks: [
        createTaskLink(),
        createTaskLink({ id: 'inactive', isActive: false }),
        createTaskLink({
          id: 'wrong-event',
          triggerEvent: 'task_completed',
        }),
        createTaskLink({ id: 'other-node', rsipNodeId: 'node-2' }),
      ],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(onSaveNodes, { onStartChain }),
      }),
    );

    let updatedNodes = state.nodes;
    await act(async () => {
      updatedNodes = await result.current.handleMarkExecuted(root.id);
    });

    expect(updatedNodes[0]).toMatchObject({
      id: root.id,
      stabilityPhase: 'E1',
      consecutiveExecutions: 7,
      consecutiveViolations: 0,
      cumulativeExecutionDays: 4,
      totalExecutions: 6,
      phaseStartedAt: expect.any(Date),
      lastExecutedAt: expect.any(Date),
    });
    expect(updatedNodes[1]).toBe(child);
    expect(root.stabilityPhase).toBe('E0');
    expect(onSaveNodes).toHaveBeenCalledWith(updatedNodes);
    expect(onStartChain).toHaveBeenCalledOnce();
    expect(onStartChain).toHaveBeenCalledWith('chain-1');
  });

  it('honors confirmation, schedules accepted links, and logs missing chains', async () => {
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const warn = vi.spyOn(logger, 'warn');
    const onStartChain = vi.fn(async () => undefined);
    const onScheduleChain = vi.fn();
    const state = createState({
      nodes: [createNode()],
      chains: [
        createChainStub('start-chain', 'Start task'),
        createChainStub('schedule-chain', 'Scheduled task'),
      ],
      taskLinks: [
        createTaskLink({ id: 'missing', chainId: 'missing-chain' }),
        createTaskLink({
          id: 'start',
          chainId: 'start-chain',
          automation: 'confirm',
        }),
        createTaskLink({
          id: 'schedule',
          chainId: 'schedule-chain',
          automation: 'confirm',
          effect: 'prompt_schedule_chain',
        }),
      ],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(vi.fn(), {
          onStartChain,
          onScheduleChain,
        }),
      }),
    );

    await act(async () => {
      await result.current.handleMarkExecuted('node-1');
    });

    expect(warn).toHaveBeenCalledWith(
      'RSIP',
      'RSIP->task link skipped: missing target chain',
      { linkId: 'missing', chainId: 'missing-chain' },
    );
    expect(confirm).toHaveBeenNthCalledWith(
      1,
      'Policy executed. Trigger linked task "Start task"?',
    );
    expect(confirm).toHaveBeenNthCalledWith(
      2,
      'Policy executed. Trigger linked task "Scheduled task"?',
    );
    expect(onStartChain).not.toHaveBeenCalled();
    expect(onScheduleChain).toHaveBeenCalledWith('schedule-chain');
  });

  it('uses the domain execution callback and explicit task actions when supplied', async () => {
    const nodes = [createNode()];
    const returnedNodes = [createNode({ totalExecutions: 9 })];
    const onSaveNodes = vi.fn();
    const onMarkExecuted = vi.fn(async () => returnedNodes);
    const onGetTaskActions = vi.fn(() => [
      createTaskLink({
        id: 'explicit-link',
        chainId: 'scheduled',
        effect: 'prompt_schedule_chain',
      }),
    ]);
    const onScheduleChain = vi.fn();
    const state = createState({
      nodes,
      chains: [createChainStub('scheduled', 'Scheduled task')],
      taskLinks: [createTaskLink({ chainId: 'ignored' })],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(onSaveNodes, {
          onMarkExecuted,
          onGetTaskActions,
          onScheduleChain,
        }),
      }),
    );

    let actual = nodes;
    await act(async () => {
      actual = await result.current.handleMarkExecuted('node-1', true);
    });

    expect(actual).toBe(returnedNodes);
    expect(onMarkExecuted).toHaveBeenCalledWith('node-1', nodes, undefined, {
      reinforce: true,
    });
    expect(onSaveNodes).not.toHaveBeenCalled();
    expect(onGetTaskActions).toHaveBeenCalledWith('node-1');
    expect(onScheduleChain).toHaveBeenCalledWith('scheduled');
  });

  it('propagates execution failures without running linked tasks', async () => {
    const failure = new Error('execution storage unavailable');
    const onMarkExecuted = vi.fn(async () => Promise.reject(failure));
    const onStartChain = vi.fn(async () => undefined);
    const state = createState({
      nodes: [createNode()],
      chains: [createChainStub('chain-1', 'Morning task')],
      taskLinks: [createTaskLink()],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(vi.fn(), { onMarkExecuted, onStartChain }),
      }),
    );

    await expect(result.current.handleMarkExecuted('node-1')).rejects.toBe(
      failure,
    );
    expect(onStartChain).not.toHaveBeenCalled();
  });

  it('does not run linked tasks when fallback node persistence rejects', async () => {
    const failure = new Error('node persistence unavailable');
    const onSaveNodes = vi.fn(() => Promise.reject(failure));
    const onStartChain = vi.fn(async () => undefined);
    const state = createState({
      nodes: [createNode()],
      chains: [createChainStub('chain-1', 'Morning task')],
      taskLinks: [createTaskLink()],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(onSaveNodes, { onStartChain }),
      }),
    );

    await expect(result.current.handleMarkExecuted('node-1')).rejects.toBe(
      failure,
    );
    expect(onSaveNodes).toHaveBeenCalledOnce();
    expect(onStartChain).not.toHaveBeenCalled();
  });

  it('coalesces repeated execution requests until persistence and linked actions finish', async () => {
    const save = createDeferred();
    const onSaveNodes = vi.fn(() => save.promise);
    const onStartChain = vi.fn(async () => undefined);
    const state = createState({
      nodes: [createNode()],
      chains: [createChainStub('chain-1', 'Morning task')],
      taskLinks: [createTaskLink()],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(onSaveNodes, { onStartChain }),
      }),
    );

    let firstExecution!: Promise<ReturnType<typeof createNode>[]>;
    let duplicateExecution!: Promise<ReturnType<typeof createNode>[]>;
    act(() => {
      firstExecution = result.current.handleMarkExecuted('node-1');
      duplicateExecution = result.current.handleMarkExecuted('node-1');
    });

    await duplicateExecution;
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSaveNodes).toHaveBeenCalledOnce();
    expect(onStartChain).not.toHaveBeenCalled();

    await act(async () => {
      save.resolve();
      await firstExecution;
    });

    expect(onStartChain).toHaveBeenCalledOnce();
  });

  it('serializes different-node executions against the latest saved node state', async () => {
    const firstSave = createDeferred();
    const onSaveNodes = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce(undefined);
    const first = createNode({ id: 'first', totalExecutions: 0 });
    const second = createNode({ id: 'second', totalExecutions: 0 });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({ nodes: [first, second], taskLinks: [] }),
        props: createProps(onSaveNodes),
      }),
    );

    let firstExecution!: Promise<ReturnType<typeof createNode>[]>;
    let secondExecution!: Promise<ReturnType<typeof createNode>[]>;
    act(() => {
      firstExecution = result.current.handleMarkExecuted('first');
      secondExecution = result.current.handleMarkExecuted('second');
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSaveNodes).toHaveBeenCalledOnce();

    await act(async () => {
      firstSave.resolve();
      await firstExecution;
      await secondExecution;
    });

    expect(onSaveNodes).toHaveBeenCalledTimes(2);
    expect(onSaveNodes.mock.calls[1][0]).toEqual([
      expect.objectContaining({ id: 'first', totalExecutions: 1 }),
      expect.objectContaining({ id: 'second', totalExecutions: 1 }),
    ]);
    expect(first.totalExecutions).toBe(0);
    expect(second.totalExecutions).toBe(0);
  });

  it('restores a real library entry through the fallback conversion', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-05T12:00:00.000Z'));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111',
    );
    const existingNode = createNode();
    const onSaveNodes = vi.fn();
    const state = createState({ nodes: [existingNode] });
    const props = createProps(onSaveNodes, {
      policyLibrary: [
        {
          id: 'library-1',
          title: 'Restored policy',
          rule: 'Restore this rule',
          type: 'routine',
          emoji: '♻️',
          cumulativeExecutionDays: 12,
          internalizationProgress: 40,
          lastActiveAt: new Date('2026-03-01T00:00:00.000Z'),
          timesUsed: 2,
          useTimer: true,
          timerMinutes: 20,
          isPassive: false,
        },
      ],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({ state, props }),
    );

    await act(async () => {
      await result.current.handleRestoreFromLibrary('library-1', 'parent-1');
    });

    expect(onSaveNodes).toHaveBeenCalledWith([
      existingNode,
      {
        id: '11111111-1111-4111-8111-111111111111',
        parentId: 'parent-1',
        title: 'Restored policy',
        rule: 'Restore this rule',
        sortOrder: 1775390400,
        createdAt: new Date('2026-04-05T12:00:00.000Z'),
        useTimer: true,
        timerMinutes: 20,
        emoji: '♻️',
        type: 'routine',
        isPassive: false,
        requiresDailyExecution: true,
        cumulativeExecutionDays: 12,
      },
    ]);
  });

  it('delegates library restoration and ignores unknown fallback entries', async () => {
    const onSaveNodes = vi.fn();
    const onRestoreFromLibrary = vi.fn(async () => createNode());
    const delegated = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState(),
        props: createProps(onSaveNodes, { onRestoreFromLibrary }),
      }),
    );
    const fallback = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState(),
        props: createProps(onSaveNodes),
      }),
    );

    await act(async () => {
      await delegated.result.current.handleRestoreFromLibrary(
        'library-1',
        'parent-1',
      );
      await fallback.result.current.handleRestoreFromLibrary('missing');
    });

    expect(onRestoreFromLibrary).toHaveBeenCalledWith('library-1', 'parent-1');
    expect(onSaveNodes).not.toHaveBeenCalled();
  });

  it('propagates fallback library persistence failures', async () => {
    const failure = new Error('library restore persistence unavailable');
    const onSaveNodes = vi.fn(() => Promise.reject(failure));
    const state = createState();
    const props = createProps(onSaveNodes, {
      policyLibrary: [
        {
          id: 'library-1',
          title: 'Restored policy',
          rule: 'Restore this rule',
          cumulativeExecutionDays: 2,
          internalizationProgress: 10,
          lastActiveAt: new Date('2026-03-01T00:00:00.000Z'),
          timesUsed: 1,
        },
      ],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({ state, props }),
    );

    await expect(
      result.current.handleRestoreFromLibrary('library-1'),
    ).rejects.toBe(failure);
  });

  it('persists task links through the available boundary', async () => {
    const links = [createTaskLink()];
    const onUpsertTaskLinks = vi.fn(async () => links);
    const onSaveTaskLinks = vi.fn();
    const delegated = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState(),
        props: createProps(vi.fn(), {
          onUpsertTaskLinks,
          onSaveTaskLinks,
        }),
      }),
    );
    const fallback = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState(),
        props: createProps(vi.fn(), { onSaveTaskLinks }),
      }),
    );

    await act(async () => {
      await delegated.result.current.handleTaskLinkUpsert(links);
      await fallback.result.current.handleTaskLinkUpsert(links);
    });

    expect(onUpsertTaskLinks).toHaveBeenCalledWith(links);
    expect(onSaveTaskLinks).toHaveBeenCalledOnce();
    expect(onSaveTaskLinks).toHaveBeenCalledWith(links);
  });

  it('propagates fallback task-link persistence failures', async () => {
    const failure = new Error('task-link persistence unavailable');
    const links = [createTaskLink()];
    const onSaveTaskLinks = vi.fn(() => Promise.reject(failure));
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState(),
        props: createProps(vi.fn(), { onSaveTaskLinks }),
      }),
    );

    await expect(result.current.handleTaskLinkUpsert(links)).rejects.toBe(
      failure,
    );
  });

  it('calculates constraint power from the live node tree and handles missing nodes', () => {
    const root = createNode({
      stabilityPhase: 'E1',
      reinforcementLevel: 1,
    });
    const state = createState({
      nodes: [
        root,
        createNode({ id: 'child', parentId: root.id }),
        createNode({ id: 'grandchild', parentId: 'child' }),
      ],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(vi.fn()),
      }),
    );

    expect(result.current.calculateConstraintPower(root.id)).toEqual({
      descendantCount: 2,
      failureCost: 1.8,
    });
    expect(result.current.calculateConstraintPower('missing')).toEqual({
      descendantCount: 0,
      failureCost: 0,
    });
  });
});
