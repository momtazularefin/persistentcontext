using FlowForge.Domain;

namespace FlowForge.Engine;

/// <summary>
/// Runs a task graph in dependency order. Sequential and deterministic.
///
/// Execution protocol:
///   1. Build a Scheduler (validates the graph and computes a topological order).
///   2. Walk tasks in that order.
///   3. Gating: if any dependency did not Succeed, the task is Skipped.
///   4. Retry: a failing action is retried up to MaxRetries times.
///   5. Stop-on-failure (optional): after a failure, remaining tasks are Skipped.
/// </summary>
public sealed class Executor
{
    private readonly ExecutionOptions _options;

    public Executor(ExecutionOptions? options = null)
        => _options = options ?? new ExecutionOptions();

    public async Task<RunResult> RunAsync(TaskGraph graph, CancellationToken ct = default)
    {
        var scheduler = new Scheduler(graph);
        var order = scheduler.Order;

        var states = order.ToDictionary(id => id, _ => TaskState.Pending, StringComparer.Ordinal);
        var results = new Dictionary<string, TaskResult>(StringComparer.Ordinal);
        var aborted = false;

        foreach (var id in order)
        {
            var node = graph.Get(id);
            var depsFailed = node.DependsOn.Any(d => states[d] != TaskState.Succeeded);

            if (aborted || depsFailed)
            {
                states[id] = TaskState.Skipped;
                results[id] = new TaskResult { TaskId = id, State = TaskState.Skipped, Attempts = 0 };
                continue;
            }

            states[id] = TaskState.Running;
            var started = DateTimeOffset.UtcNow;
            var attempts = 0;
            string? error = null;
            var ok = false;

            while (attempts <= node.MaxRetries)
            {
                attempts++;
                try
                {
                    ct.ThrowIfCancellationRequested();
                    await node.Action(ct).ConfigureAwait(false);
                    ok = true;
                    break;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    error = ex.Message;
                }
            }

            var finished = DateTimeOffset.UtcNow;
            states[id] = ok ? TaskState.Succeeded : TaskState.Failed;
            results[id] = new TaskResult
            {
                TaskId = id,
                State = states[id],
                Attempts = attempts,
                Error = ok ? null : error,
                StartedAt = started,
                FinishedAt = finished
            };

            if (!ok && _options.StopOnFailure)
                aborted = true;
        }

        return new RunResult
        {
            Order = order,
            Results = order.Select(id => results[id]).ToList()
        };
    }
}
