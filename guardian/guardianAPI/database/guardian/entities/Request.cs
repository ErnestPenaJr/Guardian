using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class Request
{
    public Guid Id { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid WorkflowId { get; set; }

    public string RequestData { get; set; } = null!;

    public int StatusId { get; set; }

    public Guid? AssignedTo { get; set; }

    public DateTime CreatedAt { get; set; }

    public Guid CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }
}
