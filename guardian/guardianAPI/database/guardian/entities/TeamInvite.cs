using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class TeamInvite
{
    public string Id { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
