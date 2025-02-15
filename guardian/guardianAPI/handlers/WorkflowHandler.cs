

using Models;
using Repositories;
using Services;

namespace Handlers
{
    public static class WorkflowHandler
    {
        public static RouteGroupBuilder MapWorkflowApi(this RouteGroupBuilder group)
        {
            group.MapGet("/workflows", async (
                TempUserService userService,
                WorkflowRepository wfRepo
            ) => {
                var user = userService.GetUserInfo();

                var workflows = await wfRepo.GetWorkflows("all", new Guid(user.Organization));

                return Results.Ok(workflows);
            });

            group.MapGet("/workflows/{id}", async (Guid id, WorkflowRepository wfRepo) => {

                var workflow = await wfRepo.GetWorkflow(id);

                return workflow is not null 
                    ? Results.Ok(workflow)
                    : Results.NotFound();
            });

            group.MapPost("/workflows", async (
                WorkflowData data,
                TempUserService userService,
                WorkflowRepository wfRepo
            ) => {

                var user = userService.GetUserInfo();
                
                var success = await wfRepo.CreateWorkflow(data, new Guid(user.Organization));

                return success
                    ? Results.Ok()
                    : Results.BadRequest();
            });

            //title description active external
            group.MapPut("/workflows", (WorkflowData data, WorkflowRepository wfRepo) => {

                

                return Results.Ok();
            });
            
            return group;
        }
    }
}