using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class FormSubmissionValue
{
    public string Id { get; set; } = null!;

    public string SubmissionId { get; set; } = null!;

    public string FieldId { get; set; } = null!;

    public string Label { get; set; } = null!;

    public string Type { get; set; } = null!;

    public string? Value { get; set; }

    public bool Required { get; set; }

    public string? Description { get; set; }

    public string? Options { get; set; }

    public string? Placeholder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual FormSubmission Submission { get; set; } = null!;
}
