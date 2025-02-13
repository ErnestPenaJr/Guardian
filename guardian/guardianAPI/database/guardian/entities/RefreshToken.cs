using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class RefreshToken
{
    public string Id { get; set; } = null!;

    public string Token { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
