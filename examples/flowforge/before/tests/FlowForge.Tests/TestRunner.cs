namespace FlowForge.Tests;

/// <summary>Minimal assertion harness. No external test framework needed.</summary>
public static class TestRunner
{
    private static int _passed;
    private static int _failed;

    public static void Check(bool condition, string name)
    {
        if (condition) { _passed++; Console.WriteLine($"PASS  {name}"); }
        else { _failed++; Console.WriteLine($"FAIL  {name}"); }
    }

    public static void Throws<T>(Action action, string name) where T : Exception
    {
        try
        {
            action();
            _failed++;
            Console.WriteLine($"FAIL  {name} (expected {typeof(T).Name}, none thrown)");
        }
        catch (T)
        {
            _passed++;
            Console.WriteLine($"PASS  {name}");
        }
        catch (Exception ex)
        {
            _failed++;
            Console.WriteLine($"FAIL  {name} (expected {typeof(T).Name}, got {ex.GetType().Name})");
        }
    }

    public static int Summarize()
    {
        Console.WriteLine($"\n{_passed} passed, {_failed} failed");
        return _failed == 0 ? 0 : 1;
    }
}
