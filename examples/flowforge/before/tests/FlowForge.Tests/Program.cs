using FlowForge.Tests;

Console.WriteLine("FlowForge test run\n");

GraphTests.Run();
SchedulerTests.Run();
await ExecutorTests.Run();

return TestRunner.Summarize();
