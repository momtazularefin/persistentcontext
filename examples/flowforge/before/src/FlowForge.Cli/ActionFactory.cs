namespace FlowForge.Cli;

/// <summary>
/// Translates a declarative <see cref="TaskSpec"/> into an executable action.
/// Only demo kinds are supported; real deployments would map to real work.
/// </summary>
public static class ActionFactory
{
    public static Func<CancellationToken, Task> Build(TaskSpec spec)
    {
        switch (spec.Kind)
        {
            case "echo":
                return _ =>
                {
                    Console.WriteLine($"    [{spec.Id}] {spec.Value}");
                    return Task.CompletedTask;
                };

            case "sleep":
                var ms = int.TryParse(spec.Value, out var parsed) ? parsed : 0;
                return ct => Task.Delay(ms, ct);

            case "fail":
                return _ => throw new InvalidOperationException(spec.Value ?? "forced failure");

            case "noop":
            default:
                return _ => Task.CompletedTask;
        }
    }
}
