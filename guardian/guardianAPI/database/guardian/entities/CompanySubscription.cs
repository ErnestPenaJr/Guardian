using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class CompanySubscription
{
    public string Id { get; set; } = null!;

    public string CompanyId { get; set; } = null!;

    public string PlanId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual SubscriptionPlan Plan { get; set; } = null!;

    public virtual ICollection<SubscriptionInvoice> SubscriptionInvoices { get; set; } = new List<SubscriptionInvoice>();

    public virtual SubscriptionUsage? SubscriptionUsage { get; set; }
}
