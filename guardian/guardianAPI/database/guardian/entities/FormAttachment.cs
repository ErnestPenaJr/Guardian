using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class FormAttachment
{
    public string Id { get; set; } = null!;

    public string SubmissionId { get; set; } = null!;

    public string FileName { get; set; } = null!;

    public string FileType { get; set; } = null!;

    public long FileSize { get; set; }

    public string StorageUrl { get; set; } = null!;

    public string UploadedBy { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual FormSubmission Submission { get; set; } = null!;

    public virtual User UploadedByNavigation { get; set; } = null!;
}
