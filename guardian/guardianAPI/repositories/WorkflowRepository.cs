//User Status: Invited, Pending, Denied, Active, Inactive


using Database.Guardian.Entities;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Repositories
{
    public class WorkflowRepository(GuardianDbContext db)
    {

        public async Task<WorkflowData?> GetWorkflow(Guid workflowId)
        {
            var wf = await db.Workflows
                .Where(w => w.Id == workflowId) //TODO add organization check?
                .OrderByDescending(w => w.CreatedAt)
                .Select(w => new WorkflowData
                {
                    Id = w.Id,
                    Name = w.Name,
                    Description = w.Description,
                    IsActive = w.IsActive,
                    IsExternal = w.IsExternal,
                    WorkflowType = w.WorkflowType,
                    WorkflowDefinition = w.WorkflowDefinition
                })
                .SingleOrDefaultAsync();

            return wf;
        }

        public async Task<List<WorkflowGridData>> GetWorkflows(string workflowType, Guid organizationId)
        {
            var query = db.Workflows.Where(w => w.OrganizationId == organizationId);

            if (workflowType == "request")
            {
                query = query.Where(w => w.WorkflowType == "request");
            } else if (workflowType == "notice")
            {
                query = query.Where(w => w.WorkflowType == "notice");
            }

            var wfs = await query.OrderByDescending(w => w.CreatedAt)
                .Select(w => new WorkflowGridData
                {
                    Id = w.Id,
                    Name = w.Name,
                    IsActive = w.IsActive,
                    IsExternal = w.IsExternal,
                    WorkflowType = w.WorkflowType,
                }).ToListAsync();

            return wfs;

        }

        public async Task<bool> CreateWorkflow(WorkflowData workflow, Guid organizationId)
        {
            db.Workflows.Add(new Workflow
            {
                Id = workflow.Id,
                OrganizationId = organizationId,
                Name = workflow.Name,
                Description = workflow.Description,
                IsActive = workflow.IsActive,
                IsExternal = workflow.IsExternal,
                WorkflowType = workflow.WorkflowType,
                WorkflowDefinition = workflow.WorkflowDefinition,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });

            var changes = await db.SaveChangesAsync();

            return changes > 0;
        }

        // public async Task<bool> UpdateWorkflow(WorkflowData workflow)
        // {
        // }


    }
}