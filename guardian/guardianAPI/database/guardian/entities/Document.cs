using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class Document
{
    public Guid Id { get; set; }

    public string FileName { get; set; } = null!;

    public string FileType { get; set; } = null!;

    public byte[] FileData { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public Guid CreatedBy { get; set; }

    public byte[] DataVersion { get; set; } = null!;
}
