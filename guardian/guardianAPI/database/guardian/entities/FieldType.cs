using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class FieldType
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string Category { get; set; } = null!;

    public bool IsPremium { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<PlanFieldType> PlanFieldTypes { get; set; } = new List<PlanFieldType>();
}
