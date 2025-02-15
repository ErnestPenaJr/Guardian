using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class FormSubmission
{
    public string Id { get; set; } = null!;

    public string TemplateId { get; set; } = null!;

    public string SubmittedBy { get; set; } = null!;

    public string CompanyId { get; set; } = null!;

    public string FormData { get; set; } = null!;

    public string Priority { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? ProcessorId { get; set; }

    public string? ProcessorNotes { get; set; }

    public string? SubmitterNotes { get; set; }

    public DateTime? AssignedAt { get; set; }

    public DateTime? ProcessedAt { get; set; }

    public DateTime? DueDate { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual ICollection<FormAttachment> FormAttachments { get; set; } = new List<FormAttachment>();

    public virtual ICollection<FormSubmissionValue> FormSubmissionValues { get; set; } = new List<FormSubmissionValue>();

    public virtual User? Processor { get; set; }

    public virtual User SubmittedByNavigation { get; set; } = null!;

    public virtual FormTemplate Template { get; set; } = null!;
}
