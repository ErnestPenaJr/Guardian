using Database.Guardian.Entities;
using Models;

namespace Repositories
{
    public class DocumentRepository(GuardianDbContext db, ILogger<DocumentRepository> logger)
    {
        public async Task<(DocumentInfo? DocumentInfo, bool Success)> Save(IFormFile file, Guid UserId)
        {
            // Save document to database
            try {
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms);

                var doc = await db.Documents.AddAsync(new Document {
                    FileName = file.FileName,
                    FileType = file.ContentType,
                    FileData = ms.ToArray(),
                    CreatedBy = UserId,
                    CreatedAt = DateTime.UtcNow,
                });

                var changes = await db.SaveChangesAsync();

                return changes > 0
                    ? (new DocumentInfo {
                        Id = doc.Entity.Id,
                        FileName = doc.Entity.FileName,
                        FileType = doc.Entity.FileType,
                    }, true)
                    : (null, false);

            } catch(Exception e) {
                logger.LogError("error saving document for user {UserId}: {e}, {e.Message}", UserId, e, e.Message);
                return (null, false);
            }
        }

        public void Delete(int documentId)
        {
            //soft delete?
        }
    }
}