using FlowForge.Domain;

namespace FlowForge.Tests;

public static class GraphTests
{
    public static void Run()
    {
        // Topological order respects a linear dependency chain.
        var g = new TaskGraph();
        g.Add(new TaskNode("a", _ => Task.CompletedTask));
        g.Add(new TaskNode("b", _ => Task.CompletedTask, new[] { "a" }));
        g.Add(new TaskNode("c", _ => Task.CompletedTask, new[] { "b" }));
        TestRunner.Check(g.TopologicalOrder().SequenceEqual(new[] { "a", "b", "c" }),
            "topological order is a -> b -> c");

        // Unknown dependency is rejected by Validate.
        var g2 = new TaskGraph();
        g2.Add(new TaskNode("x", _ => Task.CompletedTask, new[] { "missing" }));
        TestRunner.Throws<GraphValidationException>(() => g2.Validate(),
            "unknown dependency rejected");

        // A cycle is detected by TopologicalOrder.
        var g3 = new TaskGraph();
        g3.Add(new TaskNode("p", _ => Task.CompletedTask, new[] { "q" }));
        g3.Add(new TaskNode("q", _ => Task.CompletedTask, new[] { "p" }));
        TestRunner.Throws<GraphValidationException>(() => g3.TopologicalOrder(),
            "cycle detected");

        // Duplicate task id is rejected on Add.
        var g4 = new TaskGraph();
        g4.Add(new TaskNode("d", _ => Task.CompletedTask));
        TestRunner.Throws<InvalidOperationException>(
            () => g4.Add(new TaskNode("d", _ => Task.CompletedTask)),
            "duplicate id rejected");
    }
}
