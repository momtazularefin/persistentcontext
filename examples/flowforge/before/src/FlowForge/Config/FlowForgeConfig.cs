namespace FlowForge.Config;

/// <summary>
/// Runtime configuration. Resolves from the environment with safe defaults so the
/// app runs out of the box. Override the home directory with FLOWFORGE_HOME.
/// </summary>
public sealed class FlowForgeConfig
{
    public string HomeDir { get; init; } = DefaultHome();

    public string RunStoreDir => Path.Combine(HomeDir, "runs");

    public static FlowForgeConfig FromEnvironment()
    {
        var home = Environment.GetEnvironmentVariable("FLOWFORGE_HOME");
        return new FlowForgeConfig
        {
            HomeDir = string.IsNullOrWhiteSpace(home) ? DefaultHome() : home
        };
    }

    private static string DefaultHome()
        => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "flowforge");
}
