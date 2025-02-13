using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class Company
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual CompanySubscription? CompanySubscription { get; set; }

    public virtual ICollection<FormSubmission> FormSubmissions { get; set; } = new List<FormSubmission>();

    public virtual ICollection<FormTemplate> FormTemplates { get; set; } = new List<FormTemplate>();

    public virtual ICollection<User> Users { get; set; } = new List<User>();
}
