using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class FormAttachment1
{
    public Guid AttachmentId { get; set; }

    public Guid SubmissionId { get; set; }

    public string FileName { get; set; } = null!;

    public string? FileType { get; set; }

    public long? FileSize { get; set; }

    public string FilePath { get; set; } = null!;

    public Guid UploadedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }
}
