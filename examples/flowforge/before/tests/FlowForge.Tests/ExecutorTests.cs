using FlowForge.Domain;
using FlowForge.Engine;

namespace FlowForge.Tests;

public static class ExecutorTests
{
    public static async Task Run()
    {
        // Happy path: all tasks succeed.
        var g = new TaskGraph();
        g.Add(new TaskNode("a", _ => Task.CompletedTask));
        g.Add(new TaskNode("b", _ => Task.CompletedTask, new[] { "a" }));
        var r = await new Executor().RunAsync(g);
        TestRunner.Check(r.Succeeded, "all tasks succeed");

        // Failure of a dependency skips its dependents.
        var g2 = new TaskGraph();
        g2.Add(new TaskNode("root", _ => throw new Exception("boom")));
        g2.Add(new TaskNode("child", _ => Task.CompletedTask, new[] { "root" }));
        var r2 = await new Executor().RunAsync(g2);
        var root = r2.Results.First(x => x.TaskId == "root");
        var child = r2.Results.First(x => x.TaskId == "child");
        TestRunner.Check(root.State == TaskState.Failed, "root task fails");
        TestRunner.Check(child.State == TaskState.Skipped, "dependent is skipped after failure");

        // Retry: fail twice, then succeed with maxRetries = 2 (3 attempts total).
        var calls = 0;
        var g3 = new TaskGraph();
        g3.Add(new TaskNode("flaky", _ =>
        {
            calls++;
            if (calls < 3) throw new Exception("transient");
            return Task.CompletedTask;
        }, maxRetries: 2));
        var r3 = await new Executor().RunAsync(g3);
        var flaky = r3.Results.First(x => x.TaskId == "flaky");
        TestRunner.Check(flaky.State == TaskState.Succeeded && flaky.Attempts == 3,
            "task retries until it succeeds");
    }
}
