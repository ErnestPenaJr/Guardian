using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class SubscriptionInvoice
{
    public string Id { get; set; } = null!;

    public string SubscriptionId { get; set; } = null!;

    public double Amount { get; set; }

    public string Status { get; set; } = null!;

    public DateTime? PaidAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual CompanySubscription Subscription { get; set; } = null!;
}
