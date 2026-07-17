using FlowForge.Domain;
using FlowForge.Engine;

namespace FlowForge.Tests;

public static class SchedulerTests
{
    public static void Run()
    {
        var g = new TaskGraph();
        g.Add(new TaskNode("a", _ => Task.CompletedTask));
        g.Add(new TaskNode("b", _ => Task.CompletedTask, new[] { "a" }));
        var scheduler = new Scheduler(g);

        var states = new Dictionary<string, TaskState>
        {
            ["a"] = TaskState.Pending,
            ["b"] = TaskState.Pending
        };

        TestRunner.Check(scheduler.ReadyTasks(states).SequenceEqual(new[] { "a" }),
            "only the root is ready initially");

        states["a"] = TaskState.Succeeded;
        TestRunner.Check(scheduler.ReadyTasks(states).SequenceEqual(new[] { "b" }),
            "dependent becomes ready after its dependency succeeds");
    }
}
