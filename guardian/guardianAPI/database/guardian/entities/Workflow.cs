using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class Workflow
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;

    public string WorkflowType { get; set; } = null!;

    public bool IsExternal { get; set; }

    public bool IsActive { get; set; }

    public string Description { get; set; } = null!;

    public string WorkflowDefinition { get; set; } = null!;

    public Guid OrganizationId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
