using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class RequestAttachment
{
    public Guid Id { get; set; }

    public Guid RequestId { get; set; }

    public Guid DocumentId { get; set; }

    public string FileName { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public Guid CreatedBy { get; set; }

    public byte[] DataVersion { get; set; } = null!;
}
