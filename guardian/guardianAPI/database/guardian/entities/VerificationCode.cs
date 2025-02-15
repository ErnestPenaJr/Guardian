using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class VerificationCode
{
    public string Id { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Code { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public bool Used { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
