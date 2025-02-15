using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class SubscriptionPlan
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public int MaxForms { get; set; }

    public int MaxUsers { get; set; }

    public double PriceMonthly { get; set; }

    public double PriceYearly { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<CompanySubscription> CompanySubscriptions { get; set; } = new List<CompanySubscription>();

    public virtual ICollection<PlanFieldType> PlanFieldTypes { get; set; } = new List<PlanFieldType>();
}
