

using Models;

namespace Handlers
{
    public static class WorkflowHandler
    {
        public static RouteGroupBuilder MapWorkflowApi(this RouteGroupBuilder group)
        {
            group.MapGet("/workflows", () => {

                List<WorkflowGridData> workflows = [
                    new WorkflowGridData { WorkflowId = 1, Name = "workflow 1", WorkflowType = "Request", External = false, Active = true },
                    new WorkflowGridData { WorkflowId = 2, Name = "workflow 2", WorkflowType = "SelfService", External = false, Active = true },
                    new WorkflowGridData { WorkflowId = 3, Name = "workflow 3", WorkflowType = "Notice", External = true, Active = true },
                    new WorkflowGridData { WorkflowId = 4, Name = "workflow 4", WorkflowType = "Request", External = false, Active = false },
                    new WorkflowGridData { WorkflowId = 5, Name = "workflow 5", WorkflowType = "SelfService", External = true, Active = true }
                ];

                return Results.Ok(workflows);
            });

            group.MapGet("/workflows/{id}", (int id) => {

                List<WorkflowData> workflows = [
                    new WorkflowData { WorkflowId = 1, Name = "workflow 1", Description = "workflow 1 description", Active = true, External = false, WorkflowType = "Request", CustomWorkflow = "{}" },
                    new WorkflowData { WorkflowId = 2, Name = "workflow 2", Description = "workflow 2 description", Active = true, External = false, WorkflowType = "SelfService", CustomWorkflow = "{}" },
                    new WorkflowData { WorkflowId = 3, Name = "workflow 3", Description = "workflow 3 description", Active = true, External = true, WorkflowType = "Notice", CustomWorkflow = "{}" },
                    new WorkflowData { WorkflowId = 4, Name = "workflow 4", Description = "workflow 4 description", Active = false, External = false, WorkflowType = "Request", CustomWorkflow = "{}" },
                    new WorkflowData { WorkflowId = 5, Name = "workflow 5", Description = "workflow 5 description", Active = true, External = true, WorkflowType = "SelfService", CustomWorkflow = "{}" }
                ];

                var workflow = workflows.FirstOrDefault(w => w.WorkflowId == id);

                if (workflow == null)
                {
                    return Results.NotFound();
                }
                
                return Results.Ok(workflow);
            });

            group.MapPost("/workflows", () => {
                
                return Results.Ok();
            });

            //title description active external
            group.MapPut("/workflows", () => {

                

                return Results.Ok();
            });
            
            return group;
        }
    }
}