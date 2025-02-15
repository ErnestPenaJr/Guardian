using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace Database.Guardian.Entities;

public partial class GuardianDbContext : DbContext
{
    public GuardianDbContext(DbContextOptions<GuardianDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Company> Companies { get; set; }

    public virtual DbSet<CompanySubscription> CompanySubscriptions { get; set; }

    public virtual DbSet<EmailVerification> EmailVerifications { get; set; }

    public virtual DbSet<FieldType> FieldTypes { get; set; }

    public virtual DbSet<FormAttachment> FormAttachments { get; set; }

    public virtual DbSet<FormAttachment1> FormAttachments1 { get; set; }

    public virtual DbSet<FormSubmission> FormSubmissions { get; set; }

    public virtual DbSet<FormSubmissionValue> FormSubmissionValues { get; set; }

    public virtual DbSet<FormTemplate> FormTemplates { get; set; }

    public virtual DbSet<MilestoneType> MilestoneTypes { get; set; }

    public virtual DbSet<PlanFieldType> PlanFieldTypes { get; set; }

    public virtual DbSet<RefreshToken> RefreshTokens { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<SubscriptionInvoice> SubscriptionInvoices { get; set; }

    public virtual DbSet<SubscriptionPlan> SubscriptionPlans { get; set; }

    public virtual DbSet<SubscriptionUsage> SubscriptionUsages { get; set; }

    public virtual DbSet<TeamInvite> TeamInvites { get; set; }

    public virtual DbSet<Test> Tests { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<UserRole> UserRoles { get; set; }

    public virtual DbSet<VerificationCode> VerificationCodes { get; set; }

    public virtual DbSet<Workflow> Workflows { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Company>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("Company_pkey");

            entity.ToTable("Company", "GUARDIAN");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.Name)
                .HasMaxLength(1000)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
        });

        modelBuilder.Entity<CompanySubscription>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("CompanySubscription_pkey");

            entity.ToTable("CompanySubscription", "GUARDIAN");

            entity.HasIndex(e => e.CompanyId, "CompanySubscription_companyId_key").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CompanyId)
                .HasMaxLength(1000)
                .HasColumnName("companyId");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.EndDate).HasColumnName("endDate");
            entity.Property(e => e.PlanId)
                .HasMaxLength(1000)
                .HasColumnName("planId");
            entity.Property(e => e.StartDate)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("startDate");
            entity.Property(e => e.Status)
                .HasMaxLength(1000)
                .HasDefaultValue("ACTIVE")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");

            entity.HasOne(d => d.Company).WithOne(p => p.CompanySubscription)
                .HasForeignKey<CompanySubscription>(d => d.CompanyId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("CompanySubscription_companyId_fkey");

            entity.HasOne(d => d.Plan).WithMany(p => p.CompanySubscriptions)
                .HasForeignKey(d => d.PlanId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("CompanySubscription_planId_fkey");
        });

        modelBuilder.Entity<EmailVerification>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("EmailVerification_pkey");

            entity.ToTable("EmailVerification", "GUARDIAN");

            entity.HasIndex(e => e.Token, "EmailVerification_token_key").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.ExpiresAt).HasColumnName("expiresAt");
            entity.Property(e => e.Token)
                .HasMaxLength(1000)
                .HasColumnName("token");
            entity.Property(e => e.UserId)
                .HasMaxLength(1000)
                .HasColumnName("userId");

            entity.HasOne(d => d.User).WithMany(p => p.EmailVerifications)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("EmailVerification_userId_fkey");
        });

        modelBuilder.Entity<FieldType>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("FieldType_pkey");

            entity.ToTable("FieldType", "GUARDIAN");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.Category)
                .HasMaxLength(1000)
                .HasColumnName("category");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.Description)
                .HasMaxLength(1000)
                .HasColumnName("description");
            entity.Property(e => e.IsPremium).HasColumnName("isPremium");
            entity.Property(e => e.Name)
                .HasMaxLength(1000)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
        });

        modelBuilder.Entity<FormAttachment>(entity =>
        {
            entity.HasKey(e => e.Id)
                .HasName("FormAttachment_pkey")
                .IsClustered(false);

            entity.ToTable("FormAttachment", "GUARDIAN");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("fileName");
            entity.Property(e => e.FileSize).HasColumnName("fileSize");
            entity.Property(e => e.FileType)
                .HasMaxLength(100)
                .HasColumnName("fileType");
            entity.Property(e => e.StorageUrl)
                .HasMaxLength(1000)
                .HasColumnName("storageUrl");
            entity.Property(e => e.SubmissionId)
                .HasMaxLength(1000)
                .HasColumnName("submissionId");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
            entity.Property(e => e.UploadedBy)
                .HasMaxLength(1000)
                .HasColumnName("uploadedBy");

            entity.HasOne(d => d.Submission).WithMany(p => p.FormAttachments)
                .HasForeignKey(d => d.SubmissionId)
                .HasConstraintName("FormAttachment_submissionId_fkey");

            entity.HasOne(d => d.UploadedByNavigation).WithMany(p => p.FormAttachments)
                .HasForeignKey(d => d.UploadedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FormAttachment_uploadedBy_fkey");
        });

        modelBuilder.Entity<FormAttachment1>(entity =>
        {
            entity.HasKey(e => e.AttachmentId).HasName("PK__FormAtta__442C64BE1A5E3F78");

            entity.ToTable("FormAttachments", "GUARDIAN");

            entity.Property(e => e.AttachmentId).HasDefaultValueSql("(newid())");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.FileName).HasMaxLength(255);
            entity.Property(e => e.FileType).HasMaxLength(100);
        });

        modelBuilder.Entity<FormSubmission>(entity =>
        {
            entity.HasKey(e => e.Id)
                .HasName("FormSubmission_pkey")
                .IsClustered(false);

            entity.ToTable("FormSubmission", "GUARDIAN");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.AssignedAt).HasColumnName("assignedAt");
            entity.Property(e => e.CompanyId)
                .HasMaxLength(1000)
                .HasColumnName("companyId");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.DueDate).HasColumnName("dueDate");
            entity.Property(e => e.FormData)
                .HasDefaultValue("{}")
                .HasColumnName("formData");
            entity.Property(e => e.Priority)
                .HasMaxLength(20)
                .HasDefaultValue("Normal")
                .HasColumnName("priority");
            entity.Property(e => e.ProcessedAt).HasColumnName("processedAt");
            entity.Property(e => e.ProcessorId)
                .HasMaxLength(1000)
                .HasColumnName("processorId");
            entity.Property(e => e.ProcessorNotes).HasColumnName("processorNotes");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Pending")
                .HasColumnName("status");
            entity.Property(e => e.SubmittedBy)
                .HasMaxLength(1000)
                .HasColumnName("submittedBy");
            entity.Property(e => e.SubmitterNotes).HasColumnName("submitterNotes");
            entity.Property(e => e.TemplateId)
                .HasMaxLength(1000)
                .HasColumnName("templateId");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");

            entity.HasOne(d => d.Company).WithMany(p => p.FormSubmissions)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FormSubmission_companyId_fkey");

            entity.HasOne(d => d.Processor).WithMany(p => p.FormSubmissionProcessors)
                .HasForeignKey(d => d.ProcessorId)
                .HasConstraintName("FormSubmission_processorId_fkey");

            entity.HasOne(d => d.SubmittedByNavigation).WithMany(p => p.FormSubmissionSubmittedByNavigations)
                .HasForeignKey(d => d.SubmittedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FormSubmission_submittedBy_fkey");

            entity.HasOne(d => d.Template).WithMany(p => p.FormSubmissions)
                .HasForeignKey(d => d.TemplateId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FormSubmission_templateId_fkey");
        });

        modelBuilder.Entity<FormSubmissionValue>(entity =>
        {
            entity.HasKey(e => e.Id)
                .HasName("FormSubmissionValue_pkey")
                .IsClustered(false);

            entity.ToTable("FormSubmissionValue", "GUARDIAN");

            entity.HasIndex(e => new { e.SubmissionId, e.FieldId }, "FormSubmissionValue_submissionId_fieldId_key").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.FieldId)
                .HasMaxLength(255)
                .HasColumnName("fieldId");
            entity.Property(e => e.Label)
                .HasMaxLength(255)
                .HasColumnName("label");
            entity.Property(e => e.Options).HasColumnName("options");
            entity.Property(e => e.Placeholder)
                .HasMaxLength(255)
                .HasColumnName("placeholder");
            entity.Property(e => e.Required).HasColumnName("required");
            entity.Property(e => e.SubmissionId)
                .HasMaxLength(1000)
                .HasColumnName("submissionId");
            entity.Property(e => e.Type)
                .HasMaxLength(50)
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
            entity.Property(e => e.Value).HasColumnName("value");

            entity.HasOne(d => d.Submission).WithMany(p => p.FormSubmissionValues)
                .HasForeignKey(d => d.SubmissionId)
                .HasConstraintName("FormSubmissionValue_submissionId_fkey");
        });

        modelBuilder.Entity<FormTemplate>(entity =>
        {
            entity.HasKey(e => e.Id)
                .HasName("FormTemplate_pkey")
                .IsClustered(false);

            entity.ToTable("FormTemplate", "GUARDIAN");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.AllowedRoles)
                .HasDefaultValue("[\"user\", \"processor\", \"manager\"]")
                .HasColumnName("allowedRoles");
            entity.Property(e => e.CompanyId)
                .HasMaxLength(1000)
                .HasColumnName("companyId");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(1000)
                .HasColumnName("createdBy");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Fields)
                .HasDefaultValue("[]")
                .HasColumnName("fields");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("isActive");
            entity.Property(e => e.Name)
                .HasMaxLength(255)
                .HasDefaultValue("Untitled Form")
                .HasColumnName("name");
            entity.Property(e => e.ProcessorRoles)
                .HasDefaultValue("[\"processor\", \"manager\"]")
                .HasColumnName("processorRoles");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValue("draft")
                .HasColumnName("status");
            entity.Property(e => e.Type)
                .HasMaxLength(50)
                .HasDefaultValue("request")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");

            entity.HasOne(d => d.Company).WithMany(p => p.FormTemplates)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FormTemplate_companyId_fkey");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.FormTemplates)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FormTemplate_createdBy_fkey");
        });

        modelBuilder.Entity<MilestoneType>(entity =>
        {
            entity.ToTable("MilestoneTypes", "GUARDIAN");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Name)
                .HasMaxLength(25)
                .IsUnicode(false);
        });

        modelBuilder.Entity<PlanFieldType>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PlanFieldType_pkey");

            entity.ToTable("PlanFieldType", "GUARDIAN");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.FieldTypeId)
                .HasMaxLength(1000)
                .HasColumnName("fieldTypeId");
            entity.Property(e => e.Name)
                .HasMaxLength(1000)
                .HasColumnName("name");
            entity.Property(e => e.PlanId)
                .HasMaxLength(1000)
                .HasColumnName("planId");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");

            entity.HasOne(d => d.FieldType).WithMany(p => p.PlanFieldTypes)
                .HasForeignKey(d => d.FieldTypeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("PlanFieldType_fieldTypeId_fkey");

            entity.HasOne(d => d.Plan).WithMany(p => p.PlanFieldTypes)
                .HasForeignKey(d => d.PlanId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("PlanFieldType_planId_fkey");
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("RefreshToken_pkey");

            entity.ToTable("RefreshToken", "GUARDIAN");

            entity.HasIndex(e => e.Token, "RefreshToken_token_key").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.ExpiresAt).HasColumnName("expiresAt");
            entity.Property(e => e.Token)
                .HasMaxLength(1000)
                .HasColumnName("token");
            entity.Property(e => e.UserId)
                .HasMaxLength(1000)
                .HasColumnName("userId");

            entity.HasOne(d => d.User).WithMany(p => p.RefreshTokens)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("RefreshToken_userId_fkey");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("Role_pkey");

            entity.ToTable("Role", "GUARDIAN");

            entity.HasIndex(e => e.Name, "Role_name_key").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.Description)
                .HasMaxLength(1000)
                .HasColumnName("description");
            entity.Property(e => e.Name)
                .HasMaxLength(1000)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
        });

        modelBuilder.Entity<SubscriptionInvoice>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("SubscriptionInvoice_pkey");

            entity.ToTable("SubscriptionInvoice", "GUARDIAN");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.Amount).HasColumnName("amount");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.PaidAt).HasColumnName("paidAt");
            entity.Property(e => e.Status)
                .HasMaxLength(1000)
                .HasDefaultValue("PENDING")
                .HasColumnName("status");
            entity.Property(e => e.SubscriptionId)
                .HasMaxLength(1000)
                .HasColumnName("subscriptionId");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");

            entity.HasOne(d => d.Subscription).WithMany(p => p.SubscriptionInvoices)
                .HasForeignKey(d => d.SubscriptionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("SubscriptionInvoice_subscriptionId_fkey");
        });

        modelBuilder.Entity<SubscriptionPlan>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("SubscriptionPlan_pkey");

            entity.ToTable("SubscriptionPlan", "GUARDIAN");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.Description)
                .HasMaxLength(1000)
                .HasColumnName("description");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("isActive");
            entity.Property(e => e.MaxForms).HasColumnName("maxForms");
            entity.Property(e => e.MaxUsers).HasColumnName("maxUsers");
            entity.Property(e => e.Name)
                .HasMaxLength(1000)
                .HasColumnName("name");
            entity.Property(e => e.PriceMonthly).HasColumnName("priceMonthly");
            entity.Property(e => e.PriceYearly).HasColumnName("priceYearly");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
        });

        modelBuilder.Entity<SubscriptionUsage>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("SubscriptionUsage_pkey");

            entity.ToTable("SubscriptionUsage", "GUARDIAN");

            entity.HasIndex(e => e.SubscriptionId, "SubscriptionUsage_subscriptionId_key").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.FormsCount).HasColumnName("formsCount");
            entity.Property(e => e.LastUpdated)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("lastUpdated");
            entity.Property(e => e.SubscriptionId)
                .HasMaxLength(1000)
                .HasColumnName("subscriptionId");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
            entity.Property(e => e.UsersCount).HasColumnName("usersCount");

            entity.HasOne(d => d.Subscription).WithOne(p => p.SubscriptionUsage)
                .HasForeignKey<SubscriptionUsage>(d => d.SubscriptionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("SubscriptionUsage_subscriptionId_fkey");
        });

        modelBuilder.Entity<TeamInvite>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("TeamInvite_pkey");

            entity.ToTable("TeamInvite", "GUARDIAN");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.Email)
                .HasMaxLength(1000)
                .HasColumnName("email");
            entity.Property(e => e.Status)
                .HasMaxLength(1000)
                .HasDefaultValue("PENDING")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
            entity.Property(e => e.UserId)
                .HasMaxLength(1000)
                .HasColumnName("userId");

            entity.HasOne(d => d.User).WithMany(p => p.TeamInvites)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("TeamInvite_userId_fkey");
        });

        modelBuilder.Entity<Test>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("test", "GUARDIAN");

            entity.Property(e => e.Id).HasColumnName("id");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("User_pkey");

            entity.ToTable("User", "GUARDIAN");

            entity.HasIndex(e => e.Email, "User_email_key").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CompanyId)
                .HasMaxLength(1000)
                .HasColumnName("companyId");
            entity.Property(e => e.CompanyName)
                .HasMaxLength(1000)
                .HasColumnName("companyName");
            entity.Property(e => e.CompanySize)
                .HasMaxLength(1000)
                .HasColumnName("companySize");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.Email)
                .HasMaxLength(1000)
                .HasColumnName("email");
            entity.Property(e => e.FirstName)
                .HasMaxLength(1000)
                .HasColumnName("firstName");
            entity.Property(e => e.IsEmailVerified).HasColumnName("isEmailVerified");
            entity.Property(e => e.JobTitle)
                .HasMaxLength(1000)
                .HasColumnName("jobTitle");
            entity.Property(e => e.LastLoginAt).HasColumnName("lastLoginAt");
            entity.Property(e => e.LastName)
                .HasMaxLength(1000)
                .HasColumnName("lastName");
            entity.Property(e => e.OnboardingStep).HasColumnName("onboardingStep");
            entity.Property(e => e.Organization)
                .HasMaxLength(1000)
                .HasColumnName("organization");
            entity.Property(e => e.Password)
                .HasMaxLength(1000)
                .HasColumnName("password");
            entity.Property(e => e.Preferences)
                .HasMaxLength(1000)
                .HasColumnName("preferences");
            entity.Property(e => e.ProjectName)
                .HasMaxLength(1000)
                .HasColumnName("projectName");
            entity.Property(e => e.Role)
                .HasMaxLength(1000)
                .HasDefaultValue("USER")
                .HasColumnName("role");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");

            entity.HasOne(d => d.Company).WithMany(p => p.Users)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("User_companyId_fkey");
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("UserRole_pkey");

            entity.ToTable("UserRole", "GUARDIAN");

            entity.HasIndex(e => new { e.UserId, e.RoleId }, "UserRole_userId_roleId_key").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.RoleId)
                .HasMaxLength(1000)
                .HasColumnName("roleId");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
            entity.Property(e => e.UserId)
                .HasMaxLength(1000)
                .HasColumnName("userId");

            entity.HasOne(d => d.Role).WithMany(p => p.UserRoles)
                .HasForeignKey(d => d.RoleId)
                .HasConstraintName("UserRole_roleId_fkey");

            entity.HasOne(d => d.User).WithMany(p => p.UserRoles)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("UserRole_userId_fkey");
        });

        modelBuilder.Entity<VerificationCode>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("VerificationCode_pkey");

            entity.ToTable("VerificationCode", "GUARDIAN");

            entity.HasIndex(e => new { e.Email, e.Code }, "VerificationCode_email_code_idx");

            entity.HasIndex(e => e.ExpiresAt, "VerificationCode_expiresAt_idx");

            entity.Property(e => e.Id)
                .HasMaxLength(1000)
                .HasColumnName("id");
            entity.Property(e => e.Code)
                .HasMaxLength(1000)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("createdAt");
            entity.Property(e => e.Email)
                .HasMaxLength(1000)
                .HasColumnName("email");
            entity.Property(e => e.ExpiresAt).HasColumnName("expiresAt");
            entity.Property(e => e.UpdatedAt).HasColumnName("updatedAt");
            entity.Property(e => e.Used).HasColumnName("used");
        });

        modelBuilder.Entity<Workflow>(entity =>
        {
            entity.ToTable("Workflows", "GUARDIAN");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Description).HasMaxLength(2000);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.WorkflowType)
                .HasMaxLength(20)
                .IsUnicode(false);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
