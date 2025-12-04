namespace SERC.ComplianceService;

/// <summary>
/// Tracks device enrollment state.
/// </summary>
public class EnrollmentState
{
    public bool IsEnrolled { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
}

/// <summary>
/// Tracks compliance check results.
/// </summary>
public class ComplianceState
{
    public bool BitLocker { get; set; }
    public bool Tpm { get; set; }
    public bool SecureBoot { get; set; }
    public bool Firewall { get; set; }
    public bool Antivirus { get; set; }

    public bool IsFullyCompliant => BitLocker && Tpm && SecureBoot && Firewall && Antivirus;

    public List<string> GetFailedChecks()
    {
        var failures = new List<string>();
        if (!BitLocker) failures.Add("BitLocker");
        if (!Tpm) failures.Add("TPM");
        if (!SecureBoot) failures.Add("Secure Boot");
        if (!Firewall) failures.Add("Firewall");
        if (!Antivirus) failures.Add("Antivirus");
        return failures;
    }
}

/// <summary>
/// Response from enrollment polling API.
/// </summary>
public class EnrollmentResponse
{
    public string? status { get; set; }
    public string? userEmail { get; set; }
    public string? userName { get; set; }
}
