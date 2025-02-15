using System;
using System.Collections.Generic;

namespace Database.Guardian.Entities;

public partial class User
{
    public string Id { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string Password { get; set; } = null!;

    public string? ProjectName { get; set; }

    public string? CompanyName { get; set; }

    public string? CompanySize { get; set; }

    public string Role { get; set; } = null!;

    public bool IsEmailVerified { get; set; }

    public int OnboardingStep { get; set; }

    public string? Organization { get; set; }

    public string? JobTitle { get; set; }

    public string? Preferences { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? CompanyId { get; set; }

    public virtual Company? Company { get; set; }

    public virtual ICollection<EmailVerification> EmailVerifications { get; set; } = new List<EmailVerification>();

    public virtual ICollection<FormAttachment> FormAttachments { get; set; } = new List<FormAttachment>();

    public virtual ICollection<FormSubmission> FormSubmissionProcessors { get; set; } = new List<FormSubmission>();

    public virtual ICollection<FormSubmission> FormSubmissionSubmittedByNavigations { get; set; } = new List<FormSubmission>();

    public virtual ICollection<FormTemplate> FormTemplates { get; set; } = new List<FormTemplate>();

    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    public virtual ICollection<TeamInvite> TeamInvites { get; set; } = new List<TeamInvite>();

    public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}
