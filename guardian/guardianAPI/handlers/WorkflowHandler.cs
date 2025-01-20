

namespace Handlers
{
    public static class WorkflowHandler
    {
        public static RouteGroupBuilder MapWorkflowApi(this RouteGroupBuilder group)
        {
            group.MapGet("/workflows", () => "Hello World!");

            group.MapPost("/workflows", () => "Hello World!");

            //title description active external
            group.MapPut("/workflows", () => "Hello World!");
            
            return group;
        }
    }
}