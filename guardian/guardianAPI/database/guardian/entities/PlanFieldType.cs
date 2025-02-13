using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class PlanFieldType
{
    public string Id { get; set; } = null!;

    public string PlanId { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string FieldTypeId { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual FieldType FieldType { get; set; } = null!;

    public virtual SubscriptionPlan Plan { get; set; } = null!;
}
