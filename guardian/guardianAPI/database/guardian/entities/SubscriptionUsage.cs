using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class SubscriptionUsage
{
    public string Id { get; set; } = null!;

    public string SubscriptionId { get; set; } = null!;

    public int FormsCount { get; set; }

    public int UsersCount { get; set; }

    public DateTime LastUpdated { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual CompanySubscription Subscription { get; set; } = null!;
}
