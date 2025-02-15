using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class FormTemplate
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Type { get; set; } = null!;

    public string? Description { get; set; }

    public string Fields { get; set; } = null!;

    public string CreatedBy { get; set; } = null!;

    public string CompanyId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public bool IsActive { get; set; }

    public string AllowedRoles { get; set; } = null!;

    public string ProcessorRoles { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<FormSubmission> FormSubmissions { get; set; } = new List<FormSubmission>();
}
