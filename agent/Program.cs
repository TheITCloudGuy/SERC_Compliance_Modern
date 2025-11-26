using System.Net.Http.Json;
using System.Text.Json;

var httpClient = new HttpClient();
var dashboardUrl = "http://localhost:3000/api/telemetry";
var random = new Random();

Console.WriteLine("Starting Device Compliance Agent...");
Console.WriteLine($"Target Dashboard: {dashboardUrl}");

while (true)
{
    try
    {
        // 1. Gather Telemetry (Simulated)
        var hostname = System.Net.Dns.GetHostName();
        var serialNumber = "SN-" + Math.Abs(hostname.GetHashCode()).ToString("X"); // Fake Serial
        
        // Simulate checks (mostly passing, but let's make one random for demo purposes if desired, but fixed is better for consistent PoC)
        var checks = new
        {
            bitlocker = true,
            tpm = true,
            secureBoot = true,
            firewall = true,
            antivirus = true
        };

        var osBuild = Environment.OSVersion.Version.ToString();

        var payload = new
        {
            hostname = hostname,
            serialNumber = serialNumber,
            osBuild = osBuild,
            checks = checks
        };

        // 2. Report to Dashboard
        Console.WriteLine($"[{DateTime.Now}] Sending telemetry for {hostname} (Build: {osBuild})...");
        var response = await httpClient.PostAsJsonAsync(dashboardUrl, payload);

        if (response.IsSuccessStatusCode)
        {
            var result = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"   Success: {result}");
        }
        else
        {
            Console.WriteLine($"   Error: {response.StatusCode}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"   Exception: {ex.Message}");
    }

    // 3. Loop
    Console.WriteLine("Waiting 10 seconds...");
    await Task.Delay(10000);
}
